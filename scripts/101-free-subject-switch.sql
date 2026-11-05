-- A free account may switch its free subject, up to five times.
--
-- The free subject was set once and never changed (072-free-plan-guard.sql).
-- Choosing one of six on the first day felt like a trap to the people we
-- asked, so it can now be moved to another of your subjects, five times in
-- all. After that, the way to another subject is to unlock every subject.
-- Five, not unlimited: a free account that could switch at will could work
-- through the whole course a subject at a time.
--
-- The count lives on the profile and, like the free subject itself, only
-- this function can change it; a direct write from the app is put back by the
-- same guard. Progress is never touched: a subject switched away from keeps
-- everything, and opens again exactly as it was.

BEGIN;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS free_switches integer NOT NULL DEFAULT 0 CHECK (free_switches >= 0);

CREATE OR REPLACE FUNCTION public.switch_free_subject(p_subject text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prof profiles%ROWTYPE;
  max_switches constant integer := 5;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'signed_out');
  END IF;

  -- Locked, so two switches at once cannot both pass the count.
  SELECT * INTO prof FROM profiles WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_profile');
  END IF;
  IF prof.free_subject IS NULL THEN
    -- Nothing chosen yet: that is a claim, with its checks, not a switch.
    RETURN jsonb_build_object('ok', false, 'reason', 'not_chosen');
  END IF;
  IF NOT (prof.subjects ? p_subject) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_your_subject');
  END IF;
  IF prof.free_subject = p_subject THEN
    RETURN jsonb_build_object('ok', true, 'subject', p_subject, 'left', greatest(0, max_switches - prof.free_switches));
  END IF;
  IF prof.free_switches >= max_switches THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_switches_left', 'left', 0);
  END IF;

  PERFORM set_config('psyllabus.free_claim', 'on', true);
  UPDATE profiles SET free_subject = p_subject, free_switches = free_switches + 1 WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'subject', p_subject, 'left', max_switches - prof.free_switches - 1);
END;
$$;
REVOKE ALL ON FUNCTION public.switch_free_subject(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.switch_free_subject(text) TO authenticated;

-- As in 072, and the switch count is kept the same way.
CREATE OR REPLACE FUNCTION public.guard_free_subject()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_trusted_profile_writer() OR current_setting('psyllabus.free_claim', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.free_subject := NULL;
    NEW.free_subject_locked_until := NULL;
    NEW.free_switches := 0;
  ELSE
    NEW.free_subject := OLD.free_subject;
    NEW.free_subject_locked_until := OLD.free_subject_locked_until;
    NEW.free_switches := OLD.free_switches;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
