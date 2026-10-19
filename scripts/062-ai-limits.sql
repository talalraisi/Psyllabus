-- Limits on everything that spends money on a model, enforced where a client
-- cannot reach them.
--
-- 054 counted a student's requests before calling the model and recorded the
-- request after the answer came back. Twenty requests sent at once all read
-- the same "none used yet" and all went through, so the daily allowance was a
-- suggestion to anyone with a loop. And nothing at all capped the day across
-- every student together: one card paying for the whole school.
--
-- Now a request is claimed before the model is called, in one transaction,
-- under a lock, so a burst is counted one at a time. A claim is refused when:
--
--   the student has sent too many of this kind in the last minute  (bursts)
--   the student has had today's allowance of this kind             (per day)
--   today's spend across everyone would pass the daily budget      (the card)
--
-- Each claim reserves the most that kind of request can possibly cost (the
-- route caps input and output so that is a real ceiling), and the route then
-- replaces the reservation with what it actually cost. The budget counts
-- reservations until they are settled, so a request in flight already counts.
--
-- The limits and the budget sit in tables with no client policies at all:
-- only a direct connection changes them.
--
--   UPDATE ai_budget SET daily_micro = 3000000;          -- $3 a day
--   UPDATE ai_budget SET enabled = false;                -- switch every model call off
--   UPDATE ai_limits SET per_day = 60 WHERE task = 'tutor';
--
-- Money is in micro-dollars (millionths): 1,000,000 is $1. Days are Muscat days.

BEGIN;

CREATE TABLE IF NOT EXISTS ai_limits (
  task text PRIMARY KEY,
  per_day integer NOT NULL CHECK (per_day >= 0),
  per_minute integer NOT NULL CHECK (per_minute >= 0),
  -- The most one request of this kind can cost, given the route's caps.
  worst_cost_micro integer NOT NULL CHECK (worst_cost_micro > 0)
);

ALTER TABLE ai_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ai_limits FROM anon, authenticated;

INSERT INTO ai_limits (task, per_day, per_minute, worst_cost_micro) VALUES
  -- Haiku 5.5: ~10k tokens in at most, 2,000 out. About $0.002; reserved at $0.003.
  ('tutor', 40, 6, 3000),
  -- Sonnet 5.5 reading up to 60,000 characters (up to ~30k tokens in a
  -- non-Latin script) and writing at most 4,000 tokens: about $0.10 at worst.
  ('draft_feedback', 4, 2, 110000),
  -- Sonnet 5.5, 2,000 characters in, at most 3,000 tokens out: about $0.035.
  ('research_questions', 6, 3, 40000),
  ('study_advice', 6, 3, 40000)
ON CONFLICT (task) DO NOTHING;

CREATE TABLE IF NOT EXISTS ai_budget (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  daily_micro bigint NOT NULL CHECK (daily_micro >= 0),
  enabled boolean NOT NULL DEFAULT true
);

ALTER TABLE ai_budget ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ai_budget FROM anon, authenticated;

-- $1.50 a day across every student for the pilot.
INSERT INTO ai_budget (id, daily_micro, enabled) VALUES (true, 1500000, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE ai_usage
  ADD COLUMN IF NOT EXISTS reserved_micro integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_micro integer,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage (created_at);

-- Rows now only arrive through claim_ai_request. A student who could insert
-- their own could not get more than their allowance, but they could fill the
-- shared budget with fake reservations and switch Syllabi off for everyone.
DROP POLICY IF EXISTS "Students record their own AI usage" ON ai_usage;
REVOKE INSERT, UPDATE, DELETE ON ai_usage FROM anon, authenticated;

-- Replaced by the claim below; it also answered for any user id it was given.
DROP FUNCTION IF EXISTS ai_requests_today(uuid);

CREATE OR REPLACE FUNCTION claim_ai_request(p_task text, p_subject text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  lim ai_limits%ROWTYPE;
  bud ai_budget%ROWTYPE;
  day_start timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Muscat') AT TIME ZONE 'Asia/Muscat';
  used_day integer;
  used_minute integer;
  spent bigint;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'signed_out');
  END IF;

  SELECT * INTO lim FROM ai_limits WHERE task = p_task;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_task');
  END IF;

  SELECT * INTO bud FROM ai_budget WHERE id;
  IF NOT FOUND OR NOT bud.enabled THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'paused');
  END IF;

  -- One claim at a time, everywhere. Claims take milliseconds, and this is
  -- what makes twenty parallel requests count as twenty.
  PERFORM pg_advisory_xact_lock(hashtext('psyllabus:ai_budget'));

  SELECT count(*) FILTER (WHERE created_at >= day_start),
         count(*) FILTER (WHERE created_at >= now() - interval '1 minute')
    INTO used_day, used_minute
    FROM ai_usage
   WHERE user_id = uid
     AND task = p_task
     AND created_at >= least(day_start, now() - interval '1 minute');

  IF used_minute >= lim.per_minute THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'slow_down');
  END IF;

  IF used_day >= lim.per_day THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'daily_limit', 'limit', lim.per_day);
  END IF;

  SELECT coalesce(sum(coalesce(cost_micro, reserved_micro)), 0)
    INTO spent
    FROM ai_usage
   WHERE created_at >= day_start;

  IF spent + lim.worst_cost_micro > bud.daily_micro THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'paused');
  END IF;

  INSERT INTO ai_usage (user_id, task, subject, reserved_micro)
  VALUES (uid, p_task, left(p_subject, 120), lim.worst_cost_micro)
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('ok', true, 'id', new_id, 'remaining', lim.per_day - used_day - 1);
END;
$$;

REVOKE ALL ON FUNCTION claim_ai_request(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION claim_ai_request(text, text) TO authenticated;

/**
 * Settle a claim with what it really cost.
 *
 * Once per claim, by its owner, within a quarter of an hour, and never for
 * more than was reserved. A student calling this themselves can lower the
 * recorded cost of their own claims and nothing else, which is bounded by
 * their own allowance; it cannot raise anyone's limit.
 */
CREATE OR REPLACE FUNCTION finish_ai_request(p_id uuid, p_input integer, p_output integer, p_cost_micro integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE ai_usage
     SET input_tokens = greatest(0, coalesce(p_input, 0)),
         output_tokens = greatest(0, coalesce(p_output, 0)),
         cost_micro = least(reserved_micro, greatest(0, coalesce(p_cost_micro, reserved_micro))),
         finished_at = now()
   WHERE id = p_id
     AND user_id = auth.uid()
     AND finished_at IS NULL
     AND created_at > now() - interval '15 minutes';
$$;

REVOKE ALL ON FUNCTION finish_ai_request(uuid, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION finish_ai_request(uuid, integer, integer, integer) TO authenticated;

COMMIT;
