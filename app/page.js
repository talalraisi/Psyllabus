import Link from 'next/link'
import Image from 'next/image'
import logoMark from '@/public/logo-mark.png'
import { IconCheck, IconArrowRight, IconClose } from '@/components/Icons'
import ThemeToggle from '@/components/ThemeToggle'
import { operatorLine, OPERATOR } from '@/lib/legal'
import { coursesIn } from '@/lib/catalogue'
import { HOW_IT_WORKS, FEATURES, WHY, ANSWERS } from '@/components/marketing/content'
import { Heatmap, DecayDemo, PlanDemo } from '@/components/marketing/interactive'
import { Reveal, ScrollBar, CountUp, ForgettingCurve } from '@/components/marketing/scroll'
import SiteNav from '@/components/marketing/SiteNav'
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

function Section({ children, label, tint = false, className = '', id }) {
  return (
    <section
      id={id}
      className={`relative isolate scroll-mt-16 border-t px-5 py-20 md:px-8 md:py-28 ${className}`}
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
      <ScrollBar />

      <header
        className="sticky top-0 z-20 border-b backdrop-blur-md"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in oklab, var(--bg) 82%, transparent)',
        }}
      >
        <div className="mx-auto flex max-w-6xl px-5 py-3 md:px-8">
          <SiteNav>
            <Link href="/" aria-label="Project Syllabus home" className="shrink-0">
              <Image src={logoMark} alt="Project Syllabus" sizes="140px" style={{ height: 34, width: 'auto' }} priority />
            </Link>
          </SiteNav>
        </div>
      </header>

      <main>
        {/* ---------------------------------------------------------- hero */}
        <section className="ground relative px-5 py-24 md:px-8 md:py-36">
          {/* No wash behind the headline. Two slow blooms lived here and they
              read as coloured spots on the page rather than as light — twice
              noticed, twice disliked, so they are gone rather than tuned. The
              page still moves while you sit on it: the grid behind this
              creeps one tile a minute. */}
          <div className="hero-in mx-auto max-w-6xl">
            <h1 className="max-w-3xl text-[clamp(2.6rem,6vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.038em]">
              Stop guessing.
              <br />
              <span style={{ color: 'var(--brand)' }}>Start progressing.</span>
            </h1>

            <p
              className="mt-8 max-w-xl text-[17px] leading-[1.6]"
              style={{ color: 'var(--text-body)' }}
            >
              Every subtopic, coloured by what you proved in a quiz. Never by rating yourself.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn btn-solid control-lg">
                Start free with one subject
                <IconArrowRight width={16} height={16} />
              </Link>
              <Link href="#how-it-works" className="btn btn-outline control-lg">
                See how it works
              </Link>
            </div>

            {/* The three programmes, with what is actually mapped for each.
                This was three promises about pricing and privacy, which are
                true and are also on the pricing page, the terms and the footer.
                What somebody landing here needs to know first is whether their
                own course is in it. */}
            {/* Real cards, sitting on the page rather than three columns
                separated by hairlines. This is the first thing somebody
                checks — whether their own course is in here — so it is worth
                looking like something. */}
            <dl className="mt-20 grid gap-3 sm:grid-cols-3">
              {[
                ['IB Diploma', `${coursesIn('IB')} courses mapped`, 'Every group, HL and SL, with the core alongside them.'],
                ['A-Level', `${coursesIn('A-Level')} courses mapped`, 'AS and A2 content, split the way the specifications split it.'],
                ['AP', `${coursesIn('AP')} courses mapped`, 'Course and exam description units, unit by unit.'],
              ].map(([term, count, def]) => (
                <div
                  key={term}
                  className="elev lift rounded-[14px] border p-6"
                  style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
                >
                  <dt className="text-[15px] font-semibold tracking-[-0.015em]">{term}</dt>
                  <dd className="mt-1.5 text-[13px] font-medium tabular-nums" style={{ color: 'var(--brand)' }}>
                    {count}
                  </dd>
                  <dd className="mt-3 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
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
        <Section label="How it works" id="how-it-works">
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
        <Section label="The ladder" id="mastery">
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
                className="cell fade-breathe rounded-lg border border-dashed"
                style={{ height: '50px', borderColor: 'var(--status-fading)', animationDelay: '400ms' }}
              />
              <p className="mt-3 text-[12.5px] font-medium" style={{ color: 'var(--status-fading)' }}>Fading</p>
            </div>
          </div>

          <p className="mt-9 max-w-xl text-[15px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            Ten points is mastery. Leave a subtopic alone and it fades back, because that is what happens to it.
          </p>
        </Section>

        {/* ---------------------------------------------------------- decay */}
        <Section label="Fading" tint>
          <div className="grid gap-10 md:grid-cols-[1fr_1fr] md:gap-14">
            <div>
              <Heading>Drag time forward</Heading>
              <p className="mt-5 text-[15.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                October&rsquo;s mastery is not May&rsquo;s. Move the slider and watch it slip back into your plan.
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
                Five minutes or five hours. Every line says why it is there, so you can disagree with it.
              </p>
            </div>
            <PlanDemo />
          </div>
        </Section>

        {/* ------------------------------------------------------- features */}
        <Section label="Features" tint id="features">
          <Heading className="max-w-2xl">Three questions, and what answers each</Heading>
          <p className="mt-4 max-w-lg text-[15.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            Shown rather than described, because a list of feature names tells you nothing about
            whether any of it is any good.
          </p>

          <FeatureModules />

          {/* Eight slides is enough to decide whether to keep reading and not
              enough to decide whether to sign up. The long version is its own
              page rather than another twenty screens of this one. */}
          <div className="mt-14 flex justify-center">
            <Link href="/features" className="btn btn-outline control-lg">
              Learn more about every feature
              <IconArrowRight width={16} height={16} />
            </Link>
          </div>

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
        {/* A line and a door, not the whole case.

            The panel that used to be here — what a school gets, what it does
            not get, how a rollout goes — is the schools page now. Saying it
            twice means a head of year reads it here, follows the link, and is
            told it again, which makes the second page look like it has
            nothing of its own. */}
        <Section tint id="schools">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-xl">
              <Heading>One code opens it for the whole year group</Heading>
              <p className="mt-5 text-[15.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                Typed in once at sign-up. No cards, no seat counting, every code has a limit, and
                no teacher dashboard on any plan.
              </p>
            </div>
            <Link href="/schools" className="btn btn-outline control-lg">
              How it works for schools
              <IconArrowRight width={16} height={16} />
            </Link>
          </div>
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
              className="btn btn-solid control-lg mt-9"
            >
              Create a free account
              <IconArrowRight width={16} height={16} />
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
