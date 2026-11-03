-- Who is on Psyllabus right now, for the green dot friends see.
--
-- One row per student, the last time the app said they were there (every
-- couple of minutes while a dashboard tab is open and visible). Its own
-- table, not a profiles column, so the heartbeat never touches profiles and
-- its triggers. Nobody reads it directly: friends_activity() hands accepted
-- friends the time, and nothing else.

BEGIN;

CREATE TABLE IF NOT EXISTS presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON presence FROM PUBLIC, anon, authenticated;

-- "I'm here." Writes at most once a minute however often it is called.
CREATE OR REPLACE FUNCTION touch_presence()
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO presence (user_id, seen_at) VALUES (auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET seen_at = now()
  WHERE presence.seen_at < now() - interval '1 minute';
$$;

-- As in 095, with when each friend was last on.
DROP FUNCTION IF EXISTS friends_activity();
CREATE FUNCTION friends_activity()
RETURNS TABLE (friend uuid, plan jsonb, session_minutes integer, attempts jsonb, sessions jsonb, last_seen timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH mine AS (
    SELECT CASE WHEN requester = auth.uid() THEN addressee ELSE requester END AS friend
    FROM friendships
    WHERE status = 'accepted' AND auth.uid() IN (requester, addressee)
  )
  SELECT m.friend,
         jsonb_build_object('goal', p.plan_settings->'goal', 'week', p.plan_settings->'week', 'slots', p.plan_settings->'slots'),
         p.session_minutes,
         coalesce((SELECT jsonb_agg(jsonb_build_object('completed_at', a.completed_at, 'elapsed_seconds', a.elapsed_seconds))
                   FROM quiz_attempts a WHERE a.user_id = m.friend AND a.completed_at > now() - interval '120 days'), '[]'::jsonb),
         coalesce((SELECT jsonb_agg(jsonb_build_object('started_at', s.started_at, 'ended_at', s.ended_at))
                   FROM study_sessions s WHERE s.user_id = m.friend AND s.started_at > now() - interval '120 days'), '[]'::jsonb),
         (SELECT pr.seen_at FROM presence pr WHERE pr.user_id = m.friend)
  FROM mine m
  JOIN profiles p ON p.id = m.friend;
$$;

REVOKE ALL ON FUNCTION touch_presence(), friends_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION touch_presence(), friends_activity() TO authenticated;

COMMIT;
