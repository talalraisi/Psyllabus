import PageShell, { PageHead, Band } from '@/components/marketing/PageShell'
import { CURRICULUMS, coursesIn, entriesIn, groupsOf } from '@/lib/catalogue'
import Link from 'next/link'
import { CourseFinder, CoverageBar, StatRow, SyllabusTree } from '@/components/marketing/visuals'
import { IconArrowRight } from '@/components/Icons'

export const metadata = {
  title: 'Subjects',
  description:
    'Every IB Diploma, A-Level and AP course Project Syllabus has mapped, listed in full, with the levels each one is offered at.',
}

/**
 * What is actually in here, written out.
 *
 * This is the first thing anybody checks and there was nowhere to check it —
 * the front page gave three totals and the only way to see the list was to
 * make an account and open the subject picker. Somebody deciding whether this
 * is worth signing up for is asking one question, and it is this one.
 *
 * The list is generated from the same module onboarding picks from, so it
 * cannot drift from what you are offered after you sign up.
 */
const ORDER = ['IB', 'A-Level', 'AP']

const BLURB = {
  IB: 'Every group, both levels, with Theory of Knowledge and the Extended Essay alongside them.',
  'A-Level': 'AS and A2 content, split the way the specifications split it.',
  AP: 'Course and exam description units, unit by unit.',
}

export default function SubjectsPage() {
  const curricula = ORDER.filter((id) => CURRICULUMS[id])
  const total = curricula.reduce((n, id) => n + coursesIn(id), 0)

  return (
    <PageShell>
      <PageHead
        eyebrow="Coverage"
        title={`${total} courses, mapped topic by topic`}
        intro="Every one is broken into topics and subtopics from the official outline. Question coverage is still being built and runs deeper in some than others. The app tells you which, rather than hiding it."
      >
        {/* Twenty boxes of course names is a page you scan with a finger.
            Everybody arrives with the same question — is mine in here — and a
            field that filters as you type answers it in about a second. The
            full list stays underneath for browsing. */}
        <div className="mt-10 max-w-xl">
          <CourseFinder curricula={curricula.map((id) => ({ id, groups: groupsOf(id) }))} />
        </div>

        <div className="mt-12 max-w-2xl">
          <CoverageBar
            parts={[
              { label: 'IB', value: coursesIn('IB'), tone: 'var(--status-mastered)' },
              { label: 'A-Level', value: coursesIn('A-Level'), tone: 'var(--status-proficient)' },
              { label: 'AP', value: coursesIn('AP'), tone: 'var(--status-developing)' },
            ]}
          />
        </div>

        <div className="mt-12">
          <StatRow
            stats={[
              { value: total, label: 'courses, listed in full below' },
              { value: entriesIn('IB') + entriesIn('A-Level') + entriesIn('AP'), label: 'entries once levels are counted separately' },
              { value: 6583, label: 'subtopics mapped from official outlines' },
              { value: 3, label: 'curricula, with more asked for than built' },
            ]}
          />
        </div>
      </PageHead>

      {/* "Mapped topic by topic" is four words everybody nods at without
          picturing. This is the picture. */}
      <Band tint>
        <div className="grid items-center gap-10 md:grid-cols-[1fr_1.1fr] md:gap-14">
          <div>
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-tight tracking-[-0.03em]">
              What “mapped” means
            </h2>
            <p className="mt-5 text-[15px] leading-[1.7]" style={{ color: 'var(--text-body)' }}>
              A course opens into topics, and a topic opens into the things you are actually
              examined on. The colour goes on that bottom level, because a subtopic is the size of
              thing a question can prove. Anything larger and a green tick would be hiding
              something.
            </p>
          </div>
          <SyllabusTree />
        </div>
      </Band>

      {curricula.map((id, n) => (
        <Band key={id} tint={n % 2 === 0} className="scroll-mt-20">
          <div id={id.toLowerCase()} className="scroll-mt-24">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-tight tracking-[-0.03em]">
                {id}
              </h2>
              <p className="text-[13px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                {coursesIn(id)} courses · {entriesIn(id)} entries with levels
              </p>
            </div>
            <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {BLURB[id]}
            </p>

            <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groupsOf(id).map((group) => (
                <div
                  key={group.name}
                  className="elev rounded-[14px] border p-5"
                  style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
                >
                  <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
                    {group.name}
                  </h3>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {group.courses.map(({ course, levels }) => (
                      <li key={course} className="flex items-baseline justify-between gap-3">
                        <span className="text-[13.5px] leading-snug">{course}</span>
                        {levels.length > 0 && (
                          <span
                            className="shrink-0 text-[10.5px] font-semibold tracking-[0.08em]"
                            style={{ color: 'var(--text-faint)' }}
                          >
                            {levels.join(' · ')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Band>
      ))}

      <Band>
        <div className="flex flex-wrap items-center justify-between gap-6">
          <p className="max-w-lg text-[15px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            Not seeing yours? Tell us which course and which board, and it goes on the list.
          </p>
          <Link href="/signup" className="btn btn-solid control-lg">
            Start free with one subject
            <IconArrowRight width={16} height={16} />
          </Link>
        </div>
      </Band>
    </PageShell>
  )
}
