-- Syllabi turning a student's notes (pasted, or up to three photos, PDFs or
-- text files) into flashcards, with its own allowance.
--
-- Haiku 5.5 reading at most twenty PDF pages, three photos and 30k
-- characters of text (~85k tokens in) and writing at most 6,000 tokens of
-- cards: about $0.012. Reserved at $0.015, eight a day, two a minute.

BEGIN;
INSERT INTO ai_limits (task, per_day, per_minute, worst_cost_micro) VALUES
  ('notes_cards', 8, 2, 15000)
ON CONFLICT (task) DO NOTHING;

-- Cards Syllabi wrote from a student's notes say so, apart from ones typed.
ALTER TABLE flashcards DROP CONSTRAINT IF EXISTS flashcards_source_check;
ALTER TABLE flashcards ADD CONSTRAINT flashcards_source_check
  CHECK (source = ANY (ARRAY['manual', 'note', 'question', 'preset', 'syllabi']));
COMMIT;
