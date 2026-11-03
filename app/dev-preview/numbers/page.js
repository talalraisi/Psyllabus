'use client'

/** Typefaces for the homepage figures, side by side. Development only. */

import { notFound } from 'next/navigation'
import { Instrument_Serif, Space_Grotesk, Bricolage_Grotesque } from 'next/font/google'

const ENABLED = process.env.NODE_ENV !== 'production'

const serif = Instrument_Serif({ subsets: ['latin'], weight: '400' })
const grotesk = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600'] })
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['600', '700'] })

const FIGURES = [
  ['160', 'subjects'],
  ['9,400', 'subtopics mapped'],
  ['50,000', 'practice questions'],
  ['80,000', 'flashcards'],
]

const OPTIONS = [
  { key: 'A', name: 'Inter, bold and tight', font: '', cls: 'font-bold tracking-[-0.05em]', size: 'clamp(2.4rem,4.6vw,3.4rem)' },
  { key: 'B', name: 'Instrument Serif', font: serif.className, cls: 'tracking-[-0.01em]', size: 'clamp(3rem,5.6vw,4.2rem)' },
  { key: 'C', name: 'Space Grotesk', font: grotesk.className, cls: 'font-semibold tracking-[-0.04em]', size: 'clamp(2.4rem,4.6vw,3.4rem)' },
  { key: 'D', name: 'Bricolage Grotesque', font: bricolage.className, cls: 'font-bold tracking-[-0.04em]', size: 'clamp(2.4rem,4.6vw,3.4rem)' },
]

export default function NumbersPreview() {
  if (!ENABLED) notFound()
  return (
    <main className="min-h-screen px-6 py-10" style={{ background: 'var(--bg)' }}>
      {OPTIONS.map((o) => (
        <section key={o.key} className="mx-auto mb-6 max-w-4xl rounded-[18px] border px-6 py-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <p className="mb-6 text-[12px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
            {o.key} · {o.name}
          </p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 text-center md:grid-cols-4">
            {FIGURES.map(([v, l]) => (
              <div key={l}>
                <p className={`${o.font} ${o.cls} leading-none`} style={{ fontSize: o.size, color: 'var(--text)', fontVariantNumeric: 'lining-nums' }}>
                  {v}
                  <span style={{ color: 'var(--brand)' }}>+</span>
                </p>
                <p className="mt-3 text-[13.5px] font-medium" style={{ color: 'var(--text-muted)' }}>
                  {l}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
