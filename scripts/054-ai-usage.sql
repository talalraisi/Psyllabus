-- What Syllabi has been asked to do, and by whom.
--
-- Every call to a model costs money that comes out of one card, so a runaway
-- loop or one enthusiastic student is a bill nobody agreed to. Usage is
-- recorded per request and the daily allowance is enforced by a function the
-- student cannot write to directly.
--
-- It also matters for the honest reason: a record of what was asked and how
-- long the answer was is the only way to tell later whether the feature was
-- used for feedback or for writing somebody's essay.

BEGIN;

CREATE TABLE IF NOT EXISTS ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task text NOT NULL,
  subject text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_day ON ai_usage (user_id, created_at DESC);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Students can see their own usage, and the route writes the row as them once
-- the model has answered. Letting a student insert their own usage rows is
-- safe in the only direction that matters: a row spent is a row they cannot
-- spend again, so the worst they can do to themselves is run out early.
DROP POLICY IF EXISTS "Students read their own AI usage" ON ai_usage;
CREATE POLICY "Students read their own AI usage" ON ai_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students record their own AI usage" ON ai_usage;
CREATE POLICY "Students record their own AI usage" ON ai_usage
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

/**
 * How many requests this student has made today.
 *
 * SECURITY DEFINER so the count cannot be avoided by a client that simply
 * does not ask, and STABLE so it can be called on every request cheaply.
 */
CREATE OR REPLACE FUNCTION ai_requests_today(p_user uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM ai_usage
  WHERE user_id = p_user
    AND created_at >= date_trunc('day', now());
$$;

GRANT EXECUTE ON FUNCTION ai_requests_today(uuid) TO authenticated;

COMMIT;
