-- How many ready-made cards each subtopic has, without fetching the cards.
--
-- The flashcards page loaded every verified preset for a student's subjects
-- in one request. With thousands of cards a subject, the request stopped at
-- its 1,000-row limit and most subjects showed nothing. The page now reads
-- these counts to lay out each subject by topic and subtopic, and fetches a
-- subtopic's cards only when it is studied.
--
-- security_invoker: the view reads flashcard_presets as the caller, so its
-- policy (verified rows only) still applies.

BEGIN;

CREATE OR REPLACE VIEW preset_deck_counts WITH (security_invoker = true) AS
  SELECT subject, topic, subtopic, count(*)::int AS cards
  FROM flashcard_presets
  WHERE verified
  GROUP BY subject, topic, subtopic;

GRANT SELECT ON preset_deck_counts TO anon, authenticated;

COMMIT;
