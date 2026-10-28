'use client'

import Link from 'next/link'
import SyllabiMark from '@/components/SyllabiMark'
import { IconTest, IconCards, IconCheck, IconReview, IconArrowRight } from '@/components/Icons'
import { hasSyllabi, canUse } from '@/lib/access'
import { getSlugForSubject } from '@/lib/subject-map'
import { displaySubtopic } from '@/lib/progress'

/**
 * Every way to study, in one row of doors.
 *
 * Each one opens something that already exists: the question bank, Syllabi's
 * marking, flashcards, a quick multiple-choice set, the syllabus notes, and a
 * study space where Syllabi works from the student's own notes and files.
 * `focus` is where a quick set should start (the plan's next task, or the
 * first subject they can open).
 */

function NoteIcon({ width = 20, height = 20, style }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  )
}

function OrbitIcon({ width = 20, height = 20, style }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" style={style} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.6" />
      <circle cx="18" cy="6" r="2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function SpaceIcon({ width = 20, height = 20, style }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

const quizHref = (focus, extra) => {
  if (!focus?.subject) return '/dashboard/test'
  const p = new URLSearchParams({ subject: focus.subject, back: '/dashboard', review: 'practice', ...extra })
  if (focus.subtopic) {
    p.set('mode', 'subtopic')
    p.set('topic', focus.topic || '')
    p.set('subtopic', focus.subtopic)
  } else if (focus.topic) {
    p.set('mode', 'topic')
    p.set('topic', focus.topic)
  } else return '/dashboard/test'
  return `/dashboard/quiz?${p}`
}

export default function WaysToStudy({ profile, focus }) {
  const syllabi = hasSyllabi(profile)
  const notesHref = focus?.subject ? `/dashboard/syllabus/${getSlugForSubject(focus.subject)}` : '/dashboard/subjects'

  const ways = [
    {
      key: 'questions',
      title: 'Questions',
      line: 'Exam-style papers from the bank, built your way.',
      href: '/dashboard/test',
      Icon: IconTest,
    },
    {
      key: 'marking',
      title: 'AI Marking',
      line: 'Paste an IA, essay or paper answer and get it marked.',
      href: syllabi ? '/dashboard/syllabi?tab=draft' : '/dashboard/profile#unlock',
      Icon: ({ width, style }) => <SyllabiMark size={width} style={style} />,
      locked: !syllabi,
    },
    {
      key: 'flashcards',
      title: 'Flashcards',
      line: 'Your own cards, studied whenever you like.',
      href: '/dashboard/flashcards',
      Icon: IconCards,
    },
    {
      key: 'mcq',
      title: 'MCQs',
      line: focus?.subtopic ? `Ten quick ones on ${displaySubtopic(focus.subtopic)}.` : 'Ten quick multiple-choice questions.',
      href: quizHref(focus, { qtype: 'mcq', count: '10' }),
      Icon: IconCheck,
    },
    {
      key: 'map',
      title: 'Subject Map',
      line: 'Your whole course as an orbit. Tap a topic to quiz it.',
      href: focus?.subject ? `/dashboard/map?subject=${encodeURIComponent(focus.subject)}` : '/dashboard/map',
      Icon: OrbitIcon,
      locked: !canUse('subjectMap', profile),
    },
    {
      key: 'redemption',
      title: 'Redemption',
      line: 'The questions you got wrong, back when they are due.',
      href: '/dashboard/mistakes',
      Icon: IconReview,
    },
    {
      key: 'notes',
      title: 'Notes',
      line: 'Every topic and subtopic of your syllabus, with your notes on each.',
      href: notesHref,
      Icon: NoteIcon,
    },
    {
      key: 'space',
      title: 'Study Space',
      line: 'Upload notes, files or links. Syllabi turns them into questions, cards and notes.',
      href: syllabi ? '/dashboard/syllabi?tab=ask' : '/dashboard/profile#unlock',
      Icon: SpaceIcon,
      locked: !syllabi,
      fresh: true,
    },
  ]

  return (
    <ul className="stagger grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {ways.map(({ key, title, line, href, Icon, locked, fresh }) => (
        <li key={key}>
          <Link
            href={href}
            className="elev lift group flex h-full flex-col rounded-[14px] border p-4"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
          >
            <span className="flex items-center justify-between">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-[10px] transition-colors"
                style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}
              >
                <Icon width={18} height={18} style={{ color: 'var(--brand)' }} />
              </span>
              {fresh && !locked && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ background: 'var(--flame-tint)', color: 'var(--flame)' }}>
                  New
                </span>
              )}
              {locked && (
                <span className="text-[10.5px] font-semibold" style={{ color: 'var(--text-faint)' }}>
                  Unlock
                </span>
              )}
            </span>
            <span className="mt-3.5 flex items-center gap-1 text-[14px] font-semibold tracking-[-0.01em]">
              {title}
              <IconArrowRight width={13} height={13} className="-translate-x-1 opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100" />
            </span>
            <span className="mt-1 text-[12px] leading-snug" style={{ color: 'var(--text-faint)' }}>
              {line}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
