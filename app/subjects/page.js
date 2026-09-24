import PageShell, { PageHead, Band } from '@/components/marketing/PageShell'
import { CURRICULUMS, coursesIn, entriesIn, groupsOf } from '@/lib/catalogue'
import Link from 'next/link'
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
        intro="Every one of these is broken into topics and subtopics from the official outline. Question coverage is still being built and runs deeper in some than others — the app tells you which, rather than hiding it."
      >
        <div className="mt-10 flex flex-wrap gap-3">
          {curricula.map((id) => (
            <a
              key={id}
              href={`#${id.toLowerCase()}`}
              className="elev rounded-[12px] border px-5 py-4"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
            >
              <span className="block text-[14.5px] font-semibold tracking-[-0.015em]">{id}</span>
              <span className="mt-1 block text-[12.5px] font-medium tabular-nums" style={{ color: 'var(--brand)' }}>
                {coursesIn(id)} courses
              </span>
            </a>
          ))}
        </div>
      </PageHead>

      {curricula.map((id, n) => (
        <Band key={id} tint={n % 2 === 1} className="scroll-mt-20">
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
