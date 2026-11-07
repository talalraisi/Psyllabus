-- A taste of Syllabi for every account.
--
-- Syllabi was Premium only: a free account could not send it a single
-- message, so nobody found out what they would be paying for. Now every
-- account gets, once and for good (not per day):
--
--   1 draft marking         (task draft_feedback)
--   10 messages to the tutor (tasks tutor and tutor_files, together)
--
-- and Premium keeps everything else as it was. The other tasks (ideas,
-- reading PDFs, cards from notes) stay Premium only.
--
-- The check is in claim_ai_request, where it cannot be skipped by calling
-- the API directly. Until now that function did not look at the plan at all
-- (each route did), so a free account calling it from the browser could
-- reserve budget; that hole closes here too.
--
-- The trial is tied to the anti-duplicate check a free account already
-- passes when it chooses its free subject (072-free-plan-guard.sql): no
-- free_claims row, no trial. So a fresh account made with the same inbox or
-- on a device that has already claimed twice gets nothing new.
--
-- A request that failed before the model wrote a word (settled at zero cost)
-- does not use up the trial.

BEGIN;

/** Premium in the database's eyes: the same rules as getTier() in lib/access.js. */
CREATE OR REPLACE FUNCTION public.has_syllabi(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((
    SELECT is_admin
        OR plan = 'premium'
        OR (access_expires_at IS NOT NULL AND access_expires_at > now())
      FROM profiles WHERE id = p_uid
  ), false)
$$;
REVOKE ALL ON FUNCTION public.has_syllabi(uuid) FROM PUBLIC, anon, authenticated;

/** Which trial a task draws on, and how many it has. NULL: no trial. */
CREATE OR REPLACE FUNCTION public.syllabi_trial_of(p_task text)
RETURNS TABLE (bucket text, tasks text[], allowance integer)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT * FROM (VALUES
    ('marking', ARRAY['draft_feedback'], 1),
    ('messages', ARRAY['tutor', 'tutor_files'], 10)
  ) AS t(bucket, tasks, allowance)
  WHERE p_task = ANY (t.tasks)
$$;

/** Trial uses so far: every claim except those that failed before the model started. */
CREATE OR REPLACE FUNCTION public.syllabi_trial_used(p_uid uuid, p_tasks text[])
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
    FROM ai_usage
   WHERE user_id = p_uid
     AND task = ANY (p_tasks)
     AND NOT (finished_at IS NOT NULL AND cost_micro = 0)
$$;
REVOKE ALL ON FUNCTION public.syllabi_trial_used(uuid, text[]) FROM PUBLIC, anon, authenticated;

/**
 * What is left of the trial, for the page to show. Premium accounts get
 * {"premium": true} and no counts.
 */
CREATE OR REPLACE FUNCTION public.syllabi_trial_left()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;
  IF has_syllabi(uid) THEN
    RETURN jsonb_build_object('premium', true);
  END IF;
  RETURN jsonb_build_object(
    'premium', false,
    'eligible', EXISTS (SELECT 1 FROM free_claims WHERE user_id = uid),
    'marking', greatest(0, 1 - syllabi_trial_used(uid, ARRAY['draft_feedback'])),
    'messages', greatest(0, 10 - syllabi_trial_used(uid, ARRAY['tutor', 'tutor_files']))
  );
END;
$$;
REVOKE ALL ON FUNCTION public.syllabi_trial_left() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.syllabi_trial_left() TO authenticated;

/**
 * The claim, as in 062-ai-limits.sql, with the plan checked first: Premium
 * goes on to the usual daily limits; anyone else draws on the trial, or is
 * turned away with a reason the page can turn into "go Premium".
 */
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
  trial record;
  on_trial boolean := false;
  trial_used integer;
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

  IF NOT has_syllabi(uid) THEN
    SELECT * INTO trial FROM syllabi_trial_of(p_task);
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'premium_only');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM free_claims WHERE user_id = uid) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'trial_not_set_up');
    END IF;
    trial_used := syllabi_trial_used(uid, trial.tasks);
    IF trial_used >= trial.allowance THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'trial_used', 'bucket', trial.bucket, 'limit', trial.allowance);
    END IF;
    on_trial := true;
  END IF;

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

  IF on_trial THEN
    RETURN jsonb_build_object('ok', true, 'id', new_id, 'trial', true, 'bucket', trial.bucket,
                              'remaining', trial.allowance - trial_used - 1);
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', new_id, 'trial', false, 'remaining', lim.per_day - used_day - 1);
END;
$$;
REVOKE ALL ON FUNCTION claim_ai_request(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION claim_ai_request(text, text) TO authenticated;

COMMIT;
