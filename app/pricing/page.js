import Link from 'next/link'
import { IconCheck } from '@/components/Icons'

export const metadata = {
  title: 'Pricing',
  description:
    'PSyllabus is free for students at partner schools. Individual and school plans explained.',
}

const PLANS = [
  {
    name: 'Free',
    price: 'Free',
    cadence: 'forever',
    summary: 'Track one subject end to end and see how the method works.',
    features: [
      'Full syllabus map for one subject',
      'Subtopic quizzes with instant marking',
      'Quiz-verified progress heatmap',
      'Mistake bank with spaced repetition',
    ],
    cta: { label: 'Create an account', href: '/signup' },
    emphasis: false,
  },
  {
    name: 'School',
    price: 'Free',
    cadence: 'for partner schools',
    summary:
      'Every student at a partner school gets full access, plus a cohort dashboard for staff.',
    features: [
      'Every subject unlocked for every student',
      'Timed mock exams and custom multi-topic papers',
      'Skill-decay tracking and the smart study plan',
      'Staff dashboard: cohort weak spots and per-student progress',
      'Students join with a school code, no card required',
    ],
    cta: { label: 'Talk to us about your school', href: 'mailto:talalraisi1@gmail.com?subject=PSyllabus%20for%20our%20school' },
    emphasis: true,
    badge: 'Current pilot',
  },
  {
    name: 'Individual',
    price: '$12',
    cadence: 'per month',
    summary: 'For students whose school has not partnered yet.',
    features: [
      'Everything in the School plan, for one student',
      'All subjects in your programme',
      'Timed mocks, custom papers, and pacing analytics',
      'Cancel any time',
    ],
    cta: { label: 'Join the waitlist', href: '/#waitlist' },
    emphasis: false,
    note: 'Not yet open for payment. Schools take priority during the pilot.',
  },
]

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <div className="mx-auto max-w-5xl px-5 py-12 md:py-16">
        <Link href="/" className="text-sm font-medium text-[var(--brand)] hover:underline">
          Back to PSyllabus
        </Link>

        <header className="mt-6 mb-10 max-w-2xl">
          <h1 className="t-page-title mb-2">Pricing</h1>
          <p className="t-body">
            PSyllabus is free for every student at a partner school. Schools pay nothing during the
            pilot, and students never need a payment method to get started.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {PLANS.map((plan) => (
            <section
              key={plan.name}
              className={`surface flex flex-col p-6 ${
                plan.emphasis ? 'border-[var(--brand)]' : ''
              }`}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="t-card-title">{plan.name}</h2>
                {plan.badge && (
                  <span className="rounded-full bg-[var(--sand)] px-3 py-1 text-xs font-medium text-[var(--text)]">
                    {plan.badge}
                  </span>
                )}
              </div>

              <p className="mb-1">
                <span className="t-stat text-[var(--text)]">{plan.price}</span>{' '}
                <span className="t-small">{plan.cadence}</span>
              </p>
              <p className="t-small mb-6">{plan.summary}</p>

              <ul className="mb-6 flex flex-1 flex-col gap-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-3">
                    <IconCheck
                      width={16}
                      height={16}
                      className="mt-1 shrink-0 text-[var(--brand)]"
                    />
                    <span className="text-sm text-[var(--text-body)]">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.cta.href}
                className={`btn control-md w-full ${plan.emphasis ? 'btn-solid' : 'btn-quiet'}`}
              >
                {plan.cta.label}
              </Link>

              {plan.note && <p className="t-caption mt-3">{plan.note}</p>}
            </section>
          ))}
        </div>

        <section className="surface mt-10 p-6">
          <h2 className="t-card-title mb-2">How school access works</h2>
          <ol className="flex flex-col gap-3 text-sm text-[var(--text-body)]">
            <li>
              <span className="font-medium text-[var(--text)]">1.</span> Your school is issued a
              join code.
            </li>
            <li>
              <span className="font-medium text-[var(--text)]">2.</span> Students create a free
              account and enter that code on their profile page.
            </li>
            <li>
              <span className="font-medium text-[var(--text)]">3.</span> Every subject unlocks
              immediately. No card, no trial period.
            </li>
            <li>
              <span className="font-medium text-[var(--text)]">4.</span> Staff linked to the school
              get a cohort dashboard showing which subtopics the year group is struggling with.
            </li>
          </ol>
          <p className="t-caption mt-4">
            Students only ever see their own data. Staff see aggregate cohort progress for their own
            school, enforced at the database level. See our{' '}
            <Link href="/privacy" className="text-[var(--brand)] hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  )
}
