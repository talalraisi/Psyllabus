# The adaptive engine

Every rule that decides what colour a subtopic is, what a question is worth,
when something starts slipping and what the planner opens next. The code is the
authority; this is the agreement the code implements, written down so that a
change to it is a decision rather than a drift.

It exists because the rules live in four files — `lib/progress.js`,
`lib/decay.js`, `lib/quiz.js`, `lib/planner.js` — and anybody touching one of
them can reinvent a constant from another without noticing. A quietly wrong
threshold does not break anything. It produces a plausible map that is untrue,
for every student, silently.

**If you change a number here, change it here first, then in the code, then in
the test.** Every section below names the file that owns it.

---

## 1. Points — what an answer is worth

Owned by `lib/progress.js`.

A question carries a `difficulty` from 0 to 1. That is banded into five heat
levels, and the heat decides the points a correct answer earns.

| heat | difficulty up to | points | what it means |
| --- | ---: | ---: | --- |
| Low | 0.30 | **0.5** | Recall and one step. You should get these every time. |
| Medium | 0.50 | **0.75** | A couple of steps, or a definition applied to something new. |
| Hot | 0.68 | **1.0** | Multi-step, and it is not obvious which method starts it. |
| Extremely hot | 0.82 | **1.25** | Combines topics, or hides the thing being tested. |
| Burning | 1.00 | **1.5** | The hardest end of the paper. Separates a 6 from a 7. |

Two consequences worth stating, because both are deliberate:

- **An easy run cannot reach the top.** Ten Low questions is 5 points, which is
  Developing. Mastery is not available to somebody who only answers questions
  they find easy, and that is the point of pricing by heat rather than counting
  right answers.
- **Burning is meant to be rare.** If a generated bank is full of Burning
  questions, the bank is wrong, not the student.

## 2. Levels — what the colour means

Owned by `lib/progress.js`. `MASTERY_TARGET` is **10** points.

| points | level | shown as |
| ---: | --- | --- |
| 0 | Untested | grey |
| 0–5 | Weak | red |
| 5–7 | Developing | amber |
| 7–9 | Proficient | green |
| 9+ | Mastered | purple |

**Untested is not a level.** It is the absence of one, and it is grey rather
than green so that a map never claims a student is fine at something nobody has
asked them about. Zero points and "never attempted" are the same state and are
displayed the same way.

Fading is not in this ladder, because it is not earned by a score. See §3.

## 3. Forgetting — when a level is taken back

Owned by `lib/decay.js`. Tested by `scripts/decay-test.mjs`.

Measured from the **last correct answer**, not the last time the row was
written. Any quiz touching a subtopic bumps `updated_at`, including one where
every answer was wrong, so a Fading subtopic could otherwise be cleared by
sitting a quiz and failing it. Retention has to be re-proved, not revisited.

| days since last correct answer | state |
| --- | --- |
| 0 – 14 | holds |
| 14 – 35 | **Fading** — back in the plan for a short retest |
| 35+ | **Weak** — treated as not known |

Constants: `DECAY_DAYS = 14`, `FADE_DAYS = 21`.

**What can fade:** Mastered, Proficient, **and Developing**. Developing was
added because the previous rule implied a half-learned topic left for a month
was in better shape than a mastered one left the same month. It is not.

**What cannot:** Weak has nowhere below it to go, and Untested is not a level to
fall from.

**Nothing is written to the database.** The stored status is what was proved;
decay is what it is worth today, derived at read time. One correct answer
restores it with no migration and no write. This is why the rule can be changed
by editing a constant.

## 4. The queue — what the planner opens next

Owned by `lib/planner.js`. Four inputs, in the order they matter.

1. **Verified weakness** — a subtopic you got wrong outranks one you never tried
2. **Decay** — something proved long ago is slipping
3. **Foundation** — early topics unlock later ones
4. **Time to exam** — as exams approach, breadth beats depth

Status weights: Weak 100, Fading 80, Developing 55, Untested 35, Proficient 20,
Mastered 0.

Note that **Untested ranks below Developing**. Knowing you are shaky at
something is more actionable than not knowing whether you know it, and a plan
that opened with untested material every evening would never finish anything.

**Every item carries its reasons**, and they are shown. A planner a student
cannot argue with is one they stop trusting the first time it is wrong.

## 5. The session — what to do with the time

Owned by `lib/planner.js`. Tested by `scripts/planner-steps-test.mjs`.

`MINUTES_PER_ITEM = 22`. It was 8, which is how long ten multiple-choice
questions take and nothing else. Recovering a subtopic means reading it, sitting
the quiz, and going back over the misses, which is twenty-odd minutes. Eight
made the planner promise five subtopics in forty minutes, so every session ended
looking failed.

The evening is divided equally between the chosen subtopics, and each one's
steps are scaled to its share. The mix differs by **why the subtopic is there**:

| level | the evening |
| --- | --- |
| Weak | Read it → questions → go over the misses |
| Fading | **Straight to questions** → only what you got wrong |
| Untested | Read it → first questions on it |
| Developing | Questions → read up on the gaps |
| Proficient | Quick check → flashcards |
| Mastered | Top-up questions |

**Fading never starts by reading.** You knew it five weeks ago; the memory is in
there and what fixes it is retrieval. Re-reading wastes the evening.

Rounding drift is pushed into the longest step so a session that says forty
minutes adds up to forty.

## 6. Quizzes

Owned by `lib/quiz.js`. `SUBTOPIC_QUESTION_COUNT = 10`.

## What this engine refuses to do

Stated here because every one of these is a thing competitors do, and each was
a decision rather than an omission.

- **It never asks how confident you feel.** There is no self-rating control
  anywhere in the product and there is not going to be one. Students are poor
  judges of what they know, and the ones furthest from understanding something
  are the most likely to overrate it.
- **It does not let an easy run reach the top.** See §1.
- **It does not assume untested means fine.** See §2.
- **It does not keep a green tick forever.** See §3.
- **It does not hide its reasoning.** See §4.

---

## Changing any of this

1. Edit the table here and say why in the commit.
2. Change the constant in the file named in the section.
3. Update or add the test. `decay-test.mjs` and `planner-steps-test.mjs` both
   assert the boundaries directly, and a change that does not move a test is a
   change nobody will notice went wrong.

A wrong number here does not throw. It renders.
