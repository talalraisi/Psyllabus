import Link from 'next/link'
import { IconCheck } from '@/components/Icons'

export const metadata = {
  title: 'Pricing',
  description:
    'What Project Syllabus costs, and how a school code opens everything for a whole year group.',
}

const PLANS = [
  {
    name: 'Free',
    price: 'Free',
    cadence: 'no time limit',
    summary: 'One subject, fully open. Enough to tell whether this works for you.',
    features: [
      'One subject, every topic and subtopic',
      'Quizzes on any subtopic in that subject',
      'Heatmap built from what you actually got right',
      'Study plan for that subject',
      'Switch which subject it is whenever you want',
    ],
    cta: { label: 'Create a free account', href: '/signup' },
    emphasis: false,
  },
  {
    name: 'Everything',
    price: '$12',
    cadence: 'a month, or $108 a year',
    summary: 'All six subjects and the tools that only make sense across all of them.',
    features: [
      'Every subject you take',
      'Whole-topic and whole-subject papers, timed',
      'Predicted grade out of 45 against your targets',
      'Topics fade when you leave them and come back into your plan',
      'Mistake bank that brings wrong answers back on a schedule',
      'Planner that ranks across every subject at once',
      'Hand-picked resources on every subtopic',
    ],
    cta: { label: 'Create a free account first', href: '/signup' },
    emphasis: true,
    note: 'Card payments are not open yet. If your school has a code, all of this is already yours for nothing.',
  },
  {
    name: 'Whole school',
    price: '$500',
    cadence: 'to $2,000 a year, by size',
    summary: 'One code for the year group. Cheaper than a handful of students paying alone.',
    features: [
      'Every student at the school, no seat counting',
      'Everything in the paid plan, for all of them',
      'They type the code in once, no card involved',
      'We help you get the first cohort set up',
    ],
    cta: {
      label: 'Email us about your school',
      href: 'mailto:talalraisi1@gmail.com?subject=Project%20Syllabus%20for%20our%20school',
    },
    emphasis: false,
  },
]

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <div className="mx-auto max-w-5xl px-5 py-12 md:py-16">
        <Link href="/" className="text-sm font-medium text-[var(--brand)] hover:underline">
          Back to Project Syllabus
        </Link>

        <header className="mt-6 mb-10 max-w-2xl">
          <h1 className="t-page-title mb-2">Pricing</h1>
          <p className="t-body">
            Start free with one subject and keep it as long as you like. If your school has bought a
            code, typing it in opens the rest and costs you nothing.
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
              <h2 className="t-card-title mb-4">{plan.name}</h2>

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
          <h2 className="t-card-title mb-4">If your school buys a code</h2>
          <ol className="flex flex-col gap-3 text-sm text-[var(--text-body)]">
            <li>
              <span className="font-medium text-[var(--text)]">1.</span> The school gets one code.
            </li>
            <li>
              <span className="font-medium text-[var(--text)]">2.</span> Students make a free
              account and type the code into their profile page.
            </li>
            <li>
              <span className="font-medium text-[var(--text)]">3.</span> Every subject opens on the
              spot. No card, no trial that quietly ends.
            </li>
            <li>
              <span className="font-medium text-[var(--text)]">4.</span> That is all of it. There is
              no admin panel and no teacher account, because this is a tool students use on their
              own.
            </li>
          </ol>
          <p className="t-caption mt-4">
            Nobody at the school can see a student&rsquo;s results. That is enforced by the database
            itself, not by a setting someone could change. Details in the{' '}
            <Link href="/privacy" className="text-[var(--brand)] hover:underline">
              privacy policy
            </Link>
            .
          </p>
        </section>

        <section className="mt-10">
          <h2 className="t-card-title mb-4">Questions people actually ask</h2>
          <div className="flex flex-col gap-3">
            {[
              [
                'Does the free plan run out?',
                'No. It is one subject for as long as you want it, not a trial with a clock on it.',
              ],
              [
                'Can I change which subject is the free one?',
                'Yes, from the My Subjects page, as often as you like. Your results in the other subjects are kept while they are closed.',
              ],
              [
                'Can I pay right now?',
                'Not yet. Card payments are still being set up, so the only way to open everything today is a school code.',
              ],
              [
                'What happens to my work if I stop paying?',
                'Nothing is deleted. You drop back to one open subject and the rest sit there until you open them again.',
              ],
            ].map(([q, a]) => (
              <div key={q} className="surface p-5">
                <p className="text-sm font-semibold text-[var(--text)]">{q}</p>
                <p className="t-small mt-1">{a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
