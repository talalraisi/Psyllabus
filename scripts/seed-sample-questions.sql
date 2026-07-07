-- Sample questions: Math AA HL, subtopic 1.1 - Number
-- Run after 002-quiz-schema.sql

INSERT INTO questions (topic_id, stem, options, correct_answer, explanation, difficulty, source, verified)
SELECT t.id,
  'Which of the following is a rational number?',
  '[{"id":"a","text":"√2"},{"id":"b","text":"π"},{"id":"c","text":"3/4"},{"id":"d","text":"√5"}]'::jsonb,
  '"c"'::jsonb,
  '3/4 can be written as a ratio of two integers, so it is rational.',
  0.2, 'manual', true
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE t.title = 'subtopic 1.1 - Number'
  AND s.name = 'Mathematics: Analysis and Approaches (SL/HL)'
  AND s.syllabus_year = '26/27';

INSERT INTO questions (topic_id, stem, options, correct_answer, explanation, difficulty, source, verified)
SELECT t.id,
  'Express 0.375 as a fraction in simplest form.',
  '[{"id":"a","text":"3/8"},{"id":"b","text":"375/1000"},{"id":"c","text":"3/10"},{"id":"d","text":"37/100"}]'::jsonb,
  '"a"'::jsonb,
  '0.375 = 375/1000 = 3/8 in simplest form.',
  0.3, 'manual', true
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE t.title = 'subtopic 1.1 - Number'
  AND s.name = 'Mathematics: Analysis and Approaches (SL/HL)'
  AND s.syllabus_year = '26/27';

INSERT INTO questions (topic_id, stem, options, correct_answer, explanation, difficulty, source, verified)
SELECT t.id,
  'Which set describes all natural numbers?',
  '[{"id":"a","text":"{..., -2, -1, 0, 1, 2, ...}"},{"id":"b","text":"{1, 2, 3, 4, ...}"},{"id":"c","text":"{0, 1, 2, 3, ...}"},{"id":"d","text":"All numbers that can be written as a/b"}]'::jsonb,
  '"b"'::jsonb,
  'Natural numbers (ℕ) are the positive counting numbers starting from 1.',
  0.2, 'manual', true
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE t.title = 'subtopic 1.1 - Number'
  AND s.name = 'Mathematics: Analysis and Approaches (SL/HL)'
  AND s.syllabus_year = '26/27';

INSERT INTO questions (topic_id, stem, options, correct_answer, explanation, difficulty, source, verified)
SELECT t.id,
  'What is the highest common factor (HCF) of 48 and 72?',
  '[{"id":"a","text":"6"},{"id":"b","text":"12"},{"id":"c","text":"24"},{"id":"d","text":"48"}]'::jsonb,
  '"c"'::jsonb,
  '48 = 2⁴×3 and 72 = 2³×3², so HCF = 2³×3 = 24.',
  0.4, 'manual', true
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE t.title = 'subtopic 1.1 - Number'
  AND s.name = 'Mathematics: Analysis and Approaches (SL/HL)'
  AND s.syllabus_year = '26/27';

INSERT INTO questions (topic_id, stem, options, correct_answer, explanation, difficulty, source, verified)
SELECT t.id,
  'What is the lowest common multiple (LCM) of 12 and 18?',
  '[{"id":"a","text":"6"},{"id":"b","text":"36"},{"id":"c","text":"72"},{"id":"d","text":"216"}]'::jsonb,
  '"b"'::jsonb,
  '12 = 2²×3 and 18 = 2×3², so LCM = 2²×3² = 36.',
  0.4, 'manual', true
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE t.title = 'subtopic 1.1 - Number'
  AND s.name = 'Mathematics: Analysis and Approaches (SL/HL)'
  AND s.syllabus_year = '26/27';

INSERT INTO questions (topic_id, stem, options, correct_answer, explanation, difficulty, source, verified)
SELECT t.id,
  'Which number is irrational?',
  '[{"id":"a","text":"0.25"},{"id":"b","text":"-7"},{"id":"c","text":"√3"},{"id":"d","text":"22/7"}]'::jsonb,
  '"c"'::jsonb,
  '√3 cannot be expressed as a ratio of integers.',
  0.3, 'manual', true
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE t.title = 'subtopic 1.1 - Number'
  AND s.name = 'Mathematics: Analysis and Approaches (SL/HL)'
  AND s.syllabus_year = '26/27';

INSERT INTO questions (topic_id, stem, options, correct_answer, explanation, difficulty, source, verified)
SELECT t.id,
  'Write 5.2 × 10⁻³ in standard form as a decimal.',
  '[{"id":"a","text":"0.0052"},{"id":"b","text":"0.052"},{"id":"c","text":"5200"},{"id":"d","text":"0.00052"}]'::jsonb,
  '"a"'::jsonb,
  '5.2 × 10⁻³ = 5.2 × 0.001 = 0.0052.',
  0.3, 'manual', true
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE t.title = 'subtopic 1.1 - Number'
  AND s.name = 'Mathematics: Analysis and Approaches (SL/HL)'
  AND s.syllabus_year = '26/27';

INSERT INTO questions (topic_id, stem, options, correct_answer, explanation, difficulty, source, verified)
SELECT t.id,
  'Round 3.14159 to 3 significant figures.',
  '[{"id":"a","text":"3.14"},{"id":"b","text":"3.142"},{"id":"c","text":"3.141"},{"id":"d","text":"3.1"}]'::jsonb,
  '"b"'::jsonb,
  'The first three significant figures of 3.14159 are 3, 1, 4 — round the fourth (1) down → 3.142.',
  0.4, 'manual', true
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE t.title = 'subtopic 1.1 - Number'
  AND s.name = 'Mathematics: Analysis and Approaches (SL/HL)'
  AND s.syllabus_year = '26/27';

INSERT INTO questions (topic_id, stem, options, correct_answer, explanation, difficulty, source, verified)
SELECT t.id,
  'Which interval contains all real numbers x such that |x - 3| < 2?',
  '[{"id":"a","text":"(1, 5)"},{"id":"b","text":"[1, 5]"},{"id":"c","text":"(1, 5]"},{"id":"d","text":"(-1, 5)"}]'::jsonb,
  '"a"'::jsonb,
  '|x - 3| < 2 means -2 < x - 3 < 2, so 1 < x < 5.',
  0.5, 'manual', true
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE t.title = 'subtopic 1.1 - Number'
  AND s.name = 'Mathematics: Analysis and Approaches (SL/HL)'
  AND s.syllabus_year = '26/27';

INSERT INTO questions (topic_id, stem, options, correct_answer, explanation, difficulty, source, verified)
SELECT t.id,
  'What is the value of 2³ × 2⁻⁵?',
  '[{"id":"a","text":"2⁻²"},{"id":"b","text":"2⁸"},{"id":"c","text":"2⁻¹⁵"},{"id":"d","text":"4⁻²"}]'::jsonb,
  '"a"'::jsonb,
  'When multiplying powers with the same base, add exponents: 2³⁺⁽⁻⁵⁾ = 2⁻².',
  0.4, 'manual', true
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE t.title = 'subtopic 1.1 - Number'
  AND s.name = 'Mathematics: Analysis and Approaches (SL/HL)'
  AND s.syllabus_year = '26/27';

INSERT INTO questions (topic_id, stem, options, correct_answer, explanation, difficulty, source, verified)
SELECT t.id,
  'Which is the correct prime factorisation of 360?',
  '[{"id":"a","text":"2³ × 3² × 5"},{"id":"b","text":"2² × 3² × 10"},{"id":"c","text":"6 × 60"},{"id":"d","text":"2⁴ × 3 × 5"}]'::jsonb,
  '"a"'::jsonb,
  '360 = 8 × 45 = 2³ × 3² × 5.',
  0.5, 'manual', true
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE t.title = 'subtopic 1.1 - Number'
  AND s.name = 'Mathematics: Analysis and Approaches (SL/HL)'
  AND s.syllabus_year = '26/27';

INSERT INTO questions (topic_id, stem, options, correct_answer, explanation, difficulty, source, verified)
SELECT t.id,
  'Estimate √50 to 1 decimal place.',
  '[{"id":"a","text":"7.0"},{"id":"b","text":"7.1"},{"id":"c","text":"7.5"},{"id":"d","text":"8.0"}]'::jsonb,
  '"b"'::jsonb,
  '√50 is between √49=7 and √64=8. √50 ≈ 7.07, which rounds to 7.1.',
  0.5, 'manual', true
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE t.title = 'subtopic 1.1 - Number'
  AND s.name = 'Mathematics: Analysis and Approaches (SL/HL)'
  AND s.syllabus_year = '26/27';
