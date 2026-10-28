-- A question you got wrong stays in Redemption when the question itself is
-- retired.
--
-- Rebuilding the question bank retires old questions (retired_at set,
-- verified false). Students cannot read unverified questions, so every
-- mistake pointing at one vanished from Redemption: the gap was still there,
-- but the page had nothing to ask. Now such a mistake moves to a live question
-- on the same subtopic, the same kind where there is one, nearest in
-- difficulty, and never one already in that student's Redemption. Its review
-- schedule is kept. Where the subtopic has no live question it is left as it
-- is, and picked up when one is published.

BEGIN;

CREATE OR REPLACE FUNCTION remap_retired_mistakes(only_question uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  pick uuid;
  moved integer := 0;
BEGIN
  FOR m IN
    SELECT mi.id, mi.user_id, q.subject, q.subtopic, q.question_type, q.difficulty
    FROM mistakes mi
    JOIN questions q ON q.id = mi.question_id
    WHERE (q.retired_at IS NOT NULL OR q.verified IS NOT TRUE)
      AND (only_question IS NULL OR q.id = only_question)
  LOOP
    SELECT x.id INTO pick
    FROM questions x
    WHERE x.subject = m.subject
      AND x.subtopic = m.subtopic
      AND x.verified
      AND x.retired_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM mistakes o WHERE o.user_id = m.user_id AND o.question_id = x.id)
    ORDER BY (x.question_type IS DISTINCT FROM m.question_type), abs(coalesce(x.difficulty, 0.5) - coalesce(m.difficulty, 0.5)), random()
    LIMIT 1;
    IF pick IS NOT NULL THEN
      UPDATE mistakes SET question_id = pick WHERE id = m.id;
      moved := moved + 1;
    END IF;
  END LOOP;
  RETURN moved;
END;
$$;

REVOKE ALL ON FUNCTION remap_retired_mistakes(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION questions_retired_move_mistakes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.retired_at IS NOT NULL OR NEW.verified IS NOT TRUE)
     AND EXISTS (SELECT 1 FROM mistakes WHERE question_id = NEW.id) THEN
    PERFORM remap_retired_mistakes(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS questions_retired_move_mistakes ON questions;
CREATE TRIGGER questions_retired_move_mistakes
  AFTER UPDATE OF retired_at, verified ON questions
  FOR EACH ROW
  WHEN (NEW.retired_at IS DISTINCT FROM OLD.retired_at OR NEW.verified IS DISTINCT FROM OLD.verified)
  EXECUTE FUNCTION questions_retired_move_mistakes();

CREATE INDEX IF NOT EXISTS mistakes_question ON mistakes (question_id);

SELECT remap_retired_mistakes();

COMMIT;
