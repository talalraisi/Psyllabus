-- The full marking criteria Syllabi marks drafts against: band descriptors
-- and clarifications cut from the IB subject guides by
-- scripts/marking-rubrics.mjs. The guide text is the IB's, so it lives only
-- here, never in the repository.
--
-- No policies: nothing reads the table directly. marking_rubric() hands one
-- section to a signed-in student with Syllabi, which is what the marking
-- route runs as.

BEGIN;

CREATE TABLE IF NOT EXISTS marking_rubrics (
  key text PRIMARY KEY,
  source text NOT NULL,
  body text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE marking_rubrics ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION marking_rubric(p_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT body FROM marking_rubrics
  WHERE key = p_key
    AND auth.uid() IS NOT NULL
$$;

REVOKE ALL ON FUNCTION marking_rubric(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION marking_rubric(text) TO authenticated;

COMMIT;
