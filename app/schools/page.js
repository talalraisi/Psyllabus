import PageShell, { PageHead, Band } from '@/components/marketing/PageShell'
import { OPERATOR } from '@/lib/legal'
import { coursesIn } from '@/lib/catalogue'
import { IconArrowRight, IconCheck, IconClose } from '@/components/Icons'
import { CodeFanout, NoDashboard, RolloutTrack, CoverageBar, Eyebrow } from '@/components/marketing/visuals'
import Link from 'next/link'

export const metadata = {
  title: 'For schools',
  description:
    'One code opens Project Syllabus for a whole year group. No cards, no seat counting, and no teacher dashboard, so nobody at the school sees anybody’s results.',
}

const GETS = [
  ['One code', 'Tied to your email domain, with a redemption limit, so it cannot quietly become a public unlock. Students type it in once at sign-up.'],
  ['Every subject, for everyone', 'The whole year group on the full product, not a stripped-down school tier.'],
  ['No seat counting', 'No licences to assign, no accounts to provision, nothing to administer through the year.'],
  ['No card from the student', 'Nobody in your year group is asked for payment details at any point.'],
]

const DOES_NOT = [
  'There is no teacher account and no class dashboard.',
  'Nobody at the school sees anybody’s results, including yours.',
  'No league tables, no flags to a form tutor, no exports of who is behind.',
]

export default function SchoolsPage() {
  const total = ['IB', 'A-Level', 'AP'].reduce((n, id) => n + coursesIn(id), 0)
  return (
    <PageShell>
      <PageHead
        eyebrow="For schools"
        title="One code opens it for the whole year group"
        intro="Typed in once at sign-up. No cards, no seat counting, and every code has a limit."
      >
        <a
          href={`mailto:${OPERATOR.dpoEmail}?subject=Project%20Syllabus%20for%20our%20school`}
          className="btn btn-solid control-lg mt-10"
        >
          Talk to us about your school
          <IconArrowRight width={16} height={16} />
        </a>
      </PageHead>

      {/* The two halves of the offer, drawn rather than listed. What a school
          gets is a code reaching a year group; what it does not get is a class
          dashboard, and the fastest way to say a thing does not exist is to
          show it not existing. */}
      <Band>
        <div className="grid gap-4 md:grid-cols-2">
          <CodeFanout seats={24} />
          <NoDashboard />
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2 md:gap-14">
          <div>
            <h2 className="text-[clamp(1.4rem,2.6vw,1.8rem)] font-semibold leading-tight tracking-[-0.028em]">
              What the school gets
            </h2>
            <ul className="mt-6 flex flex-col gap-4">
              {GETS.map(([term, detail]) => (
                <li key={term} className="flex gap-3">
                  <IconCheck
                    width={16}
                    height={16}
                    className="mt-1 shrink-0"
                    style={{ color: 'var(--status-proficient)' }}
                  />
                  <div>
                    <p className="text-[14.5px] font-medium">{term}</p>
                    <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-[clamp(1.4rem,2.6vw,1.8rem)] font-semibold leading-tight tracking-[-0.028em]">
              And what it does not
            </h2>
            <ul className="mt-6 flex flex-col gap-4">
              {DOES_NOT.map((line) => (
                <li key={line} className="flex gap-3">
                  <IconClose
                    width={16}
                    height={16}
                    className="mt-0.5 shrink-0"
                    style={{ color: 'var(--status-weak)' }}
                  />
                  <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                    {line}
                  </p>
                </li>
              ))}
            </ul>
            <p
              className="mt-5 border-t pt-4 text-[13px] leading-relaxed"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              A student who knows a teacher is watching their weak topics stops recording weak
              topics, and then the map is worth nothing to anybody.
            </p>
          </div>
        </div>
      </Band>

      <Band tint>
        <h2 className="text-[clamp(1.4rem,2.6vw,1.8rem)] font-semibold leading-tight tracking-[-0.028em]">
          How a rollout goes
        </h2>
        <div className="mt-8">
          <RolloutTrack
            steps={[
              ['Tell us the year group', 'How many students, which curriculum, and the email domain they use.'],
              ['You get a code', 'One string, with a redemption limit set to the size of the group.'],
              ['Students type it in', 'At sign-up, or later from their account. Everything opens immediately.'],
            ]}
          />
        </div>

        <div className="mt-12 grid items-center gap-8 md:grid-cols-[1.2fr_1fr] md:gap-14">
          <div>
            <Eyebrow>What opens</Eyebrow>
            <p className="mt-4 text-[clamp(2rem,4vw,2.8rem)] font-semibold leading-none tracking-[-0.03em] tabular-nums">
              {total} courses
            </p>
            <p className="mt-3 max-w-md text-[14.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Across IB, A-Level and AP, mapped topic by topic from the official outlines. The whole
              year group gets the full product, not a stripped-down school tier.
            </p>
            <Link href="/subjects" className="btn btn-outline control-md mt-6">
              See the full list
            </Link>
          </div>
          <CoverageBar
            parts={[
              { label: 'IB', value: coursesIn('IB'), tone: 'var(--status-mastered)' },
              { label: 'A-Level', value: coursesIn('A-Level'), tone: 'var(--status-proficient)' },
              { label: 'AP', value: coursesIn('AP'), tone: 'var(--status-developing)' },
            ]}
          />
        </div>
      </Band>
    </PageShell>
  )
}
