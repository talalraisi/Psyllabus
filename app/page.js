import Link from 'next/link'
import Logo from '@/components/Logo'

export default function Home() {
  return (
    <main className="page">
      <nav className="flex items-center justify-between px-8 py-4 border-b border-border bg-bg-elevated">
        <Logo width={350} height={105} priority />
        <div className="flex items-center gap-3">
          <a
            href="https://tally.so/r/Pd4aLx"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-sm px-5 py-2.5"
          >
            Join waitlist
          </a>
        </div>
      </nav>

      <section className="marketing-hero-grid px-6 pt-20 pb-24 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="badge mb-8">Coming Soon · Join the Waitlist</span>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-text leading-[1.1] mb-6 tracking-tight">
            Stop guessing.<br />
            <span className="text-accent">Start progressing.</span>
          </h1>

          <p className="text-text-muted text-lg max-w-xl mx-auto leading-relaxed mb-10">
            PSyllabus maps your IB, A-Level, or AP syllabus topic by topic
            and tells you exactly what to study today based on where
            you&apos;re actually falling behind.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <a
              href="https://tally.so/r/Pd4aLx"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-base px-10 py-4"
            >
              Join waitlist
            </a>
          </div>
          <p className="text-text-faint text-sm">Be the first to know when we launch</p>
        </div>
      </section>

      <div className="border-y border-border py-10 px-6 bg-bg-subtle">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-text font-extrabold text-3xl mb-1">3</p>
            <p className="text-text-muted text-sm">Curriculums covered</p>
          </div>
          <div>
            <p className="text-text font-extrabold text-3xl mb-1">5,000+</p>
            <p className="text-text-muted text-sm">Syllabus topics mapped</p>
          </div>
          <div>
            <p className="text-text font-extrabold text-3xl mb-1">$0</p>
            <p className="text-text-muted text-sm">During beta</p>
          </div>
        </div>
      </div>

      <section className="px-6 py-20 max-w-3xl mx-auto text-center">
        <p className="section-label mb-4">The Problem</p>
        <h2 className="text-text text-3xl sm:text-4xl font-bold mb-6 leading-tight">
          You&apos;re working hard.<br />But on the wrong things.
        </h2>
        <p className="text-text-muted text-lg leading-relaxed">
          Revision Village gives you questions. Save My Exams gives you notes.
          Neither tells you whether you&apos;re actually on track for the grade you need.
          You find out when results come back. By then it&apos;s too late.
        </p>
      </section>

      <section className="px-6 py-10 max-w-4xl mx-auto pb-20">
        <p className="section-label text-center mb-4">How It Works</p>
        <h2 className="text-text text-3xl font-bold text-center mb-12">
          Three things no other tool does together
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              num: '01',
              title: 'Your syllabus. Every topic.',
              desc: "Every topic and subtopic from your official curriculum in one place.",
            },
            {
              num: '02',
              title: 'A heatmap of your gaps.',
              desc: "Rate each subtopic weak, review, solid, or mastered. See exactly where you're behind.",
            },
            {
              num: '03',
              title: "Today's plan. Built for you.",
              desc: 'We surface your weakest topics so you know what to study today.',
            },
          ].map((item) => (
            <div key={item.num} className="card card-pad">
              <p className="text-accent font-bold text-sm mb-4">{item.num}</p>
              <h3 className="text-text font-bold text-lg mb-3">{item.title}</h3>
              <p className="text-text-muted text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-16 max-w-2xl mx-auto text-center border-t border-border">
        <p className="text-text-muted text-lg leading-relaxed mb-6">
          &ldquo;I built this because every tool I tried either gave me random questions
          or charged me $500 for content that wasn&apos;t even on the current syllabus.
          So I built what I actually needed.&rdquo;
        </p>
        <p className="text-text font-bold">Talal Al-Raisi</p>
        <p className="text-text-muted text-sm mt-1">Founder · IB Student · Muscat, Oman</p>
      </section>

      <section className="px-6 py-20 flex flex-col items-center text-center bg-bg-subtle border-t border-border">
        <h2 className="text-text text-3xl font-bold mb-4">
          Be the first to know when we launch
        </h2>
        <p className="text-text-muted mb-8 max-w-md">
          Join students who are done guessing what to study.
        </p>
        <a
          href="https://tally.so/r/Pd4aLx"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary text-lg px-12 py-4"
        >
          Join waitlist
        </a>
      </section>

      <footer className="px-8 py-8 flex items-center justify-between border-t border-border">
        <Logo width={280} height={84} />
        <p className="text-text-faint text-xs">© 2026 PSyllabus · Built in Muscat, Oman</p>
      </footer>
    </main>
  )
}
