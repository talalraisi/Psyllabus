-- Consent has to be recordable once, and unchangeable after that.
--
-- Migration 035 stopped the client rewriting guardian_consent_at and
-- guardian_consent_text, on the grounds that a consent record a client can
-- forge or backdate is worthless as evidence. That reasoning holds. The
-- implementation did not: it reverted the columns on every update, including
-- the first one, so the record was never written at all.
--
-- The result was worse than the problem. The sign-up form asked for guardian
-- permission, gated the button on it, and then silently discarded the answer:
-- zero of the accounts on the system have a consent record, while the
-- interface implies every one of them does. Under the PDPL, being able to
-- demonstrate consent is the entire point of collecting it, and a checkbox
-- with nothing behind it is the one outcome worse than no checkbox.
--
-- Write-once is the correct rule. NULL to a value is how consent gets
-- recorded; anything else is someone changing history.

BEGIN;

CREATE OR REPLACE FUNCTION protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_trusted_profile_writer() THEN
    RETURN NEW;
  END IF;

  NEW.is_admin           := OLD.is_admin;
  NEW.role               := OLD.role;
  NEW.plan               := OLD.plan;
  NEW.access_source      := OLD.access_source;
  NEW.access_expires_at  := OLD.access_expires_at;
  NEW.access_code_id     := OLD.access_code_id;
  NEW.school_id          := OLD.school_id;

  -- Write-once: recordable while empty, immutable once set. Backdating is
  -- refused outright rather than silently corrected, because a client trying
  -- to choose its own consent timestamp is not a mistake to paper over.
  IF OLD.guardian_consent_at IS NOT NULL THEN
    NEW.guardian_consent_at   := OLD.guardian_consent_at;
    NEW.guardian_consent_text := OLD.guardian_consent_text;
  ELSIF NEW.guardian_consent_at IS NOT NULL THEN
    IF NEW.guardian_consent_at < now() - interval '1 hour'
       OR NEW.guardian_consent_at > now() + interval '1 hour' THEN
      RAISE EXCEPTION 'Consent must be recorded at the time it is given.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Verification is something the server does, never something the client
  -- claims about itself.
  NEW.guardian_verified_at := OLD.guardian_verified_at;

  IF OLD.free_subject_locked_until IS NOT NULL
     AND OLD.free_subject_locked_until > now()
     AND NEW.free_subject IS DISTINCT FROM OLD.free_subject THEN
    NEW.free_subject := OLD.free_subject;
    NEW.free_subject_locked_until := OLD.free_subject_locked_until;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
