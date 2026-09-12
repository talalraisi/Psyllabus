'use client'

import { useState } from 'react'
import { IconCheck, IconArrowRight, IconClose } from '@/components/Icons'
import { HOW_IT_WORKS, FEATURES, WHY, FAQ, ANSWERS } from './content'
import { Heatmap, TryQuestion, DecayDemo, PlanDemo, Faq } from './interactive'
import { Reveal, ScrollBar, CountUp, ForgettingCurve } from './scroll'
import { FEATURE_MODULES } from './features'
import Image from 'next/image'
import logoMark from '@/public/logo-mark.png'
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
      <ScrollBar />

      <header
        className="sticky top-0 z-20 border-b backdrop-blur-md"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in oklab, var(--bg) 82%, transparent)',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 md:px-8">
          <span className="flex items-center gap-2.5">
            <Image src={logoMark} alt="" sizes="56px" style={{ height: 22, width: 'auto' }} priority />
            <span className="text-[15px] font-semibold tracking-[-0.012em]">Project Syllabus</span>
          </span>
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
        <section className="ground px-5 py-24 md:px-8 md:py-36">
          <div className="mx-auto max-w-6xl">
            <h1 className="max-w-3xl text-[clamp(2.6rem,6vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.038em]">
              Stop guessing.
              <br />
              <span style={{ color: 'var(--brand)' }}>Start progressing.</span>
            </h1>

            <p
              className="mt-8 max-w-xl text-[17px] leading-[1.6]"
              style={{ color: 'var(--body)' }}
            >
              Your whole syllabus, subtopic by subtopic, coloured by what you have actually proved
              in a quiz. Nothing here is filled in by rating yourself out of five.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
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

            {/* The curricula, as a quiet row rather than a badge. A pill at the
                top of a page is a label looking for something to label. */}
            <div
              className="mt-20 flex flex-wrap items-center gap-x-8 gap-y-3 border-t pt-6"
              style={{ borderColor: 'var(--border)' }}
            >
              {['IB Diploma', 'A-Level', 'AP'].map((c) => (
                <span key={c} className="text-[12.5px] font-medium" style={{ color: 'var(--muted)' }}>
                  {c}
                </span>
              ))}
              <span className="text-[12.5px]" style={{ color: 'var(--faint)' }}>
                One subject free, with no time limit
              </span>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- coverage */}
        <Section tint>
          <div className="flex flex-wrap items-baseline justify-between gap-6">
            <p className="max-w-xl text-[15.5px] leading-relaxed" style={{ color: 'var(--body)' }}>
              The syllabus is mapped for{' '}
              <span className="font-semibold" style={{ color: 'var(--text)' }}>
                <CountUp to={173} /> subjects
              </span>{' '}
              across IB, A-Level and AP —{' '}
              <span className="font-semibold" style={{ color: 'var(--text)' }}>
                <CountUp to={5914} /> subtopics
              </span>
              . Question coverage is deeper in some subjects than others, and the app tells you
              which rather than hiding it.
            </p>
          </div>
        </Section>

        {/* --------------------------------------------------- how it works */}
        <Section label="How it works">
          <Heading className="max-w-xl">Three steps, and the second one is the point</Heading>

          <div className="mt-14 grid gap-px md:grid-cols-3" style={{ background: 'var(--border)' }}>
            {HOW_IT_WORKS.map(({ step, title, body }, i) => (
              <Reveal
                key={step}
                delay={i * 80}
                className="p-7 md:p-8"
                style={{ background: 'var(--bg)' }}
              >
                <p
                  className="mb-5 text-[10.5px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: 'var(--faint)' }}
                >
                  {step}
                </p>
                <h3 className="text-[18px] font-semibold leading-snug tracking-[-0.018em]">{title}</h3>
                <p className="mt-3 text-[14.5px] leading-[1.7]" style={{ color: 'var(--body)' }}>
                  {body}
                </p>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ----------------------------------------------------------- try it */}
        <Section label="Try it" tint>
          <div className="grid gap-10 md:grid-cols-[1fr_1.15fr] md:gap-14">
            <div>
              <Heading>Sit one, right here</Heading>
              <p className="mt-5 text-[15.5px] leading-relaxed" style={{ color: 'var(--body)' }}>
                A real question from the bank. Pick a wrong answer on purpose and it will tell you
                the specific mistake that leads there, rather than just showing you the right one.
              </p>
              <p className="mt-4 text-[15.5px] leading-relaxed" style={{ color: 'var(--body)' }}>
                Getting it right moves the subtopic by an amount that depends on how hard the
                question was. Ten points is mastery, and you cannot get there on easy ones alone.
              </p>
            </div>
            <TryQuestion />
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
              <Reveal
                key={a.them}
                as="li"
                delay={i * 60}
                className="lift grid gap-4 rounded-xl border p-5 md:grid-cols-[1fr_1.3fr] md:gap-8"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <div className="flex gap-3">
                  <IconClose width={16} height={16} className="mt-0.5 shrink-0" style={{ color: 'var(--weak)' }} />
                  <p className="text-[14.5px] leading-snug" style={{ color: 'var(--muted)' }}>{a.them}</p>
                </div>
                <div className="flex gap-3">
                  <IconCheck width={16} height={16} className="mt-0.5 shrink-0" style={{ color: 'var(--proficient)' }} />
                  <p className="text-[14.5px] leading-snug">{a.us}</p>
                </div>
              </Reveal>
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

        {/* ---------------------------------------------------------- decay */}
        <Section label="Fading" tint>
          <div className="grid gap-10 md:grid-cols-[1fr_1fr] md:gap-14">
            <div>
              <Heading>Drag time forward</Heading>
              <p className="mt-5 text-[15.5px] leading-relaxed" style={{ color: 'var(--body)' }}>
                Something you proved in October is not something you know in May. Move the slider
                and watch a subtopic you had mastered slip back into your plan.
              </p>
            </div>
            <DecayDemo />
          </div>

          <Reveal
            className="mt-12 rounded-2xl border p-6 md:p-8"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <ForgettingCurve />
          </Reveal>
        </Section>

        {/* --------------------------------------------------------- planner */}
        <Section label="The plan">
          <div className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:gap-14">
            <div>
              <Heading>Tell it how long you have</Heading>
              <p className="mt-5 text-[15.5px] leading-relaxed" style={{ color: 'var(--body)' }}>
                Five minutes or five hours. The list is ordered, and every line carries the reason
                it is on there, so you can disagree with it rather than trust it.
              </p>
            </div>
            <PlanDemo />
          </div>
        </Section>

        {/* ------------------------------------------------------- features */}
        <Section label="Features" tint>
          <Heading className="max-w-2xl">Eight things, all of them working today</Heading>
          <p className="mt-4 max-w-lg text-[15.5px] leading-relaxed" style={{ color: 'var(--body)' }}>
            Shown rather than described, because a list of feature names tells you nothing about
            whether any of it is any good.
          </p>

          <div className="mt-14 flex flex-col">
            {FEATURE_MODULES.map(({ label, title, body, Graphic }, i) => (
              <Reveal
                key={title}
                as="article"
                delay={40}
                className="grid gap-8 border-t py-10 md:grid-cols-[0.9fr_1.1fr] md:gap-14 md:py-12"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className={i % 2 === 1 ? 'md:order-2' : undefined}>
                  <p
                    className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: 'var(--faint)' }}
                  >
                    {String(i + 1).padStart(2, '0')} · {label}
                  </p>
                  <h3 className="text-[20px] font-semibold leading-snug tracking-[-0.02em]">{title}</h3>
                  <p className="mt-3 text-[14.5px] leading-[1.7]" style={{ color: 'var(--body)' }}>
                    {body}
                  </p>
                </div>
                <div className={i % 2 === 1 ? 'md:order-1' : undefined}>
                  <Graphic />
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ---------------------------------------------------- why it works */}
        <Section label="Why it works">
          <Heading className="max-w-2xl">Six reasons, none of them about motivation</Heading>
          <div className="mt-12 grid gap-x-14 gap-y-11 md:grid-cols-2">
            {WHY.map(({ title, body }, i) => (
              <Reveal key={title} delay={i * 55}>
                <div className="mb-3 flex items-baseline gap-3">
                  <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--faint)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.015em]">{title}</h3>
                </div>
                <p className="text-[14.5px] leading-[1.7]" style={{ color: 'var(--body)' }}>{body}</p>
              </Reveal>
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
            <Reveal className="rounded-[12px] border p-6" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
              <Heatmap cols={8} rows={5} readout={false} />
              <p className="mt-4 text-[12.5px]" style={{ color: 'var(--muted)' }}>
                A teacher sees the same map for a class, without seeing anybody&rsquo;s individual answers.
              </p>
            </Reveal>
          </div>
        </Section>

        {/* ------------------------------------------------------------ faq */}
        <Section label="Questions people ask">
          <Faq items={FAQ} />
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
