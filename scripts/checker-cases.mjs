/**
 * The six questions that decide whether a model may be trusted to check others.
 *
 * Two of them are real failures, with the answers that were actually stored in
 * the bank. Four are correct, and they matter more than they look: a checker
 * that rejects everything would "catch" both bad ones while quietly destroying
 * a working bank, and only the good cases expose that.
 *
 * Shared by verify-selftest, which reports the score, and recheck, which
 * refuses to unpublish anything if the score is not perfect.
 */

export const CASES = [
  {
    name: "geostationary speed (was wrong in the bank)",
    shouldPass: false,
    question: {
      question_type: "short_answer",
      answer_kind: "number",
      stem: "A satellite orbits Earth in a geostationary orbit of radius 4.22 x 10^7 m. Calculate its orbital speed in km/h.",
      accepted_answers: ["3071"],
    },
  },
  {
    name: "centripetal force (was wrong in the bank)",
    shouldPass: false,
    question: {
      question_type: "short_answer",
      answer_kind: "number",
      stem: "A 2.0 kg mass moves in a circle of radius 0.50 m at a constant speed of 3.0 m/s. Calculate the centripetal force in N.",
      accepted_answers: ["900"],
    },
  },
  {
    name: "centripetal force, correct answer",
    shouldPass: true,
    question: {
      question_type: "short_answer",
      answer_kind: "number",
      stem: "A 2.0 kg mass moves in a circle of radius 0.50 m at a constant speed of 3.0 m/s. Calculate the centripetal force in N.",
      accepted_answers: ["36"],
    },
  },
  {
    name: "kinetic energy, correct answer",
    shouldPass: true,
    question: {
      question_type: "short_answer",
      answer_kind: "number",
      stem: "A 4.0 kg object moves at 5.0 m/s. Calculate its kinetic energy in J.",
      accepted_answers: ["50"],
    },
  },
  {
    name: "MCQ derivative, correct answer",
    shouldPass: true,
    question: {
      question_type: "mcq",
      stem: "What is the derivative of f(x) = 3x^2 + 2x with respect to x?",
      options: [
        { id: "a", text: "6x + 2" },
        { id: "b", text: "3x + 2" },
        { id: "c", text: "6x" },
        { id: "d", text: "x^3 + x^2" },
      ],
      correct_answer: "a",
    },
  },
  {
    name: "MCQ derivative, wrong option marked",
    shouldPass: false,
    question: {
      question_type: "mcq",
      stem: "What is the derivative of f(x) = 3x^2 + 2x with respect to x?",
      options: [
        { id: "a", text: "6x + 2" },
        { id: "b", text: "3x + 2" },
        { id: "c", text: "6x" },
        { id: "d", text: "x^3 + x^2" },
      ],
      correct_answer: "c",
    },
  },
];
