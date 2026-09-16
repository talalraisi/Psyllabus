-- 'preset' is a way a card can arrive.
--
-- flashcards.source records where a card came from: typed by hand, pulled out
-- of a note, or made from a question you got wrong. Ready-made decks are a
-- fourth way, and the constraint did not know about it — so start_preset_deck()
-- failed on its first insert, every time, for everybody.
--
-- The value is worth keeping distinct rather than filing under 'manual'. A
-- card somebody wrote themselves and a card they accepted from a deck are not
-- the same thing: it is the difference between "I chose these words" and "I
-- agreed with these words", and a student wondering where a card came from
-- deserves the honest answer.

BEGIN;

ALTER TABLE flashcards DROP CONSTRAINT IF EXISTS flashcards_source_check;

ALTER TABLE flashcards
  ADD CONSTRAINT flashcards_source_check
  CHECK (source = ANY (ARRAY['manual'::text, 'note'::text, 'question'::text, 'preset'::text]));

COMMIT;
