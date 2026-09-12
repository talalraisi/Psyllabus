'use client'

import { useState } from 'react'
import { IconCheck, IconArrowRight, IconClose } from '@/components/Icons'
import { HOW_IT_WORKS, FEATURES, WHY, FAQ, ANSWERS } from './content'
import './theme.css'

/**
 * The whole homepage, in the new style. Not wired to anything.
 *
 * Same copy as the live page — this is a restyle, not a rewrite — with one
 * addition, the objections block, drawn from what IB students publicly
 * complain about in tools like this.
 *
 * Four rules, applied everywhere:
 *
 *   Hierarchy by type, not by boxes. Scale, weight and tracking on one clean
 *   sans. Sections are separated by a hairline and a lot of air rather than by
 *   cards, which is what stopped the old page looking like a spreadsheet.
 *
 *   The graphic is the product's own data. A study tool that puts an
 *   illustration on its homepage is showing you nothing.
 *
 *   Colour carries meaning only. The five statuses appear; nothing else is
 *   tinted for decoration.
 *
 *   Motion is entrances, once. Nothing loops, floats, or follows the cursor,
 *   because that is decoration competing with the thing you came to read.
 */

const STATUSES = ['weak', 'developing', 'proficient', 'mastered', 'fading', 'untested']

/**
 * A heatmap that fills in. Deterministic so it renders identically every time,
 * but weighted by row: early topics mostly proved, later ones mostly untested,
 * because that is the shape of a real student halfway through a course. An
 * even spread produced a diagonal stripe that read as a checkerboard.
 */
function Heatmap({ cols = 12, rows = 8 }) {
  const noise = (i) => (((i + 1) * 2654435761) >>> 8) % 1000
  const cells = []

  for (let i = 0; i < cols * rows; i++) {
    const through = Math.floor(i / cols) / (rows - 1)
    const r = noise(i) / 1000
    const untestedChance = 0.08 + through * 0.62
    if (r < untestedChance) {
      cells.push('untested')
    } else {
      const q = (r - untestedChance) / (1 - untestedChance)
      const skill = q * 0.55 + (1 - through) * 0.45
      cells.push(
        skill > 0.78 ? 'mastered'
        : skill > 0.54 ? 'proficient'
        : skill > 0.32 ? 'developing'
        : skill > 0.14 ? 'weak'
        : 'fading'
      )
    }
  }

  return (
    <div className="grid gap-[5px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {cells.map((s, i) => (
        <span
          key={i}
          className="cell aspect-square rounded-[3px]"
          style={{
            background: `var(--${s})`,
            animationDelay: `${200 + (i % cols) * 26 + Math.floor(i / cols) * 46}ms`,
          }}
        />
      ))}
    </div>
  )
}

function Section({ children, label, tint = false, className = '' }) {
  return (
    <section
      className={`border-t px-5 py-20 md:px-8 md:py-28 ${className}`}
      style={{
        borderColor: 'var(--border)',
        background: tint ? 'var(--sunken)' : 'transparent',
      }}
    >
      <div className="mx-auto max-w-6xl">
        {label && (
          <p
            className="mb-4 text-[11.5px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: 'var(--faint)' }}
          >
            {label}
          </p>
        )}
        {children}
      </div>
    </section>
  )
}

function Heading({ children, className = '' }) {
  return (
    <h2
      className={`text-[clamp(1.7rem,3.2vw,2.4rem)] font-semibold leading-[1.12] tracking-[-0.028em] ${className}`}
    >
      {children}
    </h2>
  )
}

export default function HomePreview() {
  const [dark, setDark] = useState(true)

  return (
    <div
      className="rv min-h-screen"
      data-rt={dark ? 'dark' : 'light'}
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <header
        className="sticky top-0 z-20 border-b backdrop-blur-md"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in oklab, var(--bg) 82%, transparent)',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 md:px-8">
          <span className="text-[15px] font-semibold tracking-[-0.012em]">Project Syllabus</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDark((d) => !d)}
              className="rounded-full border px-3.5 py-2 text-[13px] font-medium"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--body)' }}
            >
              {dark ? 'Light' : 'Dark'}
            </button>
            <button className="hidden rounded-full px-3.5 py-2 text-[13px] font-medium sm:block" style={{ color: 'var(--body)' }}>
              Log in
            </button>
            <button
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
              style={{ background: 'var(--brand-solid)' }}
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* ---------------------------------------------------------- hero */}
        <section className="px-5 py-16 md:px-8 md:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.05fr_1fr] md:gap-16">
            <div>
              <p
                className="rise mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--muted)' }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--proficient)' }} />
                IB, A-Level and AP
              </p>

              <h1
                className="rise text-[clamp(2.4rem,5.4vw,3.9rem)] font-semibold leading-[1.03] tracking-[-0.034em]"
                style={{ animationDelay: '60ms' }}
              >
                Know what you know.
                <br />
                <span style={{ color: 'var(--muted)' }}>Not what you hope.</span>
              </h1>

              <p
                className="rise mt-6 max-w-lg text-[16.5px] leading-[1.65]"
                style={{ color: 'var(--body)', animationDelay: '120ms' }}
              >
                Your whole syllabus, subtopic by subtopic, coloured by what you have actually
                proved in a quiz. Nothing here is filled in by rating yourself out of five.
              </p>

              <div className="rise mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: '180ms' }}>
                <button
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14.5px] font-semibold text-white transition-transform duration-150 hover:-translate-y-px"
                  style={{ background: 'var(--brand-solid)' }}
                >
                  Start free with one subject
                  <IconArrowRight width={17} height={17} />
                </button>
                <button
                  className="rounded-full border px-5 py-3.5 text-[14.5px] font-medium"
                  style={{ borderColor: 'var(--border-strong)', color: 'var(--body)' }}
                >
                  See how it works
                </button>
              </div>

              <p className="rise mt-5 text-[13px]" style={{ color: 'var(--faint)', animationDelay: '240ms' }}>
                No card. No trial that expires. A school code opens everything.
              </p>
            </div>

            <div
              className="rise rounded-2xl border p-5"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', animationDelay: '140ms' }}
            >
              <div className="mb-4 flex items-baseline justify-between">
                <p className="text-[13px] font-semibold">Physics SL</p>
                <p className="text-[12px]" style={{ color: 'var(--muted)' }}>96 subtopics</p>
              </div>

              <Heatmap />

              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                {STATUSES.map((s) => (
                  <span key={s} className="flex items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--muted)' }}>
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: `var(--${s})` }} />
                    <span className="capitalize">{s}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- numbers */}
        <Section tint>
          <div className="flex flex-wrap items-baseline gap-x-14 gap-y-8">
            {[
              ['5,000+', 'subtopics mapped'],
              ['300+', 'questions in the bank'],
              ['173', 'subjects covered'],
              ['3', 'curricula'],
            ].map(([v, l], i) => (
              <div key={l} className="rise" style={{ animationDelay: `${i * 60}ms` }}>
                <p className="text-[clamp(1.9rem,3.4vw,2.6rem)] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                  {v}
                </p>
                <p className="mt-2 text-[13px]" style={{ color: 'var(--muted)' }}>{l}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* --------------------------------------------------- how it works */}
        <Section label="How it works">
          <Heading className="max-w-xl">Three steps, and the second one is the point</Heading>
          <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {HOW_IT_WORKS.map(({ step, title, body }, i) => (
              <div key={step} className="rise" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--brand)' }}>
                    {step}
                  </span>
                  <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
                </div>
                <h3 className="text-[17px] font-semibold tracking-[-0.015em]">{title}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: 'var(--body)' }}>{body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ------------------------------------------------------ objections */}
        <Section tint>
          <Heading className="max-w-2xl">What students say goes wrong with tools like this</Heading>
          <p className="mt-4 max-w-lg text-[15.5px] leading-relaxed" style={{ color: 'var(--body)' }}>
            Taken from what IB students actually complain about. Here is what this does instead.
          </p>

          <ul className="mt-10 flex flex-col gap-3">
            {ANSWERS.map((a, i) => (
              <li
                key={a.them}
                className="rise grid gap-4 rounded-xl border p-5 md:grid-cols-[1fr_1.3fr] md:gap-8"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)', animationDelay: `${i * 55}ms` }}
              >
                <div className="flex gap-3">
                  <IconClose width={16} height={16} className="mt-0.5 shrink-0" style={{ color: 'var(--weak)' }} />
                  <p className="text-[14.5px] leading-snug" style={{ color: 'var(--muted)' }}>{a.them}</p>
                </div>
                <div className="flex gap-3">
                  <IconCheck width={16} height={16} className="mt-0.5 shrink-0" style={{ color: 'var(--proficient)' }} />
                  <p className="text-[14.5px] leading-snug">{a.us}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {/* --------------------------------------------------------- levels */}
        <Section label="The ladder">
          <Heading>Five levels, and only a quiz moves you</Heading>

          <div className="mt-12 flex items-end gap-2 md:gap-3">
            {[['Weak', 'weak', 26], ['Developing', 'developing', 44], ['Proficient', 'proficient', 66], ['Mastered', 'mastered', 100]].map(
              ([label, key, h], i) => (
                <div key={key} className="flex-1">
                  <div
                    className="cell rounded-t-lg"
                    style={{ height: `${h * 1.5}px`, background: `var(--${key})`, animationDelay: `${i * 90}ms` }}
                  />
                  <p className="mt-3 text-[12.5px] font-medium">{label}</p>
                </div>
              )
            )}
            <div className="flex-1">
              <div
                className="cell rounded-lg border border-dashed"
                style={{ height: '50px', borderColor: 'var(--fading)', animationDelay: '400ms' }}
              />
              <p className="mt-3 text-[12.5px] font-medium" style={{ color: 'var(--fading)' }}>Fading</p>
            </div>
          </div>

          <p className="mt-9 max-w-xl text-[15px] leading-relaxed" style={{ color: 'var(--body)' }}>
            Mastery is worth ten points and a harder question is worth more of them. Leave a
            subtopic alone for long enough and it fades back, because that is what actually
            happens to it.
          </p>
        </Section>

        {/* ------------------------------------------------------- features */}
        <Section label="What you get" tint>
          <Heading className="max-w-xl">Everything that is already working</Heading>
          <div className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(([title, body, tone], i) => (
              <div key={title} className="rise" style={{ animationDelay: `${i * 45}ms` }}>
                <span className="mb-3 block h-1 w-7 rounded-full" style={{ background: `var(--${tone})` }} />
                <h3 className="text-[15px] font-semibold tracking-[-0.012em]">{title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--body)' }}>{body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------------------------------------------------- why it works */}
        <Section label="Why it works">
          <Heading className="max-w-2xl">Six reasons, none of them about motivation</Heading>
          <div className="mt-12 grid gap-x-14 gap-y-11 md:grid-cols-2">
            {WHY.map(({ title, body }, i) => (
              <div key={title} className="rise" style={{ animationDelay: `${i * 55}ms` }}>
                <div className="mb-3 flex items-baseline gap-3">
                  <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--faint)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.015em]">{title}</h3>
                </div>
                <p className="text-[14.5px] leading-[1.7]" style={{ color: 'var(--body)' }}>{body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* -------------------------------------------------------- schools */}
        <Section tint>
          <div className="grid items-center gap-10 md:grid-cols-[1.1fr_1fr]">
            <div>
              <Heading className="max-w-lg">One code opens it for the whole year group</Heading>
              <p className="mt-5 max-w-lg text-[15.5px] leading-relaxed" style={{ color: 'var(--body)' }}>
                Students type the code in once. No cards, no seat counting, and every code has a
                redemption limit so it cannot quietly become a public unlock.
              </p>
              <button
                className="mt-8 inline-flex items-center gap-2 rounded-full border px-5 py-3.5 text-[14.5px] font-medium"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--body)' }}
              >
                Talk to us about your school
                <IconArrowRight width={16} height={16} />
              </button>
            </div>
            <div className="rise rounded-2xl border p-6" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <Heatmap cols={8} rows={5} />
              <p className="mt-4 text-[12.5px]" style={{ color: 'var(--muted)' }}>
                A teacher sees the same map for a class, without seeing anybody&rsquo;s individual answers.
              </p>
            </div>
          </div>
        </Section>

        {/* ------------------------------------------------------------ faq */}
        <Section label="Questions people ask">
          <div className="grid gap-x-14 gap-y-10 md:grid-cols-2">
            {FAQ.map(({ q, a }, i) => (
              <div key={q} className="rise" style={{ animationDelay: `${i * 50}ms` }}>
                <h3 className="text-[16px] font-semibold leading-snug tracking-[-0.013em]">{q}</h3>
                <p className="mt-2.5 text-[14.5px] leading-[1.7]" style={{ color: 'var(--body)' }}>{a}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ------------------------------------------------------------ cta */}
        <Section>
          <div className="mx-auto max-w-2xl text-center">
            <Heading>Start with one subject. It stays free.</Heading>
            <p className="mx-auto mt-5 max-w-lg text-[15.5px] leading-relaxed" style={{ color: 'var(--body)' }}>
              One quiz is enough to fill in your first subtopic and start the plan.
            </p>
            <button
              className="mt-9 inline-flex items-center gap-2 rounded-full px-7 py-4 text-[15px] font-semibold text-white transition-transform duration-150 hover:-translate-y-px"
              style={{ background: 'var(--brand-solid)' }}
            >
              Create a free account
              <IconArrowRight width={18} height={18} />
            </button>
          </div>
        </Section>
      </main>

      <footer className="border-t px-5 py-12 md:px-8" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6">
          <p className="text-[13px]" style={{ color: 'var(--faint)' }}>
            © 2026 Project Syllabus · Built in Muscat, Oman
          </p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {['About', 'Pricing', 'Privacy', 'Terms', 'Cookies', 'Refunds'].map((l) => (
              <span key={l} className="text-[13px]" style={{ color: 'var(--muted)' }}>{l}</span>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}
