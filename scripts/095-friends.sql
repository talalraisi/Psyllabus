-- Friends: see each other's streaks and study time, and nothing else.
--
-- Safe by construction, because the people using it are school students:
--   * No directory and no search. You add a friend only with the code they
--     gave you, and they have to accept.
--   * No messages, comments, reactions or any text from one student to
--     another. There is nothing to write in.
--   * A friend sees a first name, an avatar, and study activity (the times
--     quizzes and timer runs happened, from which streak and minutes are
--     worked out in the browser exactly as for the student themselves).
--     Never a grade, a level, a score, a subject or an email.
--   * Either side can remove the other at any time.
--
-- Everything goes through the functions below; the tables have no write
-- policies, so nothing can be inserted or changed from the client directly.

BEGIN;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS friend_code text UNIQUE;

CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (requester <> addressee)
);
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair ON friendships (least(requester, addressee), greatest(requester, addressee));
CREATE INDEX IF NOT EXISTS friendships_addressee ON friendships (addressee);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students see their own friendships" ON friendships;
CREATE POLICY "Students see their own friendships" ON friendships FOR SELECT USING (auth.uid() IN (requester, addressee));

-- Your code, made the first time you ask for it. No 0/O or 1/I to misread.
CREATE OR REPLACE FUNCTION my_friend_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code text;
  abc constant text := 'ABCDEFGHJKMNPQRTUVWXYZ2346789';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  SELECT friend_code INTO code FROM profiles WHERE id = auth.uid();
  IF code IS NOT NULL THEN RETURN code; END IF;
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(abc, 1 + floor(random() * length(abc))::int, 1);
    END LOOP;
    BEGIN
      PERFORM set_config('app.privileged_write', 'on', true);
      UPDATE profiles SET friend_code = code WHERE id = auth.uid();
      PERFORM set_config('app.privileged_write', 'off', true);
      RETURN code;
    EXCEPTION WHEN unique_violation THEN
      -- Try another.
    END;
  END LOOP;
END;
$$;

-- Ask to be friends with whoever holds this code. If they already asked
-- you, this accepts.
CREATE OR REPLACE FUNCTION request_friend(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  them uuid;
  f record;
BEGIN
  IF me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first.'); END IF;
  SELECT id INTO them FROM profiles WHERE friend_code = upper(btrim(p_code));
  IF them IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'No one has that code. Check it with your friend.'); END IF;
  IF them = me THEN RETURN jsonb_build_object('ok', false, 'error', 'That is your own code.'); END IF;
  IF (SELECT count(*) FROM friendships WHERE requester = me AND status = 'pending') >= 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You have 20 requests waiting. Wait for some to be answered first.');
  END IF;
  SELECT * INTO f FROM friendships WHERE least(requester, addressee) = least(me, them) AND greatest(requester, addressee) = greatest(me, them);
  IF f.id IS NOT NULL THEN
    IF f.status = 'accepted' THEN RETURN jsonb_build_object('ok', true, 'note', 'You are already friends.'); END IF;
    IF f.addressee = me THEN
      UPDATE friendships SET status = 'accepted', responded_at = now() WHERE id = f.id;
      RETURN jsonb_build_object('ok', true, 'note', 'They had asked you too, so you are friends now.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'note', 'Request already sent.');
  END IF;
  INSERT INTO friendships (requester, addressee) VALUES (me, them);
  RETURN jsonb_build_object('ok', true, 'note', 'Request sent. They will see it on their Friends page.');
END;
$$;

-- Accept or decline a request made to you.
CREATE OR REPLACE FUNCTION respond_friend(p_id uuid, p_accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_accept THEN
    UPDATE friendships SET status = 'accepted', responded_at = now() WHERE id = p_id AND addressee = auth.uid() AND status = 'pending';
  ELSE
    DELETE FROM friendships WHERE id = p_id AND addressee = auth.uid() AND status = 'pending';
  END IF;
END;
$$;

-- Unfriend, or cancel a request you sent. Either side, any time.
CREATE OR REPLACE FUNCTION remove_friend(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM friendships WHERE id = p_id AND auth.uid() IN (requester, addressee);
$$;

-- Your friends and requests, with only a first name and an avatar.
CREATE OR REPLACE FUNCTION my_friends()
RETURNS TABLE (id uuid, friend uuid, first_name text, avatar_url text, status text, incoming boolean, since timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id,
         p.id,
         coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'A friend'),
         p.avatar_url,
         f.status,
         f.addressee = auth.uid(),
         coalesce(f.responded_at, f.created_at)
  FROM friendships f
  JOIN profiles p ON p.id = CASE WHEN f.requester = auth.uid() THEN f.addressee ELSE f.requester END
  WHERE auth.uid() IN (f.requester, f.addressee)
  ORDER BY f.status, coalesce(f.responded_at, f.created_at) DESC;
$$;

-- What friends may see of each other: when they studied over the last
-- 120 days, their daily goal and which weekdays their plan rests. The
-- browser turns it into a streak and minutes with the same code as the
-- student's own (lib/streak.js). Accepted friends only.
CREATE OR REPLACE FUNCTION friends_activity()
RETURNS TABLE (friend uuid, plan jsonb, session_minutes integer, attempts jsonb, sessions jsonb)
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
                   FROM study_sessions s WHERE s.user_id = m.friend AND s.started_at > now() - interval '120 days'), '[]'::jsonb)
  FROM mine m
  JOIN profiles p ON p.id = m.friend;
$$;

REVOKE ALL ON FUNCTION my_friend_code(), request_friend(text), respond_friend(uuid, boolean), remove_friend(uuid), my_friends(), friends_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_friend_code(), request_friend(text), respond_friend(uuid, boolean), remove_friend(uuid), my_friends(), friends_activity() TO authenticated;

COMMIT;
