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
              The problem was never finding material. There is more revision content online than
              anyone could work through in a lifetime. The problem was knowing which part of it I
              actually needed on a given evening. I would sit down at eight o&rsquo;clock, pick
              whichever subject felt worst, and hope that guess was right. Sometimes it was. Often I
              was polishing something I already knew while a real gap sat untouched for weeks.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">
              What I think most study tools get wrong
            </h2>
            <p>
              Almost every tracker asks you to rate your own confidence. That is the one number a
              student cannot supply honestly, and not because anyone is lying. You do not know what
              you do not know. Rating yourself produces a map of how you feel, and then you revise
              against your mood instead of against the syllabus.
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
              A tool that answers one question properly: what should I do right now. It maps your
              whole course, works out where you actually stand by testing you, notices when
              something you learned in October has started slipping, and hands you an ordered list
              with a reason attached to every item so you can disagree with it.
            </p>
            <p className="mt-3">
              And it gives you a predicted grade out of 45 next to the one you are aiming for, along
              with how much of your syllabus that prediction is actually based on. A number built on
              three quizzes gets labelled as such rather than dressed up as a forecast.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Where it is up to</h2>
            <p>
              The whole IB Diploma is mapped, 2,590 subtopics across all six groups plus Theory of
              Knowledge, the Extended Essay and CAS. The tracking, testing, planner, mistake bank,
              decay engine, calendar and predicted grade all work today.
            </p>
            <p className="mt-3">
              The question bank is the part still being built. It deepens subject by subject rather
              than arriving complete, and I would rather say that plainly than claim a number I have
              not reached. A-Level and AP course structures come after that.
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
