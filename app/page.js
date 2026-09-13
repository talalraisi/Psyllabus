import Link from 'next/link'
import Image from 'next/image'
import logoMark from '@/public/logo-mark.png'
import { IconCheck, IconArrowRight, IconClose } from '@/components/Icons'
import ThemeToggle from '@/components/ThemeToggle'
import { operatorLine, OPERATOR } from '@/lib/legal'
import { HOW_IT_WORKS, FEATURES, WHY, FAQ, ANSWERS } from '@/components/marketing/content'
import { Heatmap, TryQuestion, DecayDemo, PlanDemo, Faq } from '@/components/marketing/interactive'
import { Reveal, ScrollBar, CountUp, ForgettingCurve } from '@/components/marketing/scroll'
import { FeatureModules } from '@/components/marketing/features'

export const metadata = {
  title: 'Project Syllabus',
  description:
    'Project Syllabus tracks your IB, A-Level or AP syllabus topic by topic. Where you stand is set by testing, not by how confident you feel.',
}

/**
 * The numbers are read from the database rather than typed here.
 *
 * They were constants updated by hand after a generation run, and the page
 * advertised 98 questions while the bank held 304. Understating is harmless;
 * the problem is that a number maintained by remembering to maintain it
 * eventually overstates, and a marketing claim has to stay defensible without
 * anyone thinking about it.
 */
async function bankCounts() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/public_bank_counts`,
      {
        method: 'POST',
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'content-type': 'application/json',
        },
        body: '{}',
        next: { revalidate: 3600 },
      }
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function Section({ children, label, tint = false, className = '' }) {
  return (
    <section
      className={`border-t px-5 py-20 md:px-8 md:py-28 ${className}`}
      style={{
        borderColor: 'var(--border)',
        background: tint ? 'var(--surface-sunken)' : 'transparent',
      }}
    >
      <div className="mx-auto max-w-6xl">
        {label && (
          <p
            className="mb-4 text-[11.5px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: 'var(--text-faint)' }}
          >
            {label}
          </p>
        )}
        {children}
      </div>
    </section>
  )
}

function Heading({ children, className = '' }) {
  return (
    <h2
      className={`text-[clamp(1.7rem,3.2vw,2.4rem)] font-semibold leading-[1.12] tracking-[-0.028em] ${className}`}
    >
      {children}
    </h2>
  )
}

export default async function Home() {
  const counts = await bankCounts()

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
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

      <ScrollBar />

      <header
        className="sticky top-0 z-20 border-b backdrop-blur-md"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in oklab, var(--bg) 82%, transparent)',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 md:px-8">
          <Link href="/" aria-label="Project Syllabus home" className="shrink-0">
            <Image src={logoMark} alt="Project Syllabus" sizes="110px" style={{ height: 38, width: 'auto' }} priority />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-full px-3.5 py-2 text-[13px] font-medium sm:block"
              style={{ color: 'var(--text-body)' }}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
              style={{ background: 'var(--brand-solid)' }}
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ---------------------------------------------------------- hero */}
        <section className="ground px-5 py-24 md:px-8 md:py-36">
          <div className="mx-auto max-w-6xl">
            <h1 className="max-w-3xl text-[clamp(2.6rem,6vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.038em]">
              Stop guessing.
              <br />
              <span style={{ color: 'var(--brand)' }}>Start progressing.</span>
            </h1>

            <p
              className="mt-8 max-w-xl text-[17px] leading-[1.6]"
              style={{ color: 'var(--text-body)' }}
            >
              Your whole syllabus, subtopic by subtopic, coloured by what you have actually proved
              in a quiz. Nothing here is filled in by rating yourself out of five.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14.5px] font-semibold text-white transition-transform duration-150 hover:-translate-y-px"
                style={{ background: 'var(--brand-solid)' }}
              >
                Start free with one subject
                <IconArrowRight width={17} height={17} />
              </button>
              <button
                className="rounded-full border px-5 py-3.5 text-[14.5px] font-medium"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-body)' }}
              >
                See how it works
              </button>
            </div>

            {/* The three things a student needs answered in the first ten
                seconds, not a row of labels. */}
            <dl
              className="mt-20 grid gap-px border-t sm:grid-cols-3"
              style={{ borderColor: 'var(--border)', background: 'var(--border)' }}
            >
              {[
                ['One subject, free', 'No trial that expires. Keep it as long as you want.'],
                ['No card, ever, to start', 'A school code opens the rest for nothing.'],
                ['Your notes stay on your device', 'Nothing you paste or upload is sent anywhere or used to train anything.'],
              ].map(([term, def]) => (
                <div key={term} className="px-0 py-6 sm:px-6 sm:first:pl-0" style={{ background: 'var(--bg)' }}>
                  <dt className="text-[13.5px] font-semibold">{term}</dt>
                  <dd className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {def}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* -------------------------------------------------------- coverage */}
        <Section tint>
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-x-8 gap-y-10 text-center md:grid-cols-4">
            {[
              [counts?.subjects ?? 173, '', 'subjects covered'],
              [counts?.subtopics ?? 5914, '', 'subtopics mapped'],
              [3, '', 'curricula'],
              [5, '', 'levels of mastery'],
            ].map(([v, suffix, l], i) => (
              <Reveal key={l} delay={i * 70}>
                <p className="text-[clamp(2rem,3.6vw,2.8rem)] font-semibold leading-none tracking-[-0.03em]">
                  <CountUp to={v} suffix={suffix} />
                </p>
                <p className="mt-2.5 text-[13px]" style={{ color: 'var(--text-muted)' }}>{l}</p>
              </Reveal>
            ))}
          </div>

          <Reveal delay={280}>
            <p
              className="mx-auto mt-12 max-w-lg text-center text-[13.5px] leading-relaxed"
              style={{ color: 'var(--text-faint)' }}
            >
              Question coverage is deeper in some subjects than others, and the app tells you
              which rather than hiding it.
            </p>
          </Reveal>
        </Section>

        {/* --------------------------------------------------- how it works */}
        <Section label="How it works">
          <Heading className="max-w-xl">Three steps, and the second one is the point</Heading>

          <div className="mt-14 grid gap-px md:grid-cols-3" style={{ background: 'var(--border)' }}>
            {HOW_IT_WORKS.map(({ step, title, body }, i) => (
              <Reveal
                key={step}
                delay={i * 80}
                className="p-7 md:p-8"
                style={{ background: 'var(--bg)' }}
              >
                <p
                  className="mb-5 text-[10.5px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: 'var(--text-faint)' }}
                >
                  {step}
                </p>
                <h3 className="text-[18px] font-semibold leading-snug tracking-[-0.018em]">{title}</h3>
                <p className="mt-3 text-[14.5px] leading-[1.7]" style={{ color: 'var(--text-body)' }}>
                  {body}
                </p>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ----------------------------------------------------------- try it */}
        <Section label="Try it">
          <div className="grid gap-10 md:grid-cols-[1fr_1.15fr] md:gap-14">
            <div>
              <Heading>Sit one, right here</Heading>
              <p className="mt-5 text-[15.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                A real question from the bank. Pick a wrong answer on purpose and it will tell you
                the specific mistake that leads there, rather than just showing you the right one.
              </p>
              <p className="mt-4 text-[15.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                Getting it right moves the subtopic by an amount that depends on how hard the
                question was. Ten points is mastery, and you cannot get there on easy ones alone.
              </p>
            </div>
            <TryQuestion />
          </div>
        </Section>

        {/* ------------------------------------------------------ objections */}
        <Section tint>
          <Heading className="max-w-2xl">What students say goes wrong with tools like this</Heading>
          <p className="mt-4 max-w-lg text-[15.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            Taken from what IB students actually complain about. Here is what this does instead.
          </p>

          <ul className="mt-10 flex flex-col gap-3">
            {ANSWERS.map((a, i) => (
              <Reveal
                key={a.them}
                as="li"
                delay={i * 60}
                className="lift grid gap-4 rounded-xl border p-5 md:grid-cols-[1fr_1.3fr] md:gap-8"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <div className="flex gap-3">
                  <IconClose width={16} height={16} className="mt-0.5 shrink-0" style={{ color: 'var(--status-weak)' }} />
                  <p className="text-[14.5px] leading-snug" style={{ color: 'var(--text-muted)' }}>{a.them}</p>
                </div>
                <div className="flex gap-3">
                  <IconCheck width={16} height={16} className="mt-0.5 shrink-0" style={{ color: 'var(--status-proficient)' }} />
                  <p className="text-[14.5px] leading-snug">{a.us}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </Section>

        {/* --------------------------------------------------------- levels */}
        <Section label="The ladder">
          <Heading>Five levels, and only a quiz moves you</Heading>

          <div className="mt-12 flex items-end gap-2 md:gap-3">
            {[['Weak', 'weak', 26], ['Developing', 'developing', 44], ['Proficient', 'proficient', 66], ['Mastered', 'mastered', 100]].map(
              ([label, key, h], i) => (
                <div key={key} className="flex-1">
                  <div
                    className="cell rounded-t-lg"
                    style={{ height: `${h * 1.5}px`, background: `var(--status-${key})`, animationDelay: `${i * 90}ms` }}
                  />
                  <p className="mt-3 text-[12.5px] font-medium">{label}</p>
                </div>
              )
            )}
            <div className="flex-1">
              <div
                className="cell rounded-lg border border-dashed"
                style={{ height: '50px', borderColor: 'var(--status-fading)', animationDelay: '400ms' }}
              />
              <p className="mt-3 text-[12.5px] font-medium" style={{ color: 'var(--status-fading)' }}>Fading</p>
            </div>
          </div>

          <p className="mt-9 max-w-xl text-[15px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            Mastery is worth ten points and a harder question is worth more of them. Leave a
            subtopic alone for long enough and it fades back, because that is what actually
            happens to it.
          </p>
        </Section>

        {/* ---------------------------------------------------------- decay */}
        <Section label="Fading" tint>
          <div className="grid gap-10 md:grid-cols-[1fr_1fr] md:gap-14">
            <div>
              <Heading>Drag time forward</Heading>
              <p className="mt-5 text-[15.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                Something you proved in October is not something you know in May. Move the slider
                and watch a subtopic you had mastered slip back into your plan.
              </p>
            </div>
            <DecayDemo />
          </div>

          <Reveal
            className="mt-12 rounded-2xl border p-6 md:p-8"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <ForgettingCurve />
          </Reveal>
        </Section>

        {/* --------------------------------------------------------- planner */}
        <Section label="The plan">
          <div className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:gap-14">
            <div>
              <Heading>Tell it how long you have</Heading>
              <p className="mt-5 text-[15.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                Five minutes or five hours. The list is ordered, and every line carries the reason
                it is on there, so you can disagree with it rather than trust it.
              </p>
            </div>
            <PlanDemo />
          </div>
        </Section>

        {/* ------------------------------------------------------- features */}
        <Section label="Features" tint>
          <Heading className="max-w-2xl">Eight things, all of them working today</Heading>
          <p className="mt-4 max-w-lg text-[15.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            Shown rather than described, because a list of feature names tells you nothing about
            whether any of it is any good.
          </p>

          <FeatureModules />

        </Section>

        {/* ---------------------------------------------------- why it works */}
        <Section label="Why it works">
          <Heading className="max-w-2xl">Six reasons, none of them about motivation</Heading>
          <div className="mt-12 grid gap-x-14 gap-y-11 md:grid-cols-2">
            {WHY.map(({ title, body }, i) => (
              <Reveal key={title} delay={i * 55}>
                <div className="mb-3 flex items-baseline gap-3">
                  <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--text-faint)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.015em]">{title}</h3>
                </div>
                <p className="text-[14.5px] leading-[1.7]" style={{ color: 'var(--text-body)' }}>{body}</p>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* -------------------------------------------------------- schools */}
        <Section tint>
          <div className="grid items-center gap-10 md:grid-cols-[1.1fr_1fr]">
            <div>
              <Heading className="max-w-lg">One code opens it for the whole year group</Heading>
              <p className="mt-5 max-w-lg text-[15.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                Students type the code in once. No cards, no seat counting, and every code has a
                redemption limit so it cannot quietly become a public unlock.
              </p>
              <a
                href={`mailto:${OPERATOR.dpoEmail}?subject=Project%20Syllabus%20for%20our%20school`}
                className="mt-8 inline-flex items-center gap-2 rounded-full border px-5 py-3.5 text-[14.5px] font-medium"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-body)' }}
              >
                Talk to us about your school
                <IconArrowRight width={16} height={16} />
              </a>
            </div>
            <Reveal className="rounded-[12px] border p-6" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
              <Heatmap cols={8} rows={5} subject="Physics SL · Class of 2028" />
              <p className="mt-4 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                A teacher sees the same map for a class, without seeing anybody&rsquo;s individual answers.
              </p>
            </Reveal>
          </div>
        </Section>

        {/* ------------------------------------------------------------ faq */}
        <Section label="Questions people ask">
          <Faq items={FAQ} />
        </Section>

        {/* ------------------------------------------------------------ cta */}
        <Section>
          <div className="mx-auto max-w-2xl text-center">
            <Heading>Start with one subject. It stays free.</Heading>
            <p className="mx-auto mt-5 max-w-lg text-[15.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
              One quiz is enough to fill in your first subtopic and start the plan.
            </p>
            <Link
              href="/signup"
              className="mt-9 inline-flex items-center gap-2 rounded-full px-7 py-4 text-[15px] font-semibold text-white transition-transform duration-150 hover:-translate-y-px"
              style={{ background: 'var(--brand-solid)' }}
            >
              Create a free account
              <IconArrowRight width={18} height={18} />
            </Link>
          </div>
        </Section>
      </main>

      <footer className="border-t px-5 py-12 md:px-8" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6">
          <p className="text-[13px]" style={{ color: 'var(--text-faint)' }}>
            {operatorLine()}
          </p>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {[
              ['About', '/about'],
              ['Pricing', '/pricing'],
              ['Privacy', '/privacy'],
              ['Terms', '/terms'],
              ['Cookies', '/cookies'],
              ['Refunds', '/refunds'],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                {label}
              </Link>
            ))}
            <ThemeToggle />
          </nav>
        </div>
      </footer>
    </div>
  )
}
