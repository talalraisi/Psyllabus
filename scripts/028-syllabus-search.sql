-- Make the syllabus searchable.
--
-- There are 5,914 subtopics and no way to look anything up. A student who
-- wants to know where "integration by parts" sits in their course, or what
-- their exam actually covers on enzymes, has to scroll a subject page and read.
-- That is a reference problem, and it needs no quiz data to solve, which is
-- exactly why it matters: it is something the app can do on day one.
--
-- pg_trgm rather than full text search, because subtopic titles are short
-- fragments rather than prose. Trigrams match partial words and survive
-- spelling that is close but not exact, which is how people actually search.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS syllabus_subtopic_trgm
  ON syllabus_content USING gin (subtopic gin_trgm_ops);

CREATE INDEX IF NOT EXISTS syllabus_topic_trgm
  ON syllabus_content USING gin (topic gin_trgm_ops);

COMMIT;
