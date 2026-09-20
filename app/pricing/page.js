'use client'

import Link from 'next/link'
import { IconCheck, IconArrowRight, IconClose } from '@/components/Icons'
import { PLANS, SCHOOL_PLAN } from '@/lib/plans'

/**
 * Three plans and a footnote.
 *
 * The shape is the argument. Free is the whole product for one subject, so it
 * is worth using rather than a demo that nags; Basic is the same thing for
 * every subject you take, which is the decision most students are actually
 * making; Premium is Basic plus Syllabi for four dollars more, which is
 * the decision nobody agonises over.
 *
 * Schools are at the foot of the page. A student comparing plans is not going
 * to buy a site licence, and a fourth column that says "contact us" makes the
 * page read like procurement. The teacher who came looking for it will scroll.
 *
 * Nothing takes money yet, so every button says what it actually does.
 */
export default function PricingPage() {
  return (
    <main className="ground min-h-screen">
      <div className="mx-auto max-w-5xl px-5 py-12 md:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium"
          style={{ color: 'var(--brand)' }}
        >
          <span aria-hidden="true">&larr;</span>
          Back to Project Syllabus
        </Link>

        <header className="app-enter mt-8 mb-12 max-w-2xl">
          <h1 className="text-[clamp(2rem,5vw,2.8rem)] font-semibold leading-[1.08] tracking-[-0.032em]">
            One subject free. All six for less than a textbook.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            No trial running out, no card to start.
          </p>
        </header>

        <div className="stagger grid grid-cols-1 gap-3 md:grid-cols-3">
          {PLANS.map((plan) => (
            <section
              key={plan.id}
              className="lift flex flex-col rounded-[16px] border p-6"
              style={{
                borderColor: plan.featured ? 'var(--brand)' : 'var(--border-strong)',
                background: plan.featured ? 'var(--brand-tint)' : 'var(--surface)',
              }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[15px] font-semibold tracking-[-0.012em]">{plan.name}</h2>
                {plan.featured && (
                  <span
                    className="rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em]"
                    style={{ background: 'var(--brand)', color: '#fff' }}
                  >
                    Most useful
                  </span>
                )}
              </div>

              <p className="mt-4">
                <span className="text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                  {plan.priceLabel}
                </span>{' '}
                <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                  {plan.cadence}
                </span>
              </p>

              {plan.annual && (
                <p className="mt-1.5 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                  or {plan.annual} — two months off
                </p>
              )}

              <p className="mt-3 text-[13.5px] font-medium">{plan.tagline}</p>

              <ul className="mb-6 mt-5 flex flex-1 flex-col gap-2.5">
                {plan.includes.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <IconCheck
                      width={15}
                      height={15}
                      className="mt-0.5 shrink-0"
                      style={{ color: 'var(--brand)' }}
                    />
                    <span className="text-[13.5px] leading-snug" style={{ color: 'var(--text-body)' }}>
                      {f}
                    </span>
                  </li>
                ))}
                {plan.excludes.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <IconClose
                      width={15}
                      height={15}
                      className="mt-0.5 shrink-0"
                      style={{ color: 'var(--text-faint)' }}
                    />
                    <span className="text-[13.5px] leading-snug" style={{ color: 'var(--text-faint)' }}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.id === 'free' ? '/signup' : '/signup?plan=' + plan.id}
                className={`btn control-md w-full ${plan.featured ? 'btn-solid' : 'btn-outline'}`}
              >
                {plan.cta}
                <IconArrowRight width={16} height={16} />
              </Link>

              {plan.note && (
                <p className="mt-3 text-[12px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                  {plan.note}
                </p>
              )}
            </section>
          ))}
        </div>

        {/* Said once, plainly, rather than printed on three buttons. */}
        <p className="mt-5 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          Paid plans are not live yet — sign up free and you will be the first to be offered one.
        </p>

        {/* The footnote for teachers. */}
        <section
          className="mt-14 rounded-[16px] border p-6 md:p-8"
          style={{ borderColor: 'var(--border-strong)' }}
        >
          <h2 className="text-[15px] font-semibold tracking-[-0.012em]">{SCHOOL_PLAN.name}</h2>
          <p
            className="mt-2.5 max-w-2xl text-[14px] leading-relaxed"
            style={{ color: 'var(--text-body)' }}
          >
            {SCHOOL_PLAN.blurb}
          </p>
          <Link
            href="mailto:talalraisi1@gmail.com?subject=Project%20Syllabus%20for%20our%20school"
            className="btn btn-outline control-md mt-5"
          >
            {SCHOOL_PLAN.cta}
          </Link>
        </section>

        <section className="mt-14">
          <h2 className="mb-5 text-[15px] font-semibold tracking-[-0.012em]">Questions</h2>
          <dl className="flex flex-col">
            {[
              [
                'What does free actually include?',
                'One subject, and everything the app does for it: the full syllabus map, quizzes that set your levels, redemption, flashcards, the planner and the calendar. It does not run out.',
              ],
              [
                'What is Syllabi?',
                'It reads an IA, EE or TOK draft and tells you what an examiner would say, suggests research questions, and works out what to study from your own results. It comments on your work and never writes it.',
              ],
              [
                'Can I change subject on the free plan?',
                'Yes, once every 30 days. The hold stops a free account reading the whole syllabus a subject at a time.',
              ],
              [
                'Does my school see my results?',
                'No. There is no teacher account and no admin panel, on any plan. A school code unlocks the app for students and shows the school nothing.',
              ],
            ].map(([q, a]) => (
              <div key={q} className="border-b py-4" style={{ borderColor: 'var(--border)' }}>
                <dt className="text-[14px] font-medium">{q}</dt>
                <dd className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {a}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </main>
  )
}
