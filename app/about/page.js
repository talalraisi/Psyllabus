import Link from 'next/link'
import PageShell, { PageHead, Band } from '@/components/marketing/PageShell'
import { SubjectLoad, PickOrPlan, StatRow, Panel, Eyebrow } from '@/components/marketing/visuals'
import { coursesIn } from '@/lib/catalogue'
import { IconArrowRight } from '@/components/Icons'

export const metadata = {
  title: 'About',
  description:
    'Project Syllabus is built by an IB Diploma student in Muscat, Oman, for students who want to know where they actually stand before the exam tells them.',
}

/**
 * Why this exists, shown more than told.
 *
 * This page was two and a half thousand characters of unbroken prose under
 * six identical headings, and the story it tells is a visual one: six
 * subjects, hundreds of subtopics, an eight o'clock start with no idea which
 * to open. Most of that is now drawn, and what is left of the writing is the
 * part a picture cannot carry — the reasoning.
 */
const MY_SUBJECTS = [
  ['Maths AA', 'HL'],
  ['Computer Science', 'HL'],
  ['Economics', 'HL'],
  ['Physics', 'SL'],
  ['English Lang & Lit', 'SL'],
  ['Arabic', 'SL'],
]

export default function AboutPage() {
  return (
    <PageShell>
      <PageHead
        eyebrow="About"
        title="I built the thing I needed at eight o’clock"
        intro="I am Talal Al-Raisi, a Diploma student at ABA Oman International School in Muscat. Six subjects, two years, and no way of telling which part of them actually needed me tonight."
      >
        <div className="mt-10 max-w-lg">
          <SubjectLoad subjects={MY_SUBJECTS} />
        </div>
      </PageHead>

      <Band tint>
        <h2 className="max-w-xl text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-tight tracking-[-0.03em]">
          The problem was never finding material
        </h2>
        <p className="mt-4 max-w-xl text-[15px] leading-[1.7]" style={{ color: 'var(--text-body)' }}>
          There is more of it than anyone could work through. Knowing which part I needed on a given
          evening was the problem. I would sit down at eight, pick whichever subject felt worst, and
          hope — often polishing something I already knew while a real gap sat untouched for weeks.
        </p>
        <div className="mt-10">
          <PickOrPlan />
        </div>
      </Band>

      <Band>
        <div className="grid gap-10 md:grid-cols-[1fr_1fr] md:gap-14">
          <div>
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-tight tracking-[-0.03em]">
              What I think study tools get wrong
            </h2>
            <p className="mt-5 text-[15px] leading-[1.7]" style={{ color: 'var(--text-body)' }}>
              Almost every tracker asks you to rate your own confidence — the one number a student
              cannot supply honestly, and not because anyone is lying. You do not know what you do
              not know. Rate yourself and you get a map of your mood, then revise against that
              instead of the syllabus.
            </p>
            <p className="mt-4 text-[15px] leading-[1.7]" style={{ color: 'var(--text-body)' }}>
              So this never asks. Every level comes from questions you either got right or did not,
              and anything untested stays grey and says so.
            </p>
          </div>

          <Panel className="self-start">
            <Eyebrow>Your results belong to you</Eyebrow>
            <p className="mt-4 text-[14.5px] leading-[1.7]" style={{ color: 'var(--text-body)' }}>
              There are no teacher accounts and no class dashboards, and there will not be. A school
              licence unlocks the app for its students and does nothing else.
            </p>
            <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Nobody at your school can see how you are doing, and that is enforced by the database
              rather than by a setting somebody could change. The{' '}
              <Link href="/privacy" className="underline" style={{ color: 'var(--brand)' }}>
                privacy policy
              </Link>{' '}
              spells out exactly what is stored.
            </p>
          </Panel>
        </div>
      </Band>

      <Band tint>
        <h2 className="max-w-xl text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-tight tracking-[-0.03em]">
          Where it is up to
        </h2>
        <div className="mt-10">
          <StatRow
            stats={[
              { value: 6583, label: 'IB subtopics mapped, across all six groups and the core' },
              { value: coursesIn('IB') + coursesIn('A-Level') + coursesIn('AP'), label: 'courses mapped across three curricula' },
              { value: 8, label: 'features working today, from decay to the predicted grade' },
              { value: 1, suffix: ' person', label: 'building it, in Muscat, between lessons' },
            ]}
          />
        </div>
        <p className="mt-10 max-w-xl text-[15px] leading-[1.7]" style={{ color: 'var(--text-body)' }}>
          The question bank is the part still being built, subject by subject rather than all at
          once. The app says how deep coverage is for your subject instead of hiding it.
        </p>
      </Band>

      <Band>
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-lg">
            <h2 className="text-[clamp(1.4rem,2.6vw,1.8rem)] font-semibold leading-tight tracking-[-0.028em]">
              Get in touch
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
              A student with something that would make this better, or a school wanting it for a
              year group — I would like to hear from you at{' '}
              <a
                href="mailto:talalraisi1@gmail.com?subject=Project%20Syllabus"
                className="underline"
                style={{ color: 'var(--brand)' }}
              >
                talalraisi1@gmail.com
              </a>
              .
            </p>
          </div>
          <Link href="/signup" className="btn btn-solid control-lg">
            Create a free account
            <IconArrowRight width={16} height={16} />
          </Link>
        </div>
        <p className="t-caption mt-12">Built in Muscat, Oman.</p>
      </Band>
    </PageShell>
  )
}
