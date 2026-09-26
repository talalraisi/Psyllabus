# Syllabus context: what to collect, and the prompt for collecting it

## Why this exists

The question generator is currently handed three strings and nothing else:

```
Physics SL  /  Circular motion and gravitation  /  6.1 Circular motion
```

From that it has to guess what the IB actually examines. That guess is the
cause of every complaint we have about the existing bank: questions that do not
belong in the subtopic, questions outside the syllabus, missing hints, weak
distractors, and mark schemes that are absent 99.7% of the time.

A weaker model given the real syllabus context beats a stronger model without
it. This is the cheapest quality win available to us, and everything else in
the pipeline depends on it.

## The copyright line, stated once

We do not reproduce IB past papers or official mark schemes, and we do not
paste subject guide text verbatim into the database or into prompts.

What we collect instead:

- **Factual lists** that are not creative expression: command terms and their
  definitions, assessment objective names, paper structures, durations, mark
  totals, whether a calculator is allowed. These are facts about an exam.
- **Our own summaries** of what a subtopic covers, written in our words from
  the published outline.
- **Our own mark schemes**, written in the IB's *style*, derived from the
  content, never copied.
- **Our own worked examples** of question types that a student would recognise
  as "that could be on the IB" without being IB property.

If you cannot produce a field without copying, leave it null. A null field is
a gap we can fill later. A copied field is a legal problem we cannot remove
once it is in the product.

## Part 1 — Per-subject context

One record per subject (for example "Physics SL"). This is the cheap part:
roughly 130 records for everything, six if we start with your own subjects.

| field | type | what it is |
|---|---|---|
| `subject` | string | Exactly as it appears in `syllabus_content.subject` |
| `curriculum` | string | IB / A-Level / AP |
| `papers` | array | One entry per paper, see below |
| `command_terms` | array | `{term, definition, ao}` for every command term this subject uses |
| `assessment_objectives` | array | `{code, description}` — AO1, AO2, AO3 and what each means here |
| `markscheme_style` | enum | `points` / `criteria` / `none` (see `lib/markscheme.js`) |
| `calculator` | enum | `none` / `allowed` / `required` / `varies_by_paper` |
| `data_booklet` | bool | Is a formula booklet provided in the exam |
| `internal_assessment` | object | `{name, weight_percent, what_it_is}` in our own words |
| `notes` | string | Anything a question writer must know that does not fit above |

Each entry in `papers`:

```json
{
  "name": "Paper 1A",
  "duration_minutes": 60,
  "marks": 30,
  "weight_percent": 20,
  "question_types": ["mcq"],
  "calculator": "none",
  "notes": "Multiple choice only. No marks for working."
}
```

## Part 2 — Per-subtopic context

One record per subtopic. This is the expensive part and the valuable one:
593 records for your six subjects, 9,641 for everything. **Start with your six.**

| field | type | what it is |
|---|---|---|
| `subject` | string | Must match `syllabus_content.subject` exactly |
| `code` | string | The official reference, e.g. `6.1`. Must match `syllabus_content.code` |
| `title` | string | Must match `syllabus_content.subtopic` exactly |
| `understandings` | array of strings | What a student must **know**. Our own wording. 3–8 bullets |
| `skills` | array of strings | What a student must be able to **do**. Verbs, not nouns |
| `exclusions` | array of strings | What is explicitly **not** required. Extremely valuable |
| `command_terms` | array of strings | Which terms are realistically used on this subtopic |
| `ao_mix` | object | `{"AO1": 0.3, "AO2": 0.5, "AO3": 0.2}` — must sum to 1 |
| `formulae` | array | `{expression, name, in_booklet}` — what is available in the exam |
| `papers` | array of strings | Which papers examine this, by `papers[].name` |
| `typical_marks` | object | `{min, max, typical}` for a question on this subtopic |
| `misconceptions` | array | See below. **The single most valuable field** |
| `prerequisites` | array of strings | Codes of subtopics a student needs first |
| `vocabulary` | array | `{term, definition}` — our own definitions, feeds flashcards |
| `worked_example` | object | One question in our own words, see below |
| `confidence` | enum | `high` / `medium` / `low` — how sure are you of this record |
| `sources` | array of strings | Where each claim came from |

### `misconceptions` — why this matters most

A multiple-choice question is only as good as its wrong answers. A distractor
that nobody would pick teaches nothing; a distractor that a real student would
pick, for a reason we can name, turns a wrong answer into a diagnosis.

This field is also what fills `option_feedback`, which is empty on 34% of our
existing MCQs.

```json
{
  "misconception": "Believing orbital speed is inversely proportional to radius",
  "why_students_think_it": "They remember v ∝ 1/r from a different relationship and do not re-derive it",
  "what_it_looks_like": "Answering that doubling the radius halves the speed",
  "correction": "v = √(GM/r), so doubling r divides v by √2, not 2"
}
```

Three to six per subtopic. If you can only produce one that is genuinely
observed rather than invented, produce one. Invented misconceptions are worse
than none, because they generate distractors nobody picks.

### `worked_example`

One question **written by you, in your own words**, that a student would accept
as exam-realistic. Not copied from anywhere.

```json
{
  "question_type": "mcq",
  "stem": "A satellite orbits at radius r. Its orbital radius is increased to 2r. The orbital speed is:",
  "options": ["halved", "divided by √2", "unchanged", "doubled"],
  "correct": "divided by √2",
  "marks": 1,
  "why_each_wrong_option_is_tempting": {
    "halved": "assumes v ∝ 1/r",
    "unchanged": "assumes speed is independent of orbit",
    "doubled": "inverts the relationship entirely"
  },
  "markscheme": null
}
```

For a subject whose `markscheme_style` is `points`, include a `markscheme` as
an array of marking points instead of null.

## Part 3 — Output format and delivery

One JSON file per subject:

```
context/physics-sl.json
context/math-aa-hl.json
context/economics-hl.json
...
```

Shape:

```json
{
  "subject_context": { ... Part 1 ... },
  "subtopics": [ { ... Part 2 ... }, ... ]
}
```

Drop them in `context/` in the repo and the loader will validate every record
against `syllabus_content` before inserting, so a mismatched `code` or `title`
fails loudly rather than silently attaching to the wrong subtopic.

## Part 4 — Order of work

Do not attempt all six subjects at once. Per subject:

1. Produce Part 1 (the subject record). It is one record and it catches
   misunderstandings early.
2. Produce Part 2 for **three subtopics only**. Stop.
3. Run the bake-off: generate questions from those three with each candidate
   model, audit blind, pick the winner.
4. Only then produce the remaining subtopics for that subject.

This order means a mistake in the spec costs three records, not 593.

---

# The research prompt

Paste everything below into a model with web search enabled, once per subject.
Replace the bracketed parts.

---

You are building a structured reference for an IB study tool. Your output is
consumed by a question generator, so precision matters more than prose, and a
missing field is better than a guessed one.

**Subject:** [e.g. Physics SL]
**Curriculum:** IB Diploma
**Subtopics to cover in this pass:** [paste the list of codes and titles, or
write "Part 1 only" if you are producing the subject record]

## What you are producing

A single JSON object matching the schema at the end of this prompt. No prose
before or after it. No markdown fences around it.

## Hard rules

1. **Never reproduce copyrighted material.** Do not quote IB subject guide text
   verbatim. Do not reproduce past paper questions or official mark schemes.
   Everything you write in `understandings`, `skills`, `vocabulary`,
   `worked_example` and `markscheme` must be **your own wording** describing
   what the syllabus covers.
2. **Facts are fine.** Command term definitions, assessment objective names,
   paper durations, mark totals and calculator policies are facts about an
   examination, not creative expression. State them plainly.
3. **Null beats guessing.** If you cannot establish a field from a source you
   trust, set it to null and lower `confidence`. A null is a gap we fill later;
   a confident invention is a question that teaches a student something false.
4. **Cite every subtopic record.** `sources` must list where the content came
   from. "General knowledge of the subject" is an acceptable source only when
   `confidence` is `low`.
5. **Match our identifiers exactly.** `subject`, `code` and `title` must match
   the strings given to you character for character. If a title you find
   differs from the one given, use the one given and note the discrepancy in
   `notes`.

## How to approach each subtopic

Work through these questions in order. Do not skip to the JSON.

**What is actually examined here?** Not what the topic is about in general —
what a student is asked to produce in an exam. "Circular motion" as a field of
physics is enormous; subtopic 6.1 examines a specific and much smaller set of
relationships.

**What is explicitly excluded?** IB guides state what is *not* required, and
this is the highest-value thing you can find. A question about a derivation the
syllabus excludes is worse than no question at all, because it teaches a student
they are behind when they are not. Search specifically for exclusions.

**What does a student get wrong, and why?** Do not invent plausible-sounding
errors. Look for errors that are actually documented — in examiner reports,
in teaching resources, in discussions of common mistakes. For each one, name
the *reasoning* that produces it, not just the wrong answer. A distractor built
from a named reasoning error is a diagnosis; one built from a random wrong
number is noise.

**What command terms apply?** "State" and "evaluate" produce completely
different questions carrying completely different marks. Only list terms that
would realistically appear on this subtopic.

**What is available to the student in the exam?** A formula in the booklet
makes a question about recall pointless and a question about application
sensible. A subject with no calculator cannot be asked for a three-significant-
figure answer to an awkward division.

**What must they already know?** Prerequisites let the planner explain why a
topic is blocking others.

## Quality bar

Before you emit a subtopic record, check:

- Could a teacher of this subject read `understandings` and agree it describes
  what is examined, without spotting anything missing or anything that belongs
  to a different subtopic?
- Is every entry in `exclusions` something you actually found stated, rather
  than something you assume is out of scope?
- Would a real student pick every one of the wrong options in
  `worked_example`, and can you say why for each?
- Does `ao_mix` sum to exactly 1?
- Is `worked_example.stem` answerable from `understandings` alone, using only
  the formulae you listed?

If any answer is no, fix it before moving on.

## Schema

[Paste the two tables from Parts 1 and 2 of the spec here, plus the
`misconceptions` and `worked_example` examples.]

## Output

Emit the JSON object and nothing else.

---

## A note on doing this with a model versus doing it yourself

The subject record (Part 1) is factual and a model with search will do it well.

The subtopic records are only as good as the sources the model finds. For your
own six subjects you know things a search will not surface — which subtopics
your teachers spend three weeks on, what your class got wrong on the last mock,
which exclusions actually matter. Reviewing the model's output for your own
subjects is worth more per minute than anything else in this project, because
every question we generate for two years inherits it.
