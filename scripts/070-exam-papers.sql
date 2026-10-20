-- Exam papers can be marked: Paper 1 and Paper 2 answers, alongside the IA,
-- the EE and the TOK essay. A paper answer is marked against the question it
-- answers (and, for a Language A Paper 1, the extract), so that is kept with
-- the marking. The question adds up to ~8,000 characters to what a review
-- reads, so its reservation rises to keep being a true ceiling.

BEGIN;

ALTER TABLE syllabi_marks DROP CONSTRAINT IF EXISTS syllabi_marks_kind_check;
ALTER TABLE syllabi_marks ADD CONSTRAINT syllabi_marks_kind_check CHECK (kind IN ('ia', 'ee', 'tok', 'p1', 'p2'));
ALTER TABLE syllabi_marks ADD COLUMN IF NOT EXISTS question text CHECK (question IS NULL OR char_length(question) <= 8000);

UPDATE ai_limits SET worst_cost_micro = 200000 WHERE task = 'draft_feedback';

COMMIT;
