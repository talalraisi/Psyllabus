-- Somewhere for a beta tester to say what went wrong.
--
-- There is already a way to report a bad question, which covers the one case
-- somebody anticipated. Everything else — a page that makes no sense, a button
-- that does nothing, a subject with no questions in it, an idea — has nowhere
-- to go, so it goes nowhere. A beta handed to a school with no route back is
-- thirty people forming an opinion you never hear.
--
-- Deliberately small: a message, a kind, and the page it came from. No title,
-- no category tree, no severity. Every field beyond the message is one more
-- reason not to bother sending it.
--
-- The page path is captured automatically because "it's broken" with no idea
-- where is a report you cannot act on, and asking someone to tell you where
-- they were is asking them to do your job.

BEGIN;

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,

  -- 'problem' | 'idea' | 'confusing' | 'other'. Free text rather than an enum
  -- so adding a kind later is a deploy, not a migration.
  kind text NOT NULL DEFAULT 'other' CHECK (char_length(kind) <= 24),

  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 4000),

  -- Where they were. Path only: never the query string, which on this app
  -- carries subject and subtopic names and, on the quiz, what they are sitting.
  path text CHECK (path IS NULL OR char_length(path) <= 200),

  -- Screen size, because half of all "the layout is broken" reports are a
  -- phone and knowing that is the whole diagnosis.
  viewport text CHECK (viewport IS NULL OR char_length(viewport) <= 24),

  handled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_unhandled_idx
  ON feedback (created_at DESC)
  WHERE NOT handled;

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can send one, and can read their own back so the app can
-- say "sent" honestly. Nobody can read anybody else's, and nobody can edit or
-- delete: a feedback table that its subjects can rewrite is not a record.
DROP POLICY IF EXISTS "Users send own feedback" ON feedback;
CREATE POLICY "Users send own feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own feedback" ON feedback;
CREATE POLICY "Users read own feedback" ON feedback
  FOR SELECT USING (auth.uid() = user_id);

-- Reading everything is an admin job, and admin is a column on profiles rather
-- than a role, so it needs a definer function rather than a policy.
CREATE OR REPLACE FUNCTION public.all_feedback()
RETURNS TABLE (
  id uuid,
  kind text,
  message text,
  path text,
  viewport text,
  handled boolean,
  created_at timestamptz,
  email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
    SELECT f.id, f.kind, f.message, f.path, f.viewport, f.handled, f.created_at,
           u.email::text
    FROM feedback f
    LEFT JOIN auth.users u ON u.id = f.user_id
    ORDER BY f.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.all_feedback() FROM public;
GRANT EXECUTE ON FUNCTION public.all_feedback() TO authenticated;

COMMIT;
