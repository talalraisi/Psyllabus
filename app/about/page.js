import { Suspense } from 'react'
import Link from 'next/link'
import BackLink from '@/components/BackLink'
import { IconArrowRight } from '@/components/Icons'

export const metadata = {
  title: 'About',
  description:
    'Project Syllabus is built by an IB Diploma student in Muscat, Oman, for students who want to know where they actually stand before the exam tells them.',
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <div className="mx-auto max-w-3xl px-5 py-12 md:py-16">
        <Suspense fallback={<span className="text-sm text-[var(--brand)]">&larr; Back</span>}>
          <BackLink />
        </Suspense>

        <header className="mt-6 mb-10">
          <h1 className="t-page-title mb-3">About Project Syllabus</h1>
          <p className="text-lg leading-relaxed text-[var(--text-body)]">
            I am Talal Al-Raisi, a Diploma Programme student at ABA Oman International School in
            Muscat. I am building Project Syllabus because I needed it, and because nothing I could
            find actually did the job.
          </p>
        </header>

        <div className="flex flex-col gap-8 text-sm leading-relaxed text-[var(--text-body)]">
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Why I started</h2>
            <p>
              I take Maths Analysis and Approaches HL, Computer Science HL, Economics HL, Physics
              SL, English Language and Literature SL and Arabic SL. Six subjects, hundreds of
              subtopics, and two years to hold all of it in my head at once.
            </p>
            <p className="mt-3">
              Finding material was never the problem — there is more of it than anyone could work through. Knowing which part I needed on a given evening was. I would sit down at eight, pick whichever subject felt worst, and hope. Often I was polishing something I already knew while a real gap sat untouched for weeks.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">
              What I think most study tools get wrong
            </h2>
            <p>
              Almost every tracker asks you to rate your own confidence — the one number a student cannot supply honestly, and not because anyone is lying. You do not know what you do not know. Rate yourself and you get a map of your mood, then revise against that instead of the syllabus.
            </p>
            <p className="mt-3">
              So Project Syllabus never asks. Every level comes from questions you either got right
              or did not. If you have not been tested on something, it stays grey and the app says
              so, rather than assuming.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">What I am trying to build</h2>
            <p>
              A tool that answers one question properly: what should I do right now. It maps the course, tests you to find where you stand, notices what has started slipping, and hands you an ordered list with a reason on every line.
            </p>
            <p className="mt-3">
              And a predicted grade out of 45 beside the one you are aiming for, with how much of the syllabus it rests on. A number built on three quizzes says so.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Where it is up to</h2>
            <p>
              The whole IB Diploma is mapped — 6,583 subtopics across all six groups and the core. Tracking, testing, the planner, redemption, decay, the calendar and the predicted grade all work today.
            </p>
            <p className="mt-3">
              The question bank is the part still being built — subject by subject, not all at once. A-Level and AP come after.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">
              Your results belong to you
            </h2>
            <p>
              There are no teacher accounts and no class dashboards, and there will not be. A school
              licence unlocks the app for its students and does nothing else. Nobody at your school
              can see how you are doing, and that is enforced by the database rather than by a
              setting somebody could change. The{' '}
              <Link href="/privacy" className="text-[var(--brand)] hover:underline">
                privacy policy
              </Link>{' '}
              spells out exactly what is stored.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Get in touch</h2>
            <p>
              If you are a student with something that would make this better, or a school wanting
              it for a year group, I would like to hear from you.{' '}
              <a
                href="mailto:talalraisi1@gmail.com?subject=Project%20Syllabus"
                className="text-[var(--brand)] hover:underline"
              >
                talalraisi1@gmail.com
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Link href="/signup" className="btn btn-solid control-lg px-6">
            Create a free account
            <IconArrowRight width={18} height={18} />
          </Link>
          <Link href="/pricing" className="btn btn-quiet control-lg px-6">
            See pricing
          </Link>
        </div>

        <p className="t-caption mt-10">Built in Muscat, Oman.</p>
      </div>
    </main>
  )
}
