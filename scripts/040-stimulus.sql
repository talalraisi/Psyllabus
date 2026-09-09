-- Literature questions have to carry the text they are about.
--
-- Three failures with one cause. A question asking how Morrison's
-- stream-of-consciousness works in Beloved is unanswerable unless you happen
-- to study Beloved, and IB English A has no fixed text list: every school
-- picks its own works, so naming one makes the question useless to most
-- students. A question with no text at all collapses into vocabulary recall
-- -- "which of these four is allusion" -- which is not what the subject
-- assesses. And a question that says "the passage shows" with no passage is
-- simply broken.
--
-- The fix is the same for all three: the extract lives in the question. An
-- original passage, written for the question, means any student can answer it
-- whatever their school teaches, it tests analysis rather than whether they
-- read the right novel, and nothing published is reproduced, which keeps the
-- bank clear of copyright.
--
-- Paper 1 in the real exam is guided analysis of an unseen text. A question
-- carrying its own extract is the only shape that resembles it.

BEGIN;

ALTER TABLE questions
  -- The extract the question is about: a poem, a paragraph of prose, a piece
  -- of dialogue. Original, never reproduced from a published work.
  ADD COLUMN IF NOT EXISTS stimulus text,
  -- 'prose' | 'poem' | 'dialogue' | 'nonfiction'. Drives how it is typeset:
  -- a poem whose line breaks are lost is no longer a poem.
  ADD COLUMN IF NOT EXISTS stimulus_kind text;

COMMENT ON COLUMN questions.stimulus IS
  'Original extract the question is about. Never copied from a published work.';

CREATE INDEX IF NOT EXISTS questions_with_stimulus
  ON questions (subject, subtopic) WHERE stimulus IS NOT NULL;

COMMIT;
