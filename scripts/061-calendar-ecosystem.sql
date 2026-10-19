-- 061: The calendar ecosystem.
--
-- One calendar in the app, fed from three places and feeding back out:
--
--   In   A student connects their own calendar (Google, Apple, Outlook) by
--        pasting its private iCal link. The next six weeks are read on the
--        server and kept in calendar_busy: times and titles only — no
--        locations, descriptions or guests. Busy times come out of the free
--        time the student painted, so the plan never lands on top of
--        football, and events that look like tests are offered as Psyllabus
--        tests, added only when the student confirms.
--
--   Out  plan_blocks holds the study blocks the plan has scheduled, written
--        by the app whenever the plan is drawn. calendar_feeds gives each
--        student a private subscription link; calendar_feed(token) returns
--        exactly their blocks and their own dated events for that link and
--        nothing else, so their phone's calendar can show the plan. The app
--        writes the blocks rather than a server computing them so the feed
--        shows the plan the student actually saw, and so nothing needs
--        privileged access to their data.
--
-- Privacy (PDPL): every table is owner-only under RLS, included in
-- export_my_data() — connections without their private link — and erased
-- with the account through ON DELETE CASCADE from auth.users, which
-- delete_my_account() ends by deleting. Disconnecting a calendar deletes its
-- imported events with it.

BEGIN;

CREATE TABLE IF NOT EXISTS calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'My calendar' CHECK (char_length(label) BETWEEN 1 AND 80),
  url text NOT NULL CHECK (char_length(url) <= 2000 AND url ~* '^(https|webcal)://'),
  last_synced_at timestamptz,
  last_error text CHECK (char_length(last_error) <= 300),
  event_count int NOT NULL DEFAULT 0,
  -- Imported events the student said are not tests, so they are not offered again.
  dismissed text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calendar_busy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
  event_uid text NOT NULL CHECK (char_length(event_uid) <= 600),
  title text NOT NULL DEFAULT '' CHECK (char_length(title) <= 300),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  -- Marked "free" in the student's own calendar: shown, but does not block study time.
  transparent boolean NOT NULL DEFAULT false,
  CONSTRAINT calendar_busy_in_order CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS calendar_busy_user_start ON calendar_busy (user_id, starts_at);

CREATE TABLE IF NOT EXISTS plan_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  title text NOT NULL CHECK (char_length(title) <= 300),
  subject text CHECK (char_length(subject) <= 200),
  kind text CHECK (char_length(kind) <= 20),
  CONSTRAINT plan_blocks_in_order CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS plan_blocks_user_day ON plan_blocks (user_id, day);

CREATE TABLE IF NOT EXISTS calendar_feeds (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- An event the student confirmed from their own calendar remembers where it
-- came from, so it is not offered again.
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS source_uid text;
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_source_uid_bounded;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_source_uid_bounded CHECK (char_length(source_uid) <= 600);

-- Owner-only, every table. Connections may be updated (sync status, dismissed
-- suggestions); everything else is replaced by delete and insert.
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_busy ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_feeds ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['calendar_connections', 'calendar_busy', 'plan_blocks', 'calendar_feeds'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Own rows: read" ON %I', t);
    EXECUTE format('CREATE POLICY "Own rows: read" ON %I FOR SELECT TO authenticated USING (auth.uid() = user_id)', t);
    EXECUTE format('DROP POLICY IF EXISTS "Own rows: add" ON %I', t);
    EXECUTE format('CREATE POLICY "Own rows: add" ON %I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('DROP POLICY IF EXISTS "Own rows: remove" ON %I', t);
    EXECUTE format('CREATE POLICY "Own rows: remove" ON %I FOR DELETE TO authenticated USING (auth.uid() = user_id)', t);
    EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, DELETE ON %I TO authenticated', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Own rows: update" ON calendar_connections;
CREATE POLICY "Own rows: update" ON calendar_connections
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT UPDATE (label, last_synced_at, last_error, event_count, dismissed) ON calendar_connections TO authenticated;

-- Caps in the 037 pattern.
DROP TRIGGER IF EXISTS calendar_connections_row_cap ON calendar_connections;
CREATE TRIGGER calendar_connections_row_cap BEFORE INSERT ON calendar_connections
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cap('5');
DROP TRIGGER IF EXISTS calendar_busy_row_cap ON calendar_busy;
CREATE TRIGGER calendar_busy_row_cap BEFORE INSERT ON calendar_busy
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cap('5000');
DROP TRIGGER IF EXISTS plan_blocks_row_cap ON plan_blocks;
CREATE TRIGGER plan_blocks_row_cap BEFORE INSERT ON plan_blocks
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cap('2000');

/*
 * What a calendar app sees through a subscription link: the student's own
 * upcoming study blocks and dated events, for the token in that link, and
 * nothing else. Calendar apps fetch anonymously, so this is callable by anon;
 * the token is the key, the same way Google's own private iCal links work.
 */
CREATE OR REPLACE FUNCTION calendar_feed(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
BEGIN
  SELECT user_id INTO uid FROM calendar_feeds WHERE token = p_token;
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    -- The student's time zone, so an all-day test lands on their date.
    'tz', (SELECT plan_settings->>'tz' FROM profiles WHERE id = uid),
    'blocks', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                 'id', b.id, 'starts_at', b.starts_at, 'ends_at', b.ends_at, 'title', b.title, 'subject', b.subject, 'kind', b.kind
               ) ORDER BY b.starts_at), '[]'::jsonb)
               FROM plan_blocks b WHERE b.user_id = uid AND b.day >= current_date - 7),
    'events', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                 'id', e.id, 'title', e.title, 'kind', e.kind, 'subject', e.subject, 'due_at', e.due_at, 'all_day', e.all_day,
                 'remind_minutes_before', e.remind_minutes_before
               ) ORDER BY e.due_at), '[]'::jsonb)
               FROM calendar_events e WHERE e.user_id = uid AND NOT e.completed AND e.due_at >= now() - interval '30 days')
  );
END;
$$;
REVOKE ALL ON FUNCTION calendar_feed(uuid) FROM public;
GRANT EXECUTE ON FUNCTION calendar_feed(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION export_my_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  out jsonb;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'exported_at', now(),
    'notice', 'Everything Project Syllabus holds about you. Question and syllabus content is not included: it is the same for every student and is not personal data.',
    'account', (
      SELECT to_jsonb(p) - 'school_id' - 'access_code_id'
      FROM profiles p WHERE p.id = uid
    ),
    'progress',            (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM progress t WHERE t.user_id = uid),
    'topic_progress',      (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM user_topic_progress t WHERE t.user_id = uid),
    'core_progress',       (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM core_progress t WHERE t.user_id = uid),
    'quiz_attempts',       (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM quiz_attempts t WHERE t.user_id = uid),
    'answers',             (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM question_responses r
                              WHERE r.attempt_id IN (SELECT id FROM quiz_attempts WHERE user_id = uid)),
    'mistakes',            (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM mistakes t WHERE t.user_id = uid),
    'mastery_credits',     (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM mastery_credits t WHERE t.user_id = uid),
    'flashcards',          (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM flashcards t WHERE t.user_id = uid),
    'notes',               (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM notes t WHERE t.user_id = uid),
    'todos',               (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM todos t WHERE t.user_id = uid),
    'calendar_events',     (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM calendar_events t WHERE t.user_id = uid),
    'saved_questions',     (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM question_favourites t WHERE t.user_id = uid),
    'question_reports',    (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM question_reports t WHERE t.user_id = uid),
    'feedback',            (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM feedback t WHERE t.user_id = uid),
    'access_redemptions',  (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM access_code_redemptions t WHERE t.user_id = uid),
    'assistant_usage',     (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM ai_usage t WHERE t.user_id = uid),
    'study_sessions',      (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM study_sessions t WHERE t.user_id = uid),
    'plan_adjustments',    (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM plan_adjustments t WHERE t.user_id = uid),
    -- The connection minus its private link: that address is a key to the
    -- student's own calendar, and an export file gets emailed and left in
    -- downloads folders.
    'calendar_connections', (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'url'), '[]'::jsonb) FROM calendar_connections t WHERE t.user_id = uid),
    'calendar_imported',   (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM calendar_busy t WHERE t.user_id = uid),
    'plan_blocks',         (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM plan_blocks t WHERE t.user_id = uid)
  ) INTO out;

  RETURN out;
END;
$$;

REVOKE ALL ON FUNCTION export_my_data() FROM public;
GRANT EXECUTE ON FUNCTION export_my_data() TO authenticated;

COMMIT;
