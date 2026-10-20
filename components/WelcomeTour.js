'use client'

import { useState } from 'react'
import Link from 'next/link'
import SyllabiMark from '@/components/SyllabiMark'
import { Flame } from '@/components/Streak'
import { IconArrowRight } from '@/components/Icons'

/**
 * The first thing a new account sees: a short tour of how the app works,
 * ending at the study plan, which is where every day starts from.
 *
 * Seen once per account on this device. The dashboard reads the flag, and
 * anyone can bring it back from the box that replaces it.
 */

const KEY = (id) => `psyllabus:tour:${id}`

export function tourDone(id) {
  try {
    return localStorage.getItem(KEY(id)) === 'done'
  } catch {
    return false
  }
}

function markDone(id) {
  try {
    localStorage.setItem(KEY(id), 'done')
  } catch {
    // Not remembering it means the tour shows again; nothing is lost.
  }
}

export function resetTour(id) {
  try {
    localStorage.removeItem(KEY(id))
  } catch {
    // As above.
  }
}

const LADDER = [
  ['Untested', 'var(--status-untested)'],
  ['Weak', 'var(--status-weak)'],
  ['Developing', 'var(--status-developing)'],
  ['Proficient', 'var(--status-proficient)'],
  ['Mastered', 'var(--status-mastered)'],
]

/* ---------- The little pictures, one per step ---------- */

function WelcomePicture() {
  const loop = [
    ['Plan', 'What to study today'],
    ['Prove', 'Quick exam-style questions'],
    ['Progress', 'Watch it colour in'],
  ]
  return (
    <ol className="flex w-full flex-col gap-2">
      {loop.map(([title, line], k) => (
        <li key={title} className="flex items-center gap-3 rounded-[12px] border px-3.5 py-2.5" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold" style={{ background: 'var(--brand)', color: '#fff' }}>
            {k + 1}
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold">{title}</span>
            <span className="block text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
              {line}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

function PlanPicture() {
  const rows = [
    ['16:00', 'Simple harmonic motion', '25 min', 'var(--status-weak)'],
    ['16:30', 'Chain rule', '20 min', 'var(--status-fading)'],
    ['17:00', 'Mistakes due back', '10 min', 'var(--brand)'],
  ]
  return (
    <div className="flex w-full flex-col gap-2">
      {rows.map(([time, title, mins, dot], i) => (
        <div
          key={title}
          className="flex items-center gap-3 rounded-[12px] border px-3.5 py-2.5"
          style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)', opacity: 1 - i * 0.18 }}
        >
          <span className="w-10 text-[11.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
            {time}
          </span>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{title}</span>
          <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
            {mins}
          </span>
        </div>
      ))}
    </div>
  )
}

function LadderPicture() {
  return (
    <div className="flex w-full flex-col gap-2">
      {LADDER.map(([label, color], i) => (
        <div key={label} className="flex items-center gap-3">
          <span className="h-2 rounded-full" style={{ width: `${30 + i * 15}%`, background: color }} />
          <span className="text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {label}
          </span>
        </div>
      ))}
      <p className="mt-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
        Right answers earn points. Points set the level.
      </p>
    </div>
  )
}

function OrbitPicture() {
  const nodes = ['var(--status-mastered)', 'var(--status-proficient)', 'var(--status-weak)', 'var(--status-developing)', 'var(--status-untested)', 'var(--status-fading)']
  return (
    <svg viewBox="0 0 200 200" className="mx-auto w-full max-w-[200px]" aria-hidden="true">
      <circle cx="100" cy="100" r="72" fill="none" stroke="var(--border-strong)" strokeWidth="1.2" />
      <circle cx="100" cy="100" r="40" fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />
      <g className="tour-spin" style={{ transformOrigin: '100px 100px' }}>
        {nodes.map((c, i) => {
          const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2
          return <circle key={i} cx={100 + 72 * Math.cos(a)} cy={100 + 72 * Math.sin(a)} r="10" fill={c} stroke="var(--surface)" strokeWidth="3" />
        })}
      </g>
      <circle cx="100" cy="100" r="26" fill="var(--surface)" stroke="var(--brand)" strokeWidth="2" />
      <text x="100" y="105" textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--text)">
        42%
      </text>
    </svg>
  )
}

function SyllabiPicture() {
  return (
    <div className="flex w-full flex-col gap-2 text-[12.5px]">
      <p className="ml-auto max-w-[80%] rounded-[14px] rounded-br-[4px] px-3 py-2" style={{ background: 'var(--brand)', color: '#fff' }}>
        Why doesn&apos;t mass change a pendulum&apos;s period?
      </p>
      <div className="flex max-w-[88%] items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--brand)', color: '#fff' }}>
          <SyllabiMark size={11} />
        </span>
        <p className="rounded-[14px] rounded-tl-[4px] border px-3 py-2" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-body)' }}>
          Because mass cancels out: the restoring force and the inertia both scale with it…
        </p>
      </div>
    </div>
  )
}

function StreakPicture() {
  const week = ['goal', 'goal', 'rest', 'goal', 'studied', 'goal', 'today']
  return (
    <div className="w-full">
      <div className="flex justify-between">
        {week.map((s, i) => (
          <span
            key={i}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2"
            style={
              s === 'goal'
                ? { background: 'var(--flame)', borderColor: 'var(--flame)' }
                : s === 'studied'
                  ? { background: 'var(--flame-tint)', borderColor: 'var(--flame)' }
                  : { borderColor: s === 'today' ? 'var(--flame)' : 'var(--border-strong)', borderStyle: 'dashed' }
            }
          >
            {s === 'goal' && <Flame size={14} lit={false} style={{ color: '#fff' }} />}
            {s === 'studied' && <Flame size={13} />}
            {s === 'rest' && <span className="text-[8.5px] font-semibold uppercase" style={{ color: 'var(--text-faint)' }}>rest</span>}
          </span>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-[13px] font-semibold">
        <Flame size={18} /> 5-day streak
      </p>
    </div>
  )
}

/* ---------- The tour ---------- */

export default function WelcomeTour({ profile, firstName, syllabi, subjectHref, subjectName }) {
  const steps = [
    {
      eyebrow: 'Welcome',
      title: `Hi ${firstName}. Here is how Psyllabus works.`,
      body: 'Nothing here is guessed. Every colour, grade and plan comes from questions you actually answer. A few quick steps and you are ready.',
      Picture: WelcomePicture,
    },
    {
      eyebrow: 'Your study plan',
      title: 'Every day starts with the plan',
      body: 'Tell it when you are free and when your exams are. It picks what to study each day: weak topics first, fading ones before they slip, and mistakes when they are due back.',
      Picture: PlanPicture,
    },
    {
      eyebrow: 'Prove it',
      title: 'Short quizzes move you up',
      body: 'Each task ends in a quick set of exam-style questions. Get them right and the subtopic climbs from untested to mastered. Leave it too long and it starts to fade.',
      Picture: LadderPicture,
    },
    {
      eyebrow: 'Your subject map',
      title: 'See the whole course at once',
      body: 'Every theme, unit and subtopic as an orbit, coloured by how well you know it. Tap anything to jump straight into a quiz on it.',
      Picture: OrbitPicture,
    },
    syllabi && {
      eyebrow: 'Syllabi',
      title: 'An AI tutor when you are stuck',
      body: 'Ask about anything on your syllabus, upload your notes, or paste a draft or a paper answer and get it marked against the real criteria.',
      Picture: SyllabiPicture,
    },
    {
      eyebrow: 'Keep it going',
      title: 'A little every day beats a lot once',
      body: 'Set a daily goal and build a streak. Rest days on your plan never break it.',
      Picture: StreakPicture,
    },
  ].filter(Boolean)

  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const last = i === steps.length - 1
  const step = steps[i]
  const go = (n) => {
    setDir(n > i ? 1 : -1)
    setI(n)
  }

  return (
    <section
      className="elev-lg mb-8 overflow-hidden rounded-[16px] border"
      style={{ borderColor: 'var(--brand)', background: 'var(--brand-tint)' }}
      aria-label="Getting started"
    >

      <div key={i} className="grid gap-6 p-6 sm:p-7 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)] md:items-center md:gap-10" style={{ animation: `${dir > 0 ? 'step-enter' : 'step-back'} 320ms cubic-bezier(0.16, 1, 0.3, 1) backwards` }}>
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
            {step.eyebrow} · {i + 1} of {steps.length}
          </p>
          <h2 className="mt-3 text-[clamp(1.35rem,2.8vw,1.8rem)] font-semibold leading-tight tracking-[-0.028em]">{step.title}</h2>
          <p className="mt-2.5 max-w-lg text-[14px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            {step.body}
          </p>
        </div>
        <div className="flex min-h-[170px] items-center rounded-[14px] p-4" style={{ background: 'color-mix(in srgb, var(--surface) 70%, transparent)' }}>
          <step.Picture />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-6 pb-6 sm:px-7">
        <div className="mr-auto flex gap-1.5" role="tablist" aria-label="Tour steps">
          {steps.map((s, k) => (
            <button
              key={s.eyebrow}
              type="button"
              role="tab"
              aria-selected={k === i}
              aria-label={`Step ${k + 1}: ${s.eyebrow}`}
              onClick={() => go(k)}
              className="h-2 rounded-full transition-[width,background-color] duration-300"
              style={{ width: k === i ? 22 : 8, background: k === i ? 'var(--brand)' : 'var(--border-strong)' }}
            />
          ))}
        </div>
        {!last && (
          <button
            type="button"
            onClick={() => {
              markDone(profile.id)
              window.dispatchEvent(new Event('psyllabus:tour'))
            }}
            className="px-2 text-[13px] font-medium underline-offset-2 hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            Skip tour
          </button>
        )}
        {i > 0 && (
          <button type="button" onClick={() => go(i - 1)} className="btn btn-quiet control-md">
            Back
          </button>
        )}
        {!last ? (
          <button type="button" onClick={() => go(i + 1)} className="btn btn-solid control-md">
            Next
            <IconArrowRight width={15} height={15} />
          </button>
        ) : (
          <>
            {subjectHref && (
              <Link href={subjectHref} onClick={() => markDone(profile.id)} className="btn btn-outline control-md">
                Open {subjectName}
              </Link>
            )}
            <Link href="/dashboard/study-plan" onClick={() => markDone(profile.id)} className="btn btn-solid control-md">
              Set up my study plan
              <IconArrowRight width={15} height={15} />
            </Link>
          </>
        )}
      </div>
    </section>
  )
}
