-- Quiz engine schema for Psyllabus
-- Run in Supabase SQL editor after generated-syllabus.sql

-- Questions tagged to subtopics
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL DEFAULT 'mcq',
  stem TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer JSONB NOT NULL,
  explanation TEXT,
  difficulty NUMERIC(3,2) DEFAULT 0.5,
  source TEXT DEFAULT 'manual',
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_topic_id ON questions(topic_id);

-- Quiz attempts (subtopic, topic, or full-subject)
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  quiz_type TEXT NOT NULL CHECK (quiz_type IN ('subtopic', 'topic', 'subject')),
  predicted_score INT,
  score INT,
  total_questions INT NOT NULL,
  accuracy NUMERIC(5,4),
  timed BOOLEAN DEFAULT false,
  time_limit_seconds INT,
  elapsed_seconds INT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_topic_id ON quiz_attempts(topic_id);

-- Individual question responses within an attempt
CREATE TABLE IF NOT EXISTS question_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_answer JSONB,
  is_correct BOOLEAN NOT NULL,
  time_spent_seconds INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_responses_attempt_id ON question_responses(attempt_id);

-- Extend user_topic_progress for quiz-driven heatmap
ALTER TABLE user_topic_progress
  ADD COLUMN IF NOT EXISTS accuracy NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('untested', 'weak', 'shaky', 'solid')),
  ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_count INT DEFAULT 0;

-- Mistake bank (spaced repetition deck)
CREATE TABLE IF NOT EXISTS mistakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  attempt_id UUID REFERENCES quiz_attempts(id) ON DELETE SET NULL,
  next_review_at TIMESTAMPTZ,
  review_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_mistakes_user_id ON mistakes(user_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_next_review ON mistakes(user_id, next_review_at);

-- Row-level security
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Questions are readable by authenticated users"
  ON questions FOR SELECT TO authenticated USING (verified = true);

CREATE POLICY "Users manage own quiz attempts"
  ON quiz_attempts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own question responses"
  ON question_responses FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts
      WHERE quiz_attempts.id = question_responses.attempt_id
        AND quiz_attempts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quiz_attempts
      WHERE quiz_attempts.id = question_responses.attempt_id
        AND quiz_attempts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own mistakes"
  ON mistakes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
