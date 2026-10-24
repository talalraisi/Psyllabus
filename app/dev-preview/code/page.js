'use client'

/** Code in Computer Science questions, as a student sees it. Development only. */

import { notFound } from 'next/navigation'
import QuestionStimulus from '@/components/QuestionStimulus'
import CodeText from '@/components/CodeText'

const ENABLED = process.env.NODE_ENV !== 'production'
const CS = 'Computer Science HL'

const SAMPLES = [
  {
    stimulus: "static char shift(char c, int k) {\n    return (char)('a' + (c - 'a' + k) % 26);\n}\n\nNote: in Java, the result of the % operator has the same sign as its left-hand operand (for example, -2 % 26 evaluates to -2).",
    stem: 'A Java method shifts a lowercase letter by k places in the alphabet, wrapping round. Determine the sum of the character codes returned for \'b\', \'a\' and \'t\'.',
  },
  {
    stimulus: 'input x\nIF x > 50 THEN\n  y = x - 12\nELSE\n  y = x + 12\nENDIF\noutput y',
    stem: 'The pseudocode below is run. The program outputs 58, and the input value was greater than 50. State the input value x.',
  },
  {
    stimulus: '',
    stem: 'Consider this Python function.\n\ndef max_val(items):\n    best = items[0]\n    for x in items:\n        if x > best:  # keep the larger\n            best = x\n    return best\n\nState the value returned by max_val([3, 9, 4]).',
  },
  { stimulus: 'The firewall protects an internal server.', stem: 'A hardware firewall applies the rules in the table in order. Determine the action taken.' },
]

export default function CodePreview() {
  if (!ENABLED) notFound()
  return (
    <main className="mx-auto max-w-2xl px-4 py-10" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {SAMPLES.map((q, i) => (
        <section key={i} className="mb-12">
          <QuestionStimulus text={q.stimulus} subject={CS} />
          <div className="whitespace-pre-line text-[17px] font-medium leading-relaxed">
            <CodeText text={q.stem} subject={CS} />
          </div>
        </section>
      ))}
      <p className="text-[15px]">
        Not CS, so maths as usual: <CodeText text="The cost is TC = 100 + 5Q + Q^2 and v_max = 3." subject="Economics HL" />
      </p>
    </main>
  )
}
