import Link from 'next/link'
import Image from 'next/image'
import logoMark from '@/public/logo-mark.png'
import { IconCheck, IconArrowRight } from '@/components/Icons'

export const metadata = {
  title: 'Project Syllabus: know exactly what to study next',
  description:
    'Project Syllabus tracks your IB, A-Level or AP syllabus topic by topic. Where you stand is set by testing, not by how confident you feel.',
}

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Map your syllabus',
    body: 'Pick your subjects and see every topic and subtopic from the official course outline on one screen.',
  },
  {
    step: '02',
    title: 'Prove what you know',
    body: 'Take a quiz on any subtopic. Where you stand comes from how many you got right, not from how you felt about it.',
  },
  {
    step: '03',
    title: 'Study what actually matters',
    body: 'Weak and fading subtopics rise to the top of your plan, and every question you got wrong comes back for review.',
  },
]

const FEATURES = [
  ['Heatmap you cannot fake', 'Every subtopic is coloured by your real test results, so nothing shows as known on a guess.'],
  ['Topics that fade', 'Nail something, leave it two weeks and it fades to amber and comes back into your plan.'],
  ['Mistake bank', 'Questions you got wrong come back on a spaced schedule, so you drill your own gaps.'],
  ['Timed papers', 'Build a paper from any mix of topics and sit it against a live marks-per-minute clock.'],
  ['Real resources on every subtopic', 'Hand-picked lessons, videos and notes for the exact thing you got wrong, not a search box.'],
  ['Predicted grade', 'A running prediction out of 45, built from your quiz results, next to the grades you told us you want.'],
]


const FAQ = [
  {
    q: 'What is Project Syllabus?',
    a: 'Project Syllabus is a study tracker for students taking the International Baccalaureate Diploma, A-Levels or AP exams. It lays out every topic and subtopic of your official course, works out which parts you are weak on by testing you, and tells you what to study today. It was built in Muscat, Oman by an IB Diploma student.',
  },
  {
    q: 'How is it different from a revision app or flashcards?',
    a: 'Most trackers ask you to rate your own confidence, and most students are poor judges of what they actually know. Project Syllabus never asks. Every subtopic is coloured by how many questions you got right, so the map of your course reflects tested ability rather than how you happen to feel about a topic.',
  },
  {
    q: 'How does the syllabus tracking work?',
    a: 'Pick your subjects and you get the full course broken into topics and subtopics, taken from the official course outlines. Each subtopic carries one of four statuses: untested, weak, shaky, or mastered. Every status comes from a quiz, and nothing is marked known until you have proved it.',
  },
  {
    q: 'What does the study plan actually do?',
    a: 'Tell it how long you have, from five minutes to eight hours, and it builds a session that fits. It ranks subtopics by what you have got wrong, what is fading, what a test is coming up on, and which foundations unlock later topics. Every item says why it is there, so you can disagree with it.',
  },
  {
    q: 'What is skill decay?',
    a: 'Knowledge fades when you leave it alone. Master a subtopic and stop practising it, and after about two weeks Project Syllabus fades it from green to amber and puts it back into your plan for a short retest. This keeps what you learned in October from quietly disappearing before May.',
  },
  {
    q: 'How is my predicted grade calculated?',
    a: 'Quiz accuracy across each subject is converted into a predicted grade from 1 to 7, then totalled with the TOK and Extended Essay bonus into a score out of 45, shown against the target you set. It also tells you how much of your syllabus you have actually tested, so a prediction built on three quizzes is labelled low confidence instead of being dressed up as a forecast.',
  },
  {
    q: 'Is it free?',
    a: 'One subject is free with no time limit and no card: every topic, every quiz, its own study plan and heatmap. Unlocking all your subjects is $12 a month or $108 a year. Schools can buy a licence from $500 to $2,000 a year that covers their students.',
  },
  {
    q: 'Do teachers see my results?',
    a: 'No. There are no teacher accounts and no class dashboards. A school licence is a code that unlocks the app for its students, and nothing more. Your results are yours.',
  },
  {
    q: 'Which subjects are covered?',
    a: 'All six IB Diploma subject groups are mapped, along with Theory of Knowledge, the Extended Essay and CAS, which are treated as the Diploma core rather than as optional subjects. A-Level and AP course structures are next.',
  },
  {
    q: 'Where does the question bank come from?',
    a: 'Questions are generated against each subtopic and then checked by a separate verification pass that solves each one independently before it reaches you. Anything that fails is thrown away. The bank is deepening subject by subject rather than being complete on day one, and we would rather say that than pretend otherwise.',
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--bg)]">
      {/* Lets search engines answer these questions directly. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.map(({ q, a }) => ({
              '@type': 'Question',
              name: q,
              acceptedAnswer: { '@type': 'Answer', text: a },
            })),
          }),
        }}
      />
      {/* Navigation with the real entry points */}
      <nav className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-8">
          <Link href="/" aria-label="PSyllabus home" className="shrink-0">
            <Image
              src={logoMark}
              alt="Project Syllabus"
              priority
              sizes="72px"
              className="h-9 w-auto md:h-11"
            />
          </Link>
          {/* Narrow screens drop Pricing and use compact controls so the row
              never overflows the viewport. */}
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/pricing" className="btn btn-quiet control-md hidden md:inline-flex">
              Pricing
            </Link>
            <Link
              href="/login"
              className="btn btn-quiet control-sm px-3 text-[13px] md:control-md md:px-4 md:text-sm"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="btn btn-solid control-sm px-3 text-[13px] md:control-md md:px-4 md:text-sm"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="marketing-hero-grid border-b border-[var(--border)] px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mb-6 text-4xl font-bold leading-[1.1] tracking-tight text-[var(--text)] sm:text-6xl">
            Stop guessing.
            <br />
            <span className="text-[var(--brand)]">Start progressing.</span>
          </h1>

          <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-[var(--text-muted)]">
            Project Syllabus lays out your IB, A-Level or AP course topic by topic, then tells you
            what to work on today based on where you are actually behind.
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="btn btn-solid control-lg w-full px-8 sm:w-auto">
              Create a free account
            </Link>
            <Link href="/login" className="btn btn-quiet control-lg w-full px-8 sm:w-auto">
              I already have an account
            </Link>
          </div>
          <p className="mt-4 text-sm text-[var(--text-faint)]">
            No card needed. One subject free, and your school code unlocks the rest.
          </p>
        </div>
      </section>

      {/* Proof points */}
      <section className="border-b border-[var(--border)] bg-[var(--surface-sunken)] px-5 py-10 md:px-8">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-4 text-center">
          {[
            ['2,590', 'Subtopics mapped from official course outlines'],
            ['4', 'Status levels, every one set by a quiz'],
            ['45', 'Points predicted, against the target you set'],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="t-stat text-[var(--text)]">{value}</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-5 py-20 md:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="t-overline mb-3">How it works</h2>
          <p className="mb-10 max-w-2xl text-2xl font-semibold leading-snug text-[var(--text)]">
            Feeling ready and being ready are two different things. Project Syllabus only ever
            measures the second one.
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {HOW_IT_WORKS.map(({ step, title, body }) => (
              <div key={step} className="surface p-6">
                <span className="t-caption font-semibold text-[var(--brand)]">{step}</span>
                <h3 className="t-card-title mt-3">{title}</h3>
                <p className="t-small mt-2">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-[var(--border)] px-5 py-20 md:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="t-overline mb-3">What you get</h2>
          <p className="mb-10 max-w-2xl text-2xl font-semibold leading-snug text-[var(--text)]">
            Everything you need to revise properly, in one place.
          </p>

          <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
            {FEATURES.map(([title, body]) => (
              <div key={title} className="flex gap-3">
                <IconCheck width={18} height={18} className="mt-1 shrink-0 text-[var(--brand)]" />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
                  <p className="t-small mt-1">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Schools */}
      <section className="border-t border-[var(--border)] bg-[var(--surface-sunken)] px-5 py-20 md:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-2xl font-semibold text-[var(--text)]">
            Getting Project Syllabus into your school
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-[var(--text-body)]">
            A school buys one code and hands it to its students. Everyone who types it in gets every
            subject unlocked. There is nothing for teachers to set up and nothing for them to log
            into, because your results are yours and nobody else sees them.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/pricing" className="btn btn-solid control-md px-6">
              See how school access works
            </Link>
            <a
              href="mailto:talalraisi1@gmail.com?subject=PSyllabus%20for%20our%20school"
              className="btn btn-quiet control-md px-6"
            >
              Contact us
            </a>
          </div>
        </div>
      </section>


      {/* Detail. Written to be read by a person and quoted by a search engine. */}
      <section className="border-t border-[var(--border)] px-5 py-20 md:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="t-overline mb-3">Questions people ask</h2>
          <p className="mb-10 max-w-2xl text-2xl font-semibold leading-snug text-[var(--text)]">
            What Project Syllabus is, and how it works.
          </p>

          <div className="flex flex-col">
            {FAQ.map(({ q, a }, i) => (
              <div
                key={q}
                className={`py-6 ${i > 0 ? 'border-t border-[var(--border)]' : 'pt-0'}`}
              >
                <h3 className="mb-2 text-base font-semibold text-[var(--text)]">{q}</h3>
                <p className="text-sm leading-relaxed text-[var(--text-body)]">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final call to action */}
      <section className="px-5 py-20 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-2xl font-semibold text-[var(--text)]">
            Find out where you stand before the exam tells you.
          </h2>
          <Link href="/signup" className="btn btn-solid control-lg mt-2 px-8">
            Create a free account
            <IconArrowRight width={18} height={18} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] bg-[var(--surface)] px-5 py-10 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <Image src={logoMark} alt="Project Syllabus" sizes="96px" style={{ height: 36, width: 'auto' }} />
          <nav className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/pricing" className="t-small hover:text-[var(--text)]">
              Pricing
            </Link>
            <Link href="/privacy" className="t-small hover:text-[var(--text)]">
              Privacy
            </Link>
            <Link href="/terms" className="t-small hover:text-[var(--text)]">
              Terms
            </Link>
            <Link href="/login" className="t-small hover:text-[var(--text)]">
              Log in
            </Link>
          </nav>
          <p className="t-caption">Built in Muscat, Oman</p>
        </div>
      </footer>
    </main>
  )
}
