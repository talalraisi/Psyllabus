-- Question bank seed: 60 verified questions across 6 subtopics and 3 topics of
-- Math Analysis & Approaches HL. Enough depth to demo subtopic quizzes, topic
-- tests, multi-topic custom papers, timed mocks, and the mistake bank.
--
-- Safe to re-run: ON CONFLICT DO NOTHING relies on the unique stem fingerprint
-- from 006-question-dedup.sql. Run 006 first if you have not already.
--
-- All questions are original content written in exam-board style. No past-paper
-- material is reproduced.

BEGIN;

INSERT INTO questions
  (curriculum, subject, topic, subtopic, stem, options, correct_answer, explanation, marks, time_budget_seconds, difficulty, source, verified)
VALUES

-- ===== Topic 1 · Arithmetic sequences and series =========================
('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Arithmetic sequences and series',
 'An arithmetic sequence has first term 5 and common difference 3. What is the 10th term?',
 '[{"id":"a","text":"32"},{"id":"b","text":"35"},{"id":"c","text":"29"},{"id":"d","text":"27"}]','a',
 'u10 = u1 + 9d = 5 + 9(3) = 32.',1,45,0.3,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Arithmetic sequences and series',
 'Find the sum of the first 20 terms of the series 2 + 5 + 8 + ...',
 '[{"id":"a","text":"590"},{"id":"b","text":"610"},{"id":"c","text":"620"},{"id":"d","text":"305"}]','b',
 'S20 = 20/2 x (2(2) + 19(3)) = 10 x 61 = 610.',2,90,0.4,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Arithmetic sequences and series',
 'In an arithmetic sequence u3 = 10 and u7 = 22. What is the first term?',
 '[{"id":"a","text":"3"},{"id":"b","text":"6"},{"id":"c","text":"4"},{"id":"d","text":"7"}]','c',
 '4d = u7 - u3 = 12 so d = 3, and u1 = u3 - 2d = 10 - 6 = 4.',2,90,0.5,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Arithmetic sequences and series',
 'An arithmetic series has u1 = 7 and d = -2. Find S15.',
 '[{"id":"a","text":"-105"},{"id":"b","text":"-95"},{"id":"c","text":"105"},{"id":"d","text":"-110"}]','a',
 'S15 = 15/2 x (2(7) + 14(-2)) = 15/2 x (-14) = -105.',2,90,0.5,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Arithmetic sequences and series',
 'Which of the following sequences is arithmetic?',
 '[{"id":"a","text":"2, 4, 8, 16"},{"id":"b","text":"3, 7, 11, 15"},{"id":"c","text":"1, 1, 2, 3"},{"id":"d","text":"1, 4, 9, 16"}]','b',
 '3, 7, 11, 15 has a constant common difference of 4.',1,45,0.2,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Arithmetic sequences and series',
 'For the arithmetic sequence with u1 = 4 and d = 6, which term is equal to 100?',
 '[{"id":"a","text":"16th"},{"id":"b","text":"18th"},{"id":"c","text":"15th"},{"id":"d","text":"17th"}]','d',
 '4 + (n-1)(6) = 100 gives n - 1 = 16, so n = 17.',2,75,0.4,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Arithmetic sequences and series',
 'What is the sum of all the integers from 1 to 100 inclusive?',
 '[{"id":"a","text":"5050"},{"id":"b","text":"5000"},{"id":"c","text":"4950"},{"id":"d","text":"5150"}]','a',
 'S100 = 100 x 101 / 2 = 5050.',1,45,0.2,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Arithmetic sequences and series',
 'An arithmetic series has first term 12, last term 40, and 8 terms. Find its sum.',
 '[{"id":"a","text":"216"},{"id":"b","text":"208"},{"id":"c","text":"200"},{"id":"d","text":"224"}]','b',
 'S = n(u1 + un)/2 = 8 x 52 / 2 = 208.',2,75,0.4,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Arithmetic sequences and series',
 'What is the arithmetic mean of 8 and 20?',
 '[{"id":"a","text":"12"},{"id":"b","text":"16"},{"id":"c","text":"14"},{"id":"d","text":"13"}]','c',
 'The arithmetic mean is (8 + 20)/2 = 14.',1,30,0.2,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Arithmetic sequences and series',
 'In an arithmetic sequence u5 = 1 and u9 = -11. What is the common difference?',
 '[{"id":"a","text":"-3"},{"id":"b","text":"3"},{"id":"c","text":"-4"},{"id":"d","text":"-2"}]','a',
 '4d = u9 - u5 = -12, so d = -3.',2,60,0.4,'seed',true),

-- ===== Topic 1 · Geometric sequences and series ==========================
('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Geometric sequences and series',
 'A geometric sequence has first term 3 and common ratio 2. What is the 6th term?',
 '[{"id":"a","text":"96"},{"id":"b","text":"64"},{"id":"c","text":"192"},{"id":"d","text":"48"}]','a',
 'u6 = u1 x r^5 = 3 x 32 = 96.',1,60,0.3,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Geometric sequences and series',
 'What is the common ratio of the sequence 2, 6, 18, 54, ...?',
 '[{"id":"a","text":"2"},{"id":"b","text":"3"},{"id":"c","text":"4"},{"id":"d","text":"6"}]','b',
 'Each term is 3 times the previous one, so r = 3.',1,30,0.2,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Geometric sequences and series',
 'A geometric series has u1 = 5 and r = 3. Find the sum of the first 4 terms.',
 '[{"id":"a","text":"180"},{"id":"b","text":"200"},{"id":"c","text":"195"},{"id":"d","text":"240"}]','b',
 'S4 = 5(3^4 - 1)/(3 - 1) = 5(80)/2 = 200.',2,90,0.5,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Geometric sequences and series',
 'Find the sum to infinity of the series 8 + 4 + 2 + 1 + ...',
 '[{"id":"a","text":"16"},{"id":"b","text":"12"},{"id":"c","text":"20"},{"id":"d","text":"infinite"}]','a',
 'r = 1/2 so S = u1/(1 - r) = 8/0.5 = 16.',2,90,0.5,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Geometric sequences and series',
 'A geometric sequence has u1 = 100 and r = 0.5. What is the 4th term?',
 '[{"id":"a","text":"25"},{"id":"b","text":"6.25"},{"id":"c","text":"12.5"},{"id":"d","text":"50"}]','c',
 'u4 = 100 x (0.5)^3 = 100 x 0.125 = 12.5.',1,60,0.3,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Geometric sequences and series',
 'For which values of r does an infinite geometric series converge?',
 '[{"id":"a","text":"r > 1"},{"id":"b","text":"|r| < 1"},{"id":"c","text":"r < 0"},{"id":"d","text":"|r| > 1"}]','b',
 'An infinite geometric series converges only when the absolute value of r is less than 1.',1,45,0.3,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Geometric sequences and series',
 'In a geometric sequence with positive terms, u2 = 6 and u4 = 54. What is u1?',
 '[{"id":"a","text":"2"},{"id":"b","text":"3"},{"id":"c","text":"1"},{"id":"d","text":"18"}]','a',
 'u4/u2 = r^2 = 9 so r = 3, and u1 = u2/r = 6/3 = 2.',2,90,0.6,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Geometric sequences and series',
 'Find the sum to infinity of 1 + 1/3 + 1/9 + 1/27 + ...',
 '[{"id":"a","text":"3/2"},{"id":"b","text":"2"},{"id":"c","text":"4/3"},{"id":"d","text":"3"}]','a',
 'S = 1/(1 - 1/3) = 1/(2/3) = 3/2.',2,75,0.5,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Geometric sequences and series',
 'What is the common ratio of the sequence 3, -6, 12, -24, ...?',
 '[{"id":"a","text":"2"},{"id":"b","text":"-2"},{"id":"c","text":"-3"},{"id":"d","text":"-1/2"}]','b',
 'Dividing any term by the previous one gives -2.',1,45,0.3,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Geometric sequences and series',
 'A geometric sequence has u1 = 2 and r = 3. Which term equals 162?',
 '[{"id":"a","text":"4th"},{"id":"b","text":"6th"},{"id":"c","text":"5th"},{"id":"d","text":"7th"}]','c',
 '2 x 3^(n-1) = 162 gives 3^(n-1) = 81, so n - 1 = 4 and n = 5.',2,90,0.5,'seed',true),

-- ===== Topic 1 · Laws of exponents and logarithms ========================
('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Laws of exponents and logarithms',
 'Simplify 2^3 x 2^4.',
 '[{"id":"a","text":"2^12"},{"id":"b","text":"128"},{"id":"c","text":"64"},{"id":"d","text":"4^7"}]','b',
 'Add the exponents: 2^3 x 2^4 = 2^7 = 128.',1,45,0.2,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Laws of exponents and logarithms',
 'Evaluate log10(1000).',
 '[{"id":"a","text":"2"},{"id":"b","text":"4"},{"id":"c","text":"3"},{"id":"d","text":"10"}]','c',
 '10^3 = 1000, so the logarithm is 3.',1,30,0.2,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Laws of exponents and logarithms',
 'Simplify (x^3)^4.',
 '[{"id":"a","text":"x^12"},{"id":"b","text":"x^7"},{"id":"c","text":"x^81"},{"id":"d","text":"4x^3"}]','a',
 'A power raised to a power multiplies the exponents: 3 x 4 = 12.',1,45,0.2,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Laws of exponents and logarithms',
 'Evaluate log2(32).',
 '[{"id":"a","text":"4"},{"id":"b","text":"5"},{"id":"c","text":"6"},{"id":"d","text":"16"}]','b',
 '2^5 = 32, so log2(32) = 5.',1,45,0.3,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Laws of exponents and logarithms',
 'Simplify ln(e^5).',
 '[{"id":"a","text":"e^5"},{"id":"b","text":"1/5"},{"id":"c","text":"5"},{"id":"d","text":"5e"}]','c',
 'ln and e^x are inverse functions, so ln(e^5) = 5.',1,45,0.3,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Laws of exponents and logarithms',
 'Which single expression equals log a + log b?',
 '[{"id":"a","text":"log(ab)"},{"id":"b","text":"log(a + b)"},{"id":"c","text":"log(a/b)"},{"id":"d","text":"log(a^b)"}]','a',
 'The product law of logarithms gives log a + log b = log(ab).',1,45,0.3,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Laws of exponents and logarithms',
 'Solve 3^x = 81.',
 '[{"id":"a","text":"3"},{"id":"b","text":"27"},{"id":"c","text":"5"},{"id":"d","text":"4"}]','d',
 '81 = 3^4, so x = 4.',1,60,0.3,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Laws of exponents and logarithms',
 'Evaluate 5^0.',
 '[{"id":"a","text":"0"},{"id":"b","text":"1"},{"id":"c","text":"5"},{"id":"d","text":"undefined"}]','b',
 'Any non-zero number raised to the power 0 equals 1.',1,30,0.1,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Laws of exponents and logarithms',
 'Evaluate log3(1/9).',
 '[{"id":"a","text":"-2"},{"id":"b","text":"2"},{"id":"c","text":"-3"},{"id":"d","text":"1/2"}]','a',
 '1/9 = 3^(-2), so the logarithm is -2.',2,60,0.5,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 1 - Number and Algebra','Laws of exponents and logarithms',
 'Express log(x^2 / y) in terms of log x and log y.',
 '[{"id":"a","text":"2 log x + log y"},{"id":"b","text":"(log x)^2 - log y"},{"id":"c","text":"2 log x - log y"},{"id":"d","text":"log x - 2 log y"}]','c',
 'Apply the quotient and power laws: log(x^2/y) = 2 log x - log y.',2,75,0.5,'seed',true),

-- ===== Topic 2 · Quadratic functions vertex form =========================
('IB','Math Analysis & Approaches HL','Topic 2 - Functions','Quadratic functions vertex form',
 'What is the vertex of the parabola y = (x - 3)^2 + 5?',
 '[{"id":"a","text":"(3, 5)"},{"id":"b","text":"(-3, 5)"},{"id":"c","text":"(3, -5)"},{"id":"d","text":"(5, 3)"}]','a',
 'In vertex form y = a(x - h)^2 + k the vertex is (h, k) = (3, 5).',1,45,0.2,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 2 - Functions','Quadratic functions vertex form',
 'Write y = x^2 - 6x + 11 in vertex form.',
 '[{"id":"a","text":"(x - 3)^2 + 2"},{"id":"b","text":"(x - 3)^2 - 2"},{"id":"c","text":"(x + 3)^2 + 2"},{"id":"d","text":"(x - 6)^2 + 11"}]','a',
 'Completing the square: x^2 - 6x + 9 + 2 = (x - 3)^2 + 2.',2,90,0.5,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 2 - Functions','Quadratic functions vertex form',
 'What is the minimum value of y = 2(x + 1)^2 - 7?',
 '[{"id":"a","text":"-1"},{"id":"b","text":"7"},{"id":"c","text":"-7"},{"id":"d","text":"2"}]','c',
 'The squared term is at least 0, so the minimum is -7 when x = -1.',1,60,0.3,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 2 - Functions','Quadratic functions vertex form',
 'What is the axis of symmetry of y = (x + 4)^2 - 1?',
 '[{"id":"a","text":"x = 4"},{"id":"b","text":"x = -4"},{"id":"c","text":"x = -1"},{"id":"d","text":"x = 1"}]','b',
 'The axis of symmetry passes through the vertex at x = -4.',1,45,0.3,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 2 - Functions','Quadratic functions vertex form',
 'What is the maximum value of y = -(x - 2)^2 + 9?',
 '[{"id":"a","text":"2"},{"id":"b","text":"-9"},{"id":"c","text":"9"},{"id":"d","text":"no maximum"}]','c',
 'The negative coefficient means the parabola opens downward, so the vertex value 9 is the maximum.',1,60,0.3,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 2 - Functions','Quadratic functions vertex form',
 'The parabola y = (x - 1)(x - 5) has roots at x = 1 and x = 5. What is the x-coordinate of its vertex?',
 '[{"id":"a","text":"2"},{"id":"b","text":"4"},{"id":"c","text":"3"},{"id":"d","text":"5"}]','c',
 'The vertex lies midway between the roots: (1 + 5)/2 = 3.',2,75,0.4,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 2 - Functions','Quadratic functions vertex form',
 'Find the vertex of y = x^2 + 4x + 7.',
 '[{"id":"a","text":"(-2, 3)"},{"id":"b","text":"(2, 3)"},{"id":"c","text":"(-2, 7)"},{"id":"d","text":"(-4, 7)"}]','a',
 'Completing the square gives (x + 2)^2 + 3, so the vertex is (-2, 3).',2,90,0.5,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 2 - Functions','Quadratic functions vertex form',
 'How many distinct real roots does y = x^2 - 4x + 4 have?',
 '[{"id":"a","text":"0"},{"id":"b","text":"1"},{"id":"c","text":"2"},{"id":"d","text":"3"}]','b',
 'The discriminant is 16 - 16 = 0, so there is exactly one repeated root.',2,75,0.5,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 2 - Functions','Quadratic functions vertex form',
 'What is the y-intercept of y = 3(x - 2)^2 + 1?',
 '[{"id":"a","text":"1"},{"id":"b","text":"13"},{"id":"c","text":"7"},{"id":"d","text":"12"}]','b',
 'Substituting x = 0 gives 3(4) + 1 = 13.',2,75,0.4,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 2 - Functions','Quadratic functions vertex form',
 'For y = a(x - h)^2 + k, the parabola opens downward when:',
 '[{"id":"a","text":"a > 0"},{"id":"b","text":"a < 0"},{"id":"c","text":"k < 0"},{"id":"d","text":"h < 0"}]','b',
 'A negative leading coefficient makes the parabola open downward.',1,45,0.2,'seed',true),

-- ===== Topic 5 · Differentiation rules ===================================
('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Differentiation rules power product quotient chain',
 'Differentiate y = x^5.',
 '[{"id":"a","text":"5x^4"},{"id":"b","text":"x^4"},{"id":"c","text":"5x^5"},{"id":"d","text":"4x^5"}]','a',
 'Power rule: the derivative of x^n is n x^(n-1).',1,30,0.2,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Differentiation rules power product quotient chain',
 'Differentiate y = 3x^2 + 2x.',
 '[{"id":"a","text":"3x + 2"},{"id":"b","text":"6x + 2"},{"id":"c","text":"6x^2 + 2"},{"id":"d","text":"6x"}]','b',
 'Differentiate term by term to get 6x + 2.',1,45,0.2,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Differentiation rules power product quotient chain',
 'What is the derivative of sin x?',
 '[{"id":"a","text":"-cos x"},{"id":"b","text":"-sin x"},{"id":"c","text":"cos x"},{"id":"d","text":"tan x"}]','c',
 'The derivative of sin x is cos x.',1,30,0.2,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Differentiation rules power product quotient chain',
 'Differentiate y = e^(2x).',
 '[{"id":"a","text":"2e^(2x)"},{"id":"b","text":"e^(2x)"},{"id":"c","text":"2xe^(2x)"},{"id":"d","text":"e^2"}]','a',
 'Chain rule: multiply by the derivative of the exponent, which is 2.',1,45,0.3,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Differentiation rules power product quotient chain',
 'What is the derivative of ln x for x > 0?',
 '[{"id":"a","text":"ln x"},{"id":"b","text":"1/x"},{"id":"c","text":"x"},{"id":"d","text":"e^x"}]','b',
 'The derivative of ln x is 1/x.',1,30,0.2,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Differentiation rules power product quotient chain',
 'Differentiate y = x sin x.',
 '[{"id":"a","text":"cos x"},{"id":"b","text":"x cos x"},{"id":"c","text":"sin x + x cos x"},{"id":"d","text":"sin x - x cos x"}]','c',
 'Product rule: (1)(sin x) + (x)(cos x) = sin x + x cos x.',2,75,0.4,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Differentiation rules power product quotient chain',
 'Differentiate y = x / (x + 1).',
 '[{"id":"a","text":"1/(x+1)^2"},{"id":"b","text":"1/(x+1)"},{"id":"c","text":"-1/(x+1)^2"},{"id":"d","text":"x/(x+1)^2"}]','a',
 'Quotient rule: ((x+1)(1) - x(1))/(x+1)^2 = 1/(x+1)^2.',2,90,0.5,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Differentiation rules power product quotient chain',
 'Differentiate y = (x^2 + 1)^3.',
 '[{"id":"a","text":"3(x^2 + 1)^2"},{"id":"b","text":"6x(x^2 + 1)^2"},{"id":"c","text":"2x(x^2 + 1)^3"},{"id":"d","text":"3x^2(x^2 + 1)^2"}]','b',
 'Chain rule: 3(x^2+1)^2 x 2x = 6x(x^2+1)^2.',2,90,0.5,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Differentiation rules power product quotient chain',
 'What is the derivative of cos(3x)?',
 '[{"id":"a","text":"-sin(3x)"},{"id":"b","text":"3 sin(3x)"},{"id":"c","text":"-3 sin(3x)"},{"id":"d","text":"-3 cos(3x)"}]','c',
 'Chain rule: -sin(3x) x 3 = -3 sin(3x).',2,60,0.4,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Differentiation rules power product quotient chain',
 'Find the gradient of the curve y = x^2 at the point where x = 3.',
 '[{"id":"a","text":"9"},{"id":"b","text":"3"},{"id":"c","text":"6"},{"id":"d","text":"12"}]','c',
 'dy/dx = 2x, so at x = 3 the gradient is 6.',1,45,0.3,'seed',true),

-- ===== Topic 5 · Integration as antidifferentiation ======================
('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Integration as antidifferentiation',
 'Find the integral of x^3 with respect to x.',
 '[{"id":"a","text":"3x^2 + C"},{"id":"b","text":"x^4/4 + C"},{"id":"c","text":"x^4 + C"},{"id":"d","text":"4x^4 + C"}]','b',
 'Increase the power by one and divide by the new power: x^4/4 + C.',1,45,0.3,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Integration as antidifferentiation',
 'Find the integral of 2x with respect to x.',
 '[{"id":"a","text":"x^2 + C"},{"id":"b","text":"2x^2 + C"},{"id":"c","text":"2 + C"},{"id":"d","text":"x^2/2 + C"}]','a',
 'The antiderivative of 2x is x^2 + C.',1,30,0.2,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Integration as antidifferentiation',
 'Find the integral of cos x with respect to x.',
 '[{"id":"a","text":"-sin x + C"},{"id":"b","text":"sin x + C"},{"id":"c","text":"-cos x + C"},{"id":"d","text":"tan x + C"}]','b',
 'Since the derivative of sin x is cos x, the integral of cos x is sin x + C.',1,45,0.3,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Integration as antidifferentiation',
 'Find the integral of e^x with respect to x.',
 '[{"id":"a","text":"x e^x + C"},{"id":"b","text":"e^x/x + C"},{"id":"c","text":"e^x + C"},{"id":"d","text":"e^(x+1) + C"}]','c',
 'e^x is its own antiderivative, giving e^x + C.',1,30,0.2,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Integration as antidifferentiation',
 'Find the integral of 1/x with respect to x, for x > 0.',
 '[{"id":"a","text":"ln x + C"},{"id":"b","text":"-1/x^2 + C"},{"id":"c","text":"x^0 + C"},{"id":"d","text":"1/(2x^2) + C"}]','a',
 'The antiderivative of 1/x is the natural logarithm, ln x + C.',1,45,0.3,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Integration as antidifferentiation',
 'Find the integral of (3x^2 + 2) with respect to x.',
 '[{"id":"a","text":"6x + C"},{"id":"b","text":"x^3 + 2x + C"},{"id":"c","text":"x^3 + 2 + C"},{"id":"d","text":"3x^3 + 2x + C"}]','b',
 'Integrate term by term: x^3 + 2x + C.',2,60,0.4,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Integration as antidifferentiation',
 'Find the integral of the constant 5 with respect to x.',
 '[{"id":"a","text":"5 + C"},{"id":"b","text":"0 + C"},{"id":"c","text":"5x + C"},{"id":"d","text":"x/5 + C"}]','c',
 'The antiderivative of a constant k is kx + C, so the answer is 5x + C.',1,30,0.2,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Integration as antidifferentiation',
 'Find the integral of sin x with respect to x.',
 '[{"id":"a","text":"cos x + C"},{"id":"b","text":"-cos x + C"},{"id":"c","text":"-sin x + C"},{"id":"d","text":"sec x + C"}]','b',
 'The derivative of -cos x is sin x, so the integral is -cos x + C.',1,45,0.3,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Integration as antidifferentiation',
 'Find the integral of x^(-2) with respect to x.',
 '[{"id":"a","text":"-1/x + C"},{"id":"b","text":"1/x + C"},{"id":"c","text":"-2x^(-3) + C"},{"id":"d","text":"x^(-1) + C"}]','a',
 'Using the power rule: x^(-1)/(-1) + C = -1/x + C.',2,75,0.5,'seed',true),

('IB','Math Analysis & Approaches HL','Topic 5 - Calculus','Integration as antidifferentiation',
 'Given dy/dx = 4x and y = 3 when x = 0, find y in terms of x.',
 '[{"id":"a","text":"y = 2x^2"},{"id":"b","text":"y = 4x^2 + 3"},{"id":"c","text":"y = 2x^2 + 3"},{"id":"d","text":"y = 2x^2 - 3"}]','c',
 'Integrating gives y = 2x^2 + C, and y = 3 at x = 0 gives C = 3.',2,90,0.5,'seed',true)

ON CONFLICT DO NOTHING;

COMMIT;

-- Verify:  SELECT topic, subtopic, count(*) FROM questions GROUP BY 1,2 ORDER BY 1,2;
