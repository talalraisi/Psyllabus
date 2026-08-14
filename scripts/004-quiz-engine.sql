-- Quiz engine aligned to the LIVE schema (text-keyed subject/topic/subtopic,
-- matching syllabus_content and progress). Supersedes 002-quiz-schema.sql,
-- which targeted a UUID topics/subjects schema that was never deployed.
-- Run in the Supabase SQL editor after 003-seed-math-aa-hl.sql.

BEGIN;

-- These tables were never created in production (002 referenced missing
-- tables and could not have run). Drop defensively in case of partial runs.
DROP TABLE IF EXISTS question_responses CASCADE;
DROP TABLE IF EXISTS mistakes CASCADE;
DROP TABLE IF EXISTS quiz_attempts CASCADE;
DROP TABLE IF EXISTS questions CASCADE;

CREATE TABLE questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum text NOT NULL DEFAULT 'IB',
  subject text NOT NULL,
  topic text NOT NULL,
  subtopic text NOT NULL,
  question_type text NOT NULL DEFAULT 'mcq',
  stem text NOT NULL,
  options jsonb NOT NULL,
  correct_answer text NOT NULL,
  explanation text,
  marks int NOT NULL DEFAULT 1,
  time_budget_seconds int NOT NULL DEFAULT 90,
  difficulty numeric(3,2) DEFAULT 0.5,
  source text DEFAULT 'manual',
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_questions_subject_subtopic ON questions (subject, subtopic);
CREATE INDEX idx_questions_subject ON questions (subject);

CREATE TABLE quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text,
  topic text,
  subtopic text,
  quiz_type text NOT NULL CHECK (quiz_type IN ('subtopic', 'topic', 'mock', 'mistakes')),
  predicted_score int,
  score int,
  total_questions int NOT NULL,
  total_marks int,
  accuracy numeric(5,4),
  timed boolean DEFAULT false,
  time_limit_seconds int,
  elapsed_seconds int,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_quiz_attempts_user ON quiz_attempts (user_id, subject);

CREATE TABLE question_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_answer text,
  is_correct boolean NOT NULL,
  time_spent_seconds int,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_question_responses_attempt ON question_responses (attempt_id);

CREATE TABLE mistakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  attempt_id uuid REFERENCES quiz_attempts(id) ON DELETE SET NULL,
  subject text,
  next_review_at timestamptz DEFAULT now(),
  review_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, question_id)
);

CREATE INDEX idx_mistakes_due ON mistakes (user_id, next_review_at);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Verified questions readable by authenticated users"
  ON questions FOR SELECT TO authenticated USING (verified = true);

CREATE POLICY "Users manage own quiz attempts"
  ON quiz_attempts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own question responses"
  ON question_responses FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quiz_attempts
    WHERE quiz_attempts.id = question_responses.attempt_id
      AND quiz_attempts.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM quiz_attempts
    WHERE quiz_attempts.id = question_responses.attempt_id
      AND quiz_attempts.user_id = auth.uid()
  ));

CREATE POLICY "Users manage own mistakes"
  ON mistakes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Seed: 30 verified MCQs for Math Analysis & Approaches HL (3 subtopics x 10)
-- ---------------------------------------------------------------------------

INSERT INTO questions (curriculum, subject, topic, subtopic, stem, options, correct_answer, explanation, marks, time_budget_seconds, difficulty, verified) VALUES
-- Arithmetic sequences and series
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Arithmetic sequences and series',
 'An arithmetic sequence has first term 5 and common difference 3. What is the 10th term?',
 '[{"id":"a","text":"32"},{"id":"b","text":"35"},{"id":"c","text":"29"},{"id":"d","text":"27"}]', 'a',
 'u10 = u1 + 9d = 5 + 9(3) = 32.', 1, 60, 0.3, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Arithmetic sequences and series',
 'Find the sum of the first 20 terms of the series 2 + 5 + 8 + …',
 '[{"id":"a","text":"590"},{"id":"b","text":"610"},{"id":"c","text":"620"},{"id":"d","text":"305"}]', 'b',
 'S20 = 20/2 × (2(2) + 19(3)) = 10 × 61 = 610.', 2, 90, 0.4, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Arithmetic sequences and series',
 'In an arithmetic sequence, u3 = 10 and u7 = 22. What is the first term?',
 '[{"id":"a","text":"3"},{"id":"b","text":"6"},{"id":"c","text":"4"},{"id":"d","text":"7"}]', 'c',
 '4d = u7 − u3 = 12, so d = 3 and u1 = u3 − 2d = 10 − 6 = 4.', 2, 90, 0.5, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Arithmetic sequences and series',
 'An arithmetic series has u1 = 7 and d = −2. Find S15.',
 '[{"id":"a","text":"−105"},{"id":"b","text":"−95"},{"id":"c","text":"105"},{"id":"d","text":"−110"}]', 'a',
 'S15 = 15/2 × (2(7) + 14(−2)) = 15/2 × (−14) = −105.', 2, 90, 0.5, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Arithmetic sequences and series',
 'Which of the following sequences is arithmetic?',
 '[{"id":"a","text":"2, 4, 8, 16"},{"id":"b","text":"3, 7, 11, 15"},{"id":"c","text":"1, 1, 2, 3"},{"id":"d","text":"1, 4, 9, 16"}]', 'b',
 '3, 7, 11, 15 has a constant difference of 4.', 1, 45, 0.2, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Arithmetic sequences and series',
 'For the sequence with u1 = 4 and d = 6, which term equals 100?',
 '[{"id":"a","text":"16th"},{"id":"b","text":"18th"},{"id":"c","text":"15th"},{"id":"d","text":"17th"}]', 'd',
 '4 + (n−1)(6) = 100 gives n − 1 = 16, so n = 17.', 1, 75, 0.4, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Arithmetic sequences and series',
 'What is the sum of the integers from 1 to 100?',
 '[{"id":"a","text":"5050"},{"id":"b","text":"5000"},{"id":"c","text":"4950"},{"id":"d","text":"5150"}]', 'a',
 'S100 = 100 × 101 / 2 = 5050.', 1, 45, 0.2, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Arithmetic sequences and series',
 'An arithmetic series has u1 = 12, last term 40, and 8 terms. Find its sum.',
 '[{"id":"a","text":"216"},{"id":"b","text":"208"},{"id":"c","text":"200"},{"id":"d","text":"224"}]', 'b',
 'S = n(u1 + un)/2 = 8 × 52 / 2 = 208.', 2, 75, 0.4, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Arithmetic sequences and series',
 'What is the arithmetic mean of 8 and 20?',
 '[{"id":"a","text":"12"},{"id":"b","text":"16"},{"id":"c","text":"14"},{"id":"d","text":"13"}]', 'c',
 'The arithmetic mean is (8 + 20)/2 = 14.', 1, 30, 0.2, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Arithmetic sequences and series',
 'In an arithmetic sequence, u5 = 1 and u9 = −11. What is the common difference?',
 '[{"id":"a","text":"−3"},{"id":"b","text":"3"},{"id":"c","text":"−4"},{"id":"d","text":"−2"}]', 'a',
 '4d = u9 − u5 = −12, so d = −3.', 1, 60, 0.4, true),

-- Laws of exponents and logarithms
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Laws of exponents and logarithms',
 'Simplify 2^3 × 2^4.',
 '[{"id":"a","text":"2^12"},{"id":"b","text":"128"},{"id":"c","text":"64"},{"id":"d","text":"4^7"}]', 'b',
 '2^3 × 2^4 = 2^7 = 128.', 1, 45, 0.2, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Laws of exponents and logarithms',
 'Evaluate log10(1000).',
 '[{"id":"a","text":"2"},{"id":"b","text":"4"},{"id":"c","text":"3"},{"id":"d","text":"10"}]', 'c',
 '10^3 = 1000, so log10(1000) = 3.', 1, 30, 0.2, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Laws of exponents and logarithms',
 'Simplify (x^3)^4.',
 '[{"id":"a","text":"x^12"},{"id":"b","text":"x^7"},{"id":"c","text":"x^81"},{"id":"d","text":"4x^3"}]', 'a',
 'Power of a power: multiply the exponents, 3 × 4 = 12.', 1, 45, 0.2, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Laws of exponents and logarithms',
 'Evaluate log2(32).',
 '[{"id":"a","text":"4"},{"id":"b","text":"5"},{"id":"c","text":"6"},{"id":"d","text":"16"}]', 'b',
 '2^5 = 32, so log2(32) = 5.', 1, 45, 0.3, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Laws of exponents and logarithms',
 'Simplify ln(e^5).',
 '[{"id":"a","text":"e^5"},{"id":"b","text":"1/5"},{"id":"c","text":"5"},{"id":"d","text":"5e"}]', 'c',
 'ln and e^x are inverse functions, so ln(e^5) = 5.', 1, 45, 0.3, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Laws of exponents and logarithms',
 'Which expression equals log a + log b?',
 '[{"id":"a","text":"log(ab)"},{"id":"b","text":"log(a + b)"},{"id":"c","text":"log(a/b)"},{"id":"d","text":"log(a^b)"}]', 'a',
 'The product law: log a + log b = log(ab).', 1, 45, 0.3, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Laws of exponents and logarithms',
 'Solve 3^x = 81.',
 '[{"id":"a","text":"3"},{"id":"b","text":"27"},{"id":"c","text":"5"},{"id":"d","text":"4"}]', 'd',
 '81 = 3^4, so x = 4.', 1, 60, 0.3, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Laws of exponents and logarithms',
 'Evaluate 5^0.',
 '[{"id":"a","text":"0"},{"id":"b","text":"1"},{"id":"c","text":"5"},{"id":"d","text":"undefined"}]', 'b',
 'Any non-zero number to the power 0 equals 1.', 1, 30, 0.1, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Laws of exponents and logarithms',
 'Evaluate log3(1/9).',
 '[{"id":"a","text":"−2"},{"id":"b","text":"2"},{"id":"c","text":"−3"},{"id":"d","text":"1/2"}]', 'a',
 '1/9 = 3^(−2), so log3(1/9) = −2.', 2, 60, 0.5, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Laws of exponents and logarithms',
 'Express log(x^2 / y) in terms of log x and log y.',
 '[{"id":"a","text":"2 log x + log y"},{"id":"b","text":"(log x)^2 − log y"},{"id":"c","text":"2 log x − log y"},{"id":"d","text":"log x − 2 log y"}]', 'c',
 'Quotient and power laws: log(x^2/y) = 2 log x − log y.', 2, 75, 0.5, true),

-- Differentiation rules
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Differentiation rules power product quotient chain',
 'Differentiate y = x^5.',
 '[{"id":"a","text":"5x^4"},{"id":"b","text":"x^4"},{"id":"c","text":"5x^5"},{"id":"d","text":"4x^5"}]', 'a',
 'Power rule: d/dx(x^n) = n·x^(n−1).', 1, 30, 0.2, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Differentiation rules power product quotient chain',
 'Differentiate y = 3x^2 + 2x.',
 '[{"id":"a","text":"3x + 2"},{"id":"b","text":"6x + 2"},{"id":"c","text":"6x^2 + 2"},{"id":"d","text":"6x"}]', 'b',
 'Differentiate term by term: 6x + 2.', 1, 45, 0.2, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Differentiation rules power product quotient chain',
 'What is d/dx (sin x)?',
 '[{"id":"a","text":"−cos x"},{"id":"b","text":"−sin x"},{"id":"c","text":"cos x"},{"id":"d","text":"tan x"}]', 'c',
 'The derivative of sin x is cos x.', 1, 30, 0.2, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Differentiation rules power product quotient chain',
 'Differentiate y = e^(2x).',
 '[{"id":"a","text":"2e^(2x)"},{"id":"b","text":"e^(2x)"},{"id":"c","text":"2xe^(2x)"},{"id":"d","text":"e^2"}]', 'a',
 'Chain rule: multiply by the derivative of the exponent, 2.', 1, 45, 0.3, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Differentiation rules power product quotient chain',
 'What is d/dx (ln x) for x > 0?',
 '[{"id":"a","text":"ln x"},{"id":"b","text":"1/x"},{"id":"c","text":"x"},{"id":"d","text":"e^x"}]', 'b',
 'The derivative of ln x is 1/x.', 1, 30, 0.2, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Differentiation rules power product quotient chain',
 'Differentiate y = x sin x.',
 '[{"id":"a","text":"cos x"},{"id":"b","text":"x cos x"},{"id":"c","text":"sin x + x cos x"},{"id":"d","text":"sin x − x cos x"}]', 'c',
 'Product rule: (1)(sin x) + (x)(cos x).', 2, 75, 0.4, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Differentiation rules power product quotient chain',
 'Differentiate y = x / (x + 1).',
 '[{"id":"a","text":"1/(x+1)^2"},{"id":"b","text":"1/(x+1)"},{"id":"c","text":"−1/(x+1)^2"},{"id":"d","text":"x/(x+1)^2"}]', 'a',
 'Quotient rule: ((x+1)(1) − x(1)) / (x+1)^2 = 1/(x+1)^2.', 2, 90, 0.5, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Differentiation rules power product quotient chain',
 'Differentiate y = (x^2 + 1)^3.',
 '[{"id":"a","text":"3(x^2 + 1)^2"},{"id":"b","text":"6x(x^2 + 1)^2"},{"id":"c","text":"2x(x^2 + 1)^3"},{"id":"d","text":"3x^2(x^2 + 1)^2"}]', 'b',
 'Chain rule: 3(x^2+1)^2 × 2x = 6x(x^2+1)^2.', 2, 90, 0.5, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Differentiation rules power product quotient chain',
 'What is d/dx (cos 3x)?',
 '[{"id":"a","text":"−sin 3x"},{"id":"b","text":"3 sin 3x"},{"id":"c","text":"−3 sin 3x"},{"id":"d","text":"−3 cos 3x"}]', 'c',
 'Chain rule: −sin(3x) × 3 = −3 sin 3x.', 1, 60, 0.4, true),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Differentiation rules power product quotient chain',
 'Find the gradient of y = x^2 at x = 3.',
 '[{"id":"a","text":"9"},{"id":"b","text":"3"},{"id":"c","text":"6"},{"id":"d","text":"12"}]', 'c',
 'dy/dx = 2x, so at x = 3 the gradient is 6.', 1, 45, 0.3, true);

COMMIT;
