-- Some content is studied by everyone, in more depth at HL.
--
-- hl_only answers "is this subtopic HL's alone?". It cannot express the far
-- more common case in the 2025 science guides: the same subtopic, taken
-- further at HL. Simple harmonic motion is on both courses; HL also derives
-- the equations. With one flag, that subtopic is either missing from SL (wrong
-- — SL sits questions on it) or identical for both (also wrong — HL depth
-- leaks into SL tests, which is the failure a student notices in an exam).
--
-- So a second flag, meaningful only on an HL subject's rows: this subtopic is
-- shared with SL, and the part beyond SL is the HL extension.

BEGIN;

ALTER TABLE syllabus_content
  ADD COLUMN IF NOT EXISTS hl_extension boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN syllabus_content.hl_extension IS
  'HL studies this shared subtopic in greater depth. Never true when hl_only is true.';

ALTER TABLE syllabus_content
  DROP CONSTRAINT IF EXISTS syllabus_content_hl_flags_check;
ALTER TABLE syllabus_content
  ADD CONSTRAINT syllabus_content_hl_flags_check
  CHECK (NOT (hl_only AND hl_extension));

COMMIT;
