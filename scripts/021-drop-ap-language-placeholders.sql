-- Remove the placeholder rows for the AP language courses.
--
-- The sheet lists those six courses with one broad theme per topic, because the
-- real framework is shared and written out once elsewhere. Migration 020 seeded
-- the full 31 subtopics per course; these leftovers are the sheet's summary
-- rows sitting alongside them, which made AP Spanish look like it had two
-- different Topic 1s.

BEGIN;

DELETE FROM syllabus_content
WHERE curriculum = 'AP'
  AND subject LIKE 'AP % Language and Culture'
  AND topic NOT IN (
    'Topic 1 - Families and Communities',
    'Topic 2 - Language and Culture',
    'Topic 3 - Art and Creativity',
    'Topic 4 - Science and Technology',
    'Topic 5 - Contemporary Life',
    'Topic 6 - Global Contexts'
  );

COMMIT;
