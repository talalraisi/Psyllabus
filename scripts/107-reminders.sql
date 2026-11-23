-- 107: reminders. A daily nudge by email and push, chosen by
-- lib/reminders.js and sent by app/api/reminders/route.js.
--
--   profiles.email_reminders / push_reminders   the student's own switches
--   push_subscriptions                           one row per device that said yes
--   reminder_log                                 what was sent, so nobody is
--                                                pestered: the server only
--   reminder_candidates()                        one row per set-up student with
--                                                what a nudge needs; service role only

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_reminders boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_reminders boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  endpoint text PRIMARY KEY CHECK (char_length(endpoint) <= 1000),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  p256dh text NOT NULL CHECK (char_length(p256dh) <= 200),
  auth text NOT NULL CHECK (char_length(auth) <= 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user ON public.push_subscriptions (user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push subscriptions are the owner's" ON public.push_subscriptions;
CREATE POLICY "push subscriptions are the owner's" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.reminder_log (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  channel text NOT NULL,   -- email, push
  kind text NOT NULL,      -- start, due, comeback, weekly
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reminder_log_user ON public.reminder_log (user_id, sent_at DESC);
-- No policies: students cannot read or write it, the service role can.
ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.reminder_candidates()
RETURNS TABLE (
  user_id uuid,
  email text,
  first_name text,
  created_at timestamptz,
  free_subject text,
  subjects jsonb,
  grad_year text,
  exam_session text,
  email_reminders boolean,
  push_reminders boolean,
  ever_studied boolean,
  last_active timestamptz,
  cards_due integer,
  mistakes_due integer,
  weak_subject text,
  weak_topic text,
  weak_subtopic text,
  week_minutes integer,
  prev_week_minutes integer,
  week_questions integer,
  last_email_at timestamptz,
  last_push_at timestamptz,
  nudges_since_active integer,
  push_subs jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH people AS (
    SELECT p.id, u.email, u.created_at, p.full_name, p.free_subject, p.subjects, p.grad_year, p.exam_session,
           p.email_reminders, p.push_reminders
      FROM profiles p
      JOIN auth.users u ON u.id = p.id
     WHERE jsonb_typeof(p.subjects) = 'array' AND jsonb_array_length(p.subjects) > 0
       AND u.email_confirmed_at IS NOT NULL
       -- Students, and admins so the owner gets what students get.
       AND (coalesce(p.role, 'student') = 'student' OR p.is_admin)
  ),
  studied AS (
    SELECT user_id, max(t) AS last FROM (
      SELECT user_id, created_at AS t FROM quiz_attempts
      UNION ALL SELECT user_id, started_at FROM study_sessions
      UNION ALL SELECT user_id, last_reviewed_at FROM flashcards WHERE last_reviewed_at IS NOT NULL
    ) x GROUP BY user_id
  ),
  seen AS (SELECT user_id, max(seen_at) AS last FROM presence GROUP BY user_id),
  sent AS (
    SELECT user_id,
           max(sent_at) FILTER (WHERE channel = 'email') AS last_email,
           max(sent_at) FILTER (WHERE channel = 'push') AS last_push
      FROM reminder_log GROUP BY user_id
  )
  SELECT
    pe.id,
    pe.email,
    nullif(split_part(trim(coalesce(pe.full_name, '')), ' ', 1), ''),
    pe.created_at,
    pe.free_subject,
    pe.subjects,
    pe.grad_year,
    pe.exam_session,
    pe.email_reminders,
    pe.push_reminders,
    st.last IS NOT NULL,
    greatest(st.last, se.last),
    (SELECT count(*)::int FROM flashcards f WHERE f.user_id = pe.id AND f.due_at <= now()),
    (SELECT count(*)::int FROM mistakes m WHERE m.user_id = pe.id AND m.next_review_at <= now()),
    w.subject, w.topic, w.subtopic,
    (SELECT coalesce(sum(extract(epoch FROM (least(s.ended_at, s.started_at + interval '4 hours') - s.started_at)) / 60), 0)::int
       FROM study_sessions s WHERE s.user_id = pe.id AND s.ended_at IS NOT NULL AND s.started_at > now() - interval '7 days'),
    (SELECT coalesce(sum(extract(epoch FROM (least(s.ended_at, s.started_at + interval '4 hours') - s.started_at)) / 60), 0)::int
       FROM study_sessions s WHERE s.user_id = pe.id AND s.ended_at IS NOT NULL
        AND s.started_at > now() - interval '14 days' AND s.started_at <= now() - interval '7 days'),
    (SELECT coalesce(sum(q.total_questions), 0)::int FROM quiz_attempts q WHERE q.user_id = pe.id AND q.created_at > now() - interval '7 days'),
    sn.last_email,
    sn.last_push,
    (SELECT count(DISTINCT date_trunc('day', r.sent_at))::int FROM reminder_log r
      WHERE r.user_id = pe.id AND r.kind <> 'weekly'
        AND r.sent_at > coalesce(greatest(st.last, se.last), pe.created_at)),
    coalesce((SELECT jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'keys', jsonb_build_object('p256dh', ps.p256dh, 'auth', ps.auth)))
                FROM push_subscriptions ps WHERE ps.user_id = pe.id), '[]'::jsonb)
  FROM people pe
  LEFT JOIN studied st ON st.user_id = pe.id
  LEFT JOIN seen se ON se.user_id = pe.id
  LEFT JOIN sent sn ON sn.user_id = pe.id
  LEFT JOIN LATERAL (
    -- The weakest subtopic answered at least twice lately.
    SELECT pr.subject, pr.topic, pr.subtopic
      FROM progress pr
     WHERE pr.user_id = pe.id AND coalesce(pr.recent_total, 0) >= 2
     ORDER BY pr.recent_correct::numeric / pr.recent_total, pr.updated_at DESC
     LIMIT 1
  ) w ON true
$$;

REVOKE ALL ON FUNCTION public.reminder_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reminder_candidates() TO service_role;
