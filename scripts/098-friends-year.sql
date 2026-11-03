-- Friends' study time over a year, not 120 days, so the leaderboard can
-- show this month, 3 months, 6 months and the year (lib/friends.js PERIODS).
-- Otherwise exactly as in 097.

BEGIN;

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
                   FROM quiz_attempts a WHERE a.user_id = m.friend AND a.completed_at > now() - interval '366 days'), '[]'::jsonb),
         coalesce((SELECT jsonb_agg(jsonb_build_object('started_at', s.started_at, 'ended_at', s.ended_at))
                   FROM study_sessions s WHERE s.user_id = m.friend AND s.started_at > now() - interval '366 days'), '[]'::jsonb),
         (SELECT pr.seen_at FROM presence pr WHERE pr.user_id = m.friend)
  FROM mine m
  JOIN profiles p ON p.id = m.friend;
$$;

REVOKE ALL ON FUNCTION friends_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION friends_activity() TO authenticated;

COMMIT;
