-- Predicted papers: whole papers in the real format, and students' sittings.
--
-- Until now "sit Paper 2" assembled a paper from the question bank against a
-- rough shape. These are written as papers, section by section, against the
-- blueprint read out of each subject guide (lib/paper-blueprints.json): the
-- same duration, sections, choice of questions and marks per part as the
-- real thing, with an IB-style markscheme. They are written and checked by
-- the generator (scripts/build-papers.mjs) and readable once verified.
--
-- exam_from separates two versions of one course running side by side
-- (History's 2020 and 2028 guides): null means it applies to every year.

BEGIN;

CREATE TABLE IF NOT EXISTS exam_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum text NOT NULL DEFAULT 'IB',
  subject text NOT NULL,
  paper text NOT NULL CHECK (paper IN ('p1', 'p2', 'p3')),
  version smallint NOT NULL DEFAULT 1,
  exam_from smallint,
  name text NOT NULL,
  minutes smallint NOT NULL,
  marks smallint NOT NULL,
  -- {instructions, sections[{name, instructions, answer, from, questions[{number, stimulus, parts[...]}]}]}
  content jsonb NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  generator text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS exam_papers_one_version
  ON exam_papers (subject, paper, version, coalesce(exam_from, 0));

ALTER TABLE exam_papers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Verified papers readable when signed in" ON exam_papers;
CREATE POLICY "Verified papers readable when signed in" ON exam_papers
  FOR SELECT TO authenticated USING (verified);

CREATE TABLE IF NOT EXISTS paper_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  paper_id uuid NOT NULL REFERENCES exam_papers (id) ON DELETE CASCADE,
  -- {"<section>.<question>.<part>": response}, and which optional questions were chosen.
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  chosen jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- {"<part key>": {marks, by: 'auto' | 'self' | 'syllabi', note}}
  marks jsonb NOT NULL DEFAULT '{}'::jsonb,
  score smallint,
  total smallint,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  seconds_used integer
);

CREATE INDEX IF NOT EXISTS paper_attempts_by_user ON paper_attempts (user_id, started_at DESC);

ALTER TABLE paper_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own paper attempts" ON paper_attempts;
CREATE POLICY "Own paper attempts" ON paper_attempts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;
