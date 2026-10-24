'use client'

/** How maths in questions is set. Development only. */

import { notFound } from 'next/navigation'
import MathText from '@/components/MathText'

const ENABLED = process.env.NODE_ENV !== 'production'

const SAMPLES = [
  'A student expands $(9+x)^{-\\frac12}$ in ascending powers of $x$.\n\nStep 1: $(9+x)^{-\\frac12}=\\frac13\\left(1+\\frac{x}{9}\\right)^{-\\frac12}$\n\nStep 2: $=\\frac13\\left[1+\\left(-\\frac12\\right)\\left(\\frac{x}{9}\\right)+\\frac{\\left(-\\frac12\\right)\\left(-\\frac32\\right)}{2!}\\left(\\frac{x^2}{9}\\right)+\\dots\\right]$\n\nStep 3: $=\\frac13-\\frac{x}{54}+\\frac{x^2}{72}+\\dots$',
  'In Step 2, $\\left(\\frac{x}{9}\\right)^2$ has been written as $\\frac{x^2}{9}$ instead of $\\frac{x^2}{81}$.',
  'The price rises from $40 to $50. Find the percentage change.',
  'TC = 100 + 5Q + Q^2, and the marginal cost is MC = 5 + 2Q.',
  'Find $\\int_0^{\\pi} \\sin^2 x\\,dx$ and $\\sum_{r=1}^{n} r^2$, given $\\sqrt{9}=3$ and $v = u + at$.',
  'A force of $2.5 \\times 10^{3}\\ \\text{N}$ acts at $30^\\circ$ to the horizontal.',
]

export default function MathsPreview() {
  if (!ENABLED) notFound()
  return (
    <main className="mx-auto max-w-2xl px-4 py-10" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {SAMPLES.map((s, i) => (
        <p key={i} className="mb-6 whitespace-pre-line text-[18px] leading-relaxed">
          <MathText>{s}</MathText>
        </p>
      ))}
    </main>
  )
}
