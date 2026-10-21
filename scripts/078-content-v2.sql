-- The second question bank, and lessons.
--
-- Questions gain three things. Feedback for the wrong answers a student
-- types, the way multiple choice already has feedback for each wrong option:
-- typing 98 where the answer is 9.9 means the square root was forgotten, and
-- saying so is worth more than "not right". Which model and tier wrote the
-- question, so a problem found in one tier can be traced to every question it
-- wrote. And a retired mark, so the first bank can be switched off subject by
-- subject as the second goes live without deleting the 296 answers students
-- have already given to it.
--
-- Lessons are one per subtopic, shared by every student, written and checked
-- by the same pipeline as the questions. lesson_progress is personal: which
-- of a lesson's "what you should know now" statements a student has shown
-- they can do.

BEGIN;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS wrong_answer_feedback jsonb,
  ADD COLUMN IF NOT EXISTS generator text,
  ADD COLUMN IF NOT EXISTS retired_at timestamptz;

COMMENT ON COLUMN questions.wrong_answer_feedback IS
  'Typed answers a student is likely to give by making a specific mistake: [{answer, feedback}]';
COMMENT ON COLUMN questions.generator IS
  'Model and tier that wrote it, e.g. claude-sonnet-5-5/normal';

CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  curriculum text NOT NULL DEFAULT 'IB',
  subject text NOT NULL,
  topic text NOT NULL,
  subtopic text NOT NULL,

  -- {intro, sections[{heading, body, figure?, check?}], worked_example,
  --  mistakes[], key_terms[{term, definition}]}
  body jsonb NOT NULL,
  -- [{statement, check}]: the "what you should know now" list.
  outcomes jsonb NOT NULL DEFAULT '[]'::jsonb,
  minutes smallint,

  verified boolean NOT NULL DEFAULT false,
  generator text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One lesson per subtopic per course.
CREATE UNIQUE INDEX IF NOT EXISTS lessons_one_per_subtopic ON lessons (subject, subtopic);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- Signed-in students read the checked ones. Nothing writes from a browser:
-- lessons are written by the generator over a direct connection, the same as
-- questions and preset flashcards.
DROP POLICY IF EXISTS "Verified lessons readable when signed in" ON lessons;
CREATE POLICY "Verified lessons readable when signed in" ON lessons
  FOR SELECT TO authenticated USING (verified);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons (id) ON DELETE CASCADE,
  -- Indexes into lessons.outcomes that the student got right.
  outcomes_met smallint[] NOT NULL DEFAULT '{}',
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own lesson progress" ON lesson_progress;
CREATE POLICY "Own lesson progress" ON lesson_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;
