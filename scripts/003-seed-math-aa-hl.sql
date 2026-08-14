-- Seed syllabus_content for IB Math Analysis & Approaches HL.
-- Run in the Supabase SQL editor. Idempotent: clears this subject first.

BEGIN;

DELETE FROM syllabus_content
WHERE curriculum = 'IB' AND subject = 'Math Analysis & Approaches HL';

INSERT INTO syllabus_content (curriculum, subject, topic, subtopic, hl_only) VALUES
-- Topic 1 - Number and Algebra
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Operations with numbers in scientific notation', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Arithmetic sequences and series', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Geometric sequences and series', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Financial applications of sequences and series', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Laws of exponents and logarithms', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Solving exponential equations', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Binomial theorem for positive integer n', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Proof by mathematical induction', true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Complex numbers', true),
('IB', 'Math Analysis & Approaches HL', 'Topic 1 - Number and Algebra', 'Systems of linear equations using matrices', true),
-- Topic 2 - Functions
('IB', 'Math Analysis & Approaches HL', 'Topic 2 - Functions', 'Concept of a function domain range', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 2 - Functions', 'Linear functions and their graphs', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 2 - Functions', 'Quadratic functions vertex form', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 2 - Functions', 'Rational functions and asymptotes', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 2 - Functions', 'Exponential and logarithmic functions', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 2 - Functions', 'Transformations of graphs', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 2 - Functions', 'Solving equations graphically and analytically', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 2 - Functions', 'Inverse functions', true),
('IB', 'Math Analysis & Approaches HL', 'Topic 2 - Functions', 'Partial fractions', true),
('IB', 'Math Analysis & Approaches HL', 'Topic 2 - Functions', 'Odd and even functions', true),
-- Topic 3 - Geometry and Trigonometry
('IB', 'Math Analysis & Approaches HL', 'Topic 3 - Geometry and Trigonometry', 'Distance midpoint and gradient formulae', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 3 - Geometry and Trigonometry', 'Trigonometric ratios in right triangles', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 3 - Geometry and Trigonometry', 'Sine and cosine rule', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 3 - Geometry and Trigonometry', 'Area of triangle using sine', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 3 - Geometry and Trigonometry', 'Radians arc length and sector area', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 3 - Geometry and Trigonometry', 'Unit circle and exact trigonometric values', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 3 - Geometry and Trigonometry', 'Trigonometric identities Pythagorean and double angle', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 3 - Geometry and Trigonometry', 'Solving trigonometric equations', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 3 - Geometry and Trigonometry', 'Vectors magnitude and direction', true),
('IB', 'Math Analysis & Approaches HL', 'Topic 3 - Geometry and Trigonometry', 'Scalar product and angle between vectors', true),
('IB', 'Math Analysis & Approaches HL', 'Topic 3 - Geometry and Trigonometry', 'Vector equations of lines', true),
('IB', 'Math Analysis & Approaches HL', 'Topic 3 - Geometry and Trigonometry', 'Planes and angles in 3D', true),
-- Topic 4 - Statistics and Probability
('IB', 'Math Analysis & Approaches HL', 'Topic 4 - Statistics and Probability', 'Sampling techniques and bias', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 4 - Statistics and Probability', 'Data presentation histograms box plots', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 4 - Statistics and Probability', 'Measures of central tendency and spread', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 4 - Statistics and Probability', 'Linear correlation Pearson coefficient', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 4 - Statistics and Probability', 'Regression lines', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 4 - Statistics and Probability', 'Probability addition and multiplication rules', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 4 - Statistics and Probability', 'Conditional probability', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 4 - Statistics and Probability', 'Discrete random variables and expected value', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 4 - Statistics and Probability', 'Binomial distribution', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 4 - Statistics and Probability', 'Normal distribution and standardisation', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 4 - Statistics and Probability', 'Hypothesis testing for mean', true),
('IB', 'Math Analysis & Approaches HL', 'Topic 4 - Statistics and Probability', 'Poisson distribution', true),
('IB', 'Math Analysis & Approaches HL', 'Topic 4 - Statistics and Probability', 'Transition matrices', true),
-- Topic 5 - Calculus
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Introduction to limits and derivatives', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Differentiation rules power product quotient chain', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Tangents and normals to curves', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Increasing and decreasing functions', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Local and global maximum and minimum', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Optimisation problems', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Integration as antidifferentiation', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Definite integrals and area under curve', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Kinematics with calculus', false),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Integration by substitution', true),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Integration by parts', true),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'First order differential equations', true),
('IB', 'Math Analysis & Approaches HL', 'Topic 5 - Calculus', 'Maclaurin series', true);

COMMIT;
