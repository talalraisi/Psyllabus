-- A syllabus has three levels, and we were storing two.
--
-- The guides go theme -> numbered unit -> assessable point: A. Space, time and
-- motion, then A.2 Forces and momentum, then conservation of linear momentum.
-- Flattening that put ninety subtopics in one list under a theme, which is
-- both harder to scan and further from how a teacher talks: nobody says "the
-- momentum part of theme A", they say A.2.
--
-- unit is the middle heading, code is the guide's own numbering for it, and
-- position keeps the syllabus in the guide's order rather than alphabetical —
-- kinematics comes before momentum on every paper ever set, and sorting by
-- name has been quietly reordering the course.
--
-- All three are nullable: the older curricula (AP, A-Level) still carry
-- two-level maps and must keep working untouched until they are redone.

BEGIN;

ALTER TABLE syllabus_content
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS position integer;

CREATE INDEX IF NOT EXISTS idx_syllabus_content_order
  ON syllabus_content (subject, position);

COMMENT ON COLUMN syllabus_content.unit IS
  'Middle level: the guide''s numbered unit within a topic. Null on two-level maps.';
COMMENT ON COLUMN syllabus_content.code IS
  'The guide''s own numbering for the unit, e.g. A.2 or 3.6.';
COMMENT ON COLUMN syllabus_content.position IS
  'Order within the subject, following the guide. Null sorts last.';

COMMIT;
