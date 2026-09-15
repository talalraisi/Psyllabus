-- Ready-made decks, one per subtopic.
--
-- The flashcards table is personal: every row carries a user_id, a Leitner box
-- and a due date, because those belong to one student's memory and nobody
-- else's. A preset deck is the opposite — one set of cards that every student
-- studying that subtopic sees.
--
-- So they are separate tables, and starting a preset deck copies its cards
-- into the student's own. That copy is the point: from then on the scheduling
-- is theirs, they can delete a card they find useless, and editing the preset
-- later does not silently reshuffle work somebody is halfway through.
--
-- Cards are written by the generator and checked the same way questions are —
-- a second model is shown the front alone and has to produce the back — so the
-- verified flag means the same thing here as it does there.

BEGIN;

CREATE TABLE IF NOT EXISTS flashcard_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  curriculum text NOT NULL DEFAULT 'IB',
  subject text NOT NULL,
  topic text NOT NULL,
  subtopic text NOT NULL,

  front text NOT NULL CHECK (char_length(btrim(front)) BETWEEN 1 AND 300),
  back text NOT NULL CHECK (char_length(btrim(back)) BETWEEN 1 AND 1000),

  -- Ordering within a subtopic's deck, so a deck can open with its definitions
  -- before its applications rather than in whatever order it was written.
  position double precision NOT NULL DEFAULT 0,

  -- Same meaning as on questions: a second model was shown the front alone and
  -- produced a back that matched. Nothing unverified is ever served.
  verified boolean NOT NULL DEFAULT false,

  source text NOT NULL DEFAULT 'ai-generated',
  -- What the front looked like, normalised, so the same card cannot be written
  -- twice for one subtopic across separate runs.
  front_fingerprint text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS flashcard_presets_unique_front
  ON flashcard_presets (subject, subtopic, front_fingerprint)
  WHERE front_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS flashcard_presets_lookup
  ON flashcard_presets (subject, subtopic, position)
  WHERE verified;

ALTER TABLE flashcard_presets ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can read the verified ones. Nobody can write from a
-- browser: these are written by the generator over a direct connection, the
-- same as questions.
DROP POLICY IF EXISTS "Anyone reads verified presets" ON flashcard_presets;
CREATE POLICY "Anyone reads verified presets" ON flashcard_presets
  FOR SELECT USING (verified);

/**
 * Take a preset deck into your own cards.
 *
 * Definer because it reads a table the caller can only see the verified rows
 * of, and writes to one where every row must carry their own id. Returns how
 * many were added, so the page can say "12 added" rather than guessing.
 *
 * Cards the student already has are skipped by front text, so pressing the
 * button twice adds nothing the second time and a deck that gained new cards
 * since can be topped up without duplicating the rest.
 */
CREATE OR REPLACE FUNCTION public.start_preset_deck(p_subject text, p_subtopic text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  added integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO flashcards (user_id, subject, topic, subtopic, front, back, source, box, due_at, reviews, lapses)
  SELECT auth.uid(), p.subject, p.topic, p.subtopic, p.front, p.back, 'preset', 1, now(), 0, 0
  FROM flashcard_presets p
  WHERE p.subject = p_subject
    AND p.subtopic = p_subtopic
    AND p.verified
    AND NOT EXISTS (
      SELECT 1 FROM flashcards f
      WHERE f.user_id = auth.uid()
        AND f.subject = p.subject
        AND f.front = p.front
    );

  GET DIAGNOSTICS added = ROW_COUNT;
  RETURN added;
END;
$$;

REVOKE ALL ON FUNCTION public.start_preset_deck(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.start_preset_deck(text, text) TO authenticated;

COMMIT;
