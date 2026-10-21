'use client'

/**
 * Every diagram kind, drawn from sample data. Development only: for checking
 * the drawings by eye, in light and dark mode, at phone width.
 */

import { notFound } from 'next/navigation'
import QuestionFigure from '@/components/QuestionFigure'

const ENABLED = process.env.NODE_ENV !== 'production'

const SAMPLES = [
  {
    title: 'Series and parallel',
    figure: {
      kind: 'circuit',
      alt: 'A 12 V cell, R1 = 2.0 Ω in series, then R2 = 6.0 Ω and R3 = 3.0 Ω in parallel.',
      source: '12 V',
      series: [{ type: 'resistor', label: 'R1 = 2.0 Ω' }],
      parallel: [[{ type: 'resistor', label: 'R2 = 6.0 Ω' }], [{ type: 'resistor', label: 'R3 = 3.0 Ω' }]],
    },
  },
  {
    title: 'Series with meters and a switch',
    figure: {
      kind: 'circuit',
      alt: 'A 9.0 V battery with internal resistance, a switch, an ammeter, a lamp and a variable resistor in series.',
      source: 'emf 9.0 V, r = 0.50 Ω',
      series: [
        { type: 'switch', label: 'S' },
        { type: 'ammeter', label: '' },
        { type: 'lamp', label: 'L' },
        { type: 'variable_resistor', label: 'R' },
      ],
      parallel: [],
    },
  },
  {
    title: 'Three branches',
    figure: {
      kind: 'circuit',
      alt: 'A 6.0 V supply with a thermistor, an LDR and a diode with a resistor in three parallel branches.',
      source: '6.0 V',
      series: [{ type: 'ammeter', label: '' }],
      parallel: [[{ type: 'thermistor', label: 'T' }], [{ type: 'ldr', label: 'LDR' }], [{ type: 'diode', label: '' }, { type: 'resistor', label: '100 Ω' }]],
    },
  },
  {
    title: 'Block on a rough slope',
    figure: {
      kind: 'forces',
      alt: 'A block on a 30° slope: weight W down, normal reaction N perpendicular to the slope, friction f = 12 N up the slope.',
      surface: 'incline',
      angle_deg: 30,
      body: 'block',
      forces: [
        { label: 'W', direction_deg: 270, size: 1 },
        { label: 'N', direction_deg: 60, size: 0.87 },
        { label: 'f = 12 N', direction_deg: 150, size: 0.45 },
      ],
    },
  },
  {
    title: 'Pulled along the ground',
    figure: {
      kind: 'forces',
      alt: 'A box on horizontal ground pulled by 40 N at 25° above the horizontal, with weight, normal reaction and friction.',
      surface: 'horizontal',
      body: 'block',
      forces: [
        { label: '40 N', direction_deg: 25, size: 0.8 },
        { label: 'W', direction_deg: 270, size: 1 },
        { label: 'N', direction_deg: 90, size: 0.75 },
        { label: 'F', direction_deg: 180, size: 0.5 },
      ],
    },
  },
  {
    title: 'A ball in the air',
    figure: {
      kind: 'forces',
      alt: 'A falling ball with weight down and air resistance up.',
      surface: 'none',
      body: 'ball',
      forces: [
        { label: 'mg', direction_deg: 270, size: 0.9 },
        { label: 'drag', direction_deg: 90, size: 0.5 },
      ],
    },
  },
]

export default function FiguresPreview() {
  if (!ENABLED) notFound()
  return (
    <main className="mx-auto max-w-3xl px-4 py-10" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <h1 className="mb-6 text-[22px] font-semibold">Figures</h1>
      {SAMPLES.map((s) => (
        <section key={s.title} className="mb-8">
          <h2 className="mb-2 text-[14px] font-semibold" style={{ color: 'var(--text-muted)' }}>
            {s.title}
          </h2>
          <QuestionFigure figure={s.figure} />
        </section>
      ))}
    </main>
  )
}
