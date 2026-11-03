-- subtopic_coverage() counted checked questions per subtopic by reading the
-- whole questions table (100+ MB of stems, options and markschemes) on
-- every dashboard load: 3.7 s in the database, 8 s for a student. An index
-- holding only what it groups by, for checked questions only, lets it be
-- answered from the index alone.
--
-- Not in a transaction: CONCURRENTLY builds without locking writes.

CREATE INDEX CONCURRENTLY IF NOT EXISTS questions_verified_subtopic ON questions (subject, subtopic) WHERE verified;
