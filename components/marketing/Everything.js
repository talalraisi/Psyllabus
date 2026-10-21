'use client'

import { useInView } from '@/components/marketing/scroll'

/**
 * Everything the app does, on one screen of the landing page: twelve tiles,
 * each a thing a student can open today, said in one line. The feature tour
 * further down shows how they work; this is the list.
 */

const P = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

const ITEMS = [
  ['Every subtopic, mapped', 'Your whole course from the official outline, coloured by what you proved.', <svg key="i" {...P}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>],
  ['Quizzes that set your level', 'Five levels from Weak to Mastered, and only right answers move you.', <svg key="i" {...P}><path d="m5 12 4 4 10-10" /></svg>],
  ['Practice, Test or Exam', 'Learn as you go, time yourself, or sit it for real.', <svg key="i" {...P}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></svg>],
  ['Redemption', 'Everything you got wrong comes back until it sticks.', <svg key="i" {...P}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>],
  ['A plan for tonight', 'Tell it your free time and exams; it picks what to study.', <svg key="i" {...P}><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>],
  ['Calendar sync', 'Tests and deadlines in, study blocks out to your phone.', <svg key="i" {...P}><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>],
  ['Syllabi, your AI tutor', 'Ask anything with photos, PDFs and links, for your course.', <svg key="i" {...P}><path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4Z" /><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" /></svg>],
  ['Drafts and answers marked', 'IA, EE, TOK and Paper 1 and 2, on the real criteria.', <svg key="i" {...P}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>],
  ['Notes into flashcards', 'Photos and PDFs of your notes, turned into cards.', <svg key="i" {...P}><rect x="3" y="6" width="14" height="12" rx="2" /><path d="M7 3h12a2 2 0 0 1 2 2v10" /></svg>],
  ['The subject map', 'Walk into any topic, see what is weak, quiz it in a tap.', <svg key="i" {...P}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="18" cy="6" r="1.8" fill="currentColor" stroke="none" /></svg>],
  ['Streaks and a daily goal', 'A reason to come back tomorrow, that rest days never break.', <svg key="i" {...P}><path d="M12 3c.4 3-1.2 4.6-2.7 6.1C7.7 10.7 6 12.5 6 15.3 6 19 8.7 21.5 12 21.5s6-2.5 6-6.2c0-2.6-1.3-4.3-2.6-5.7-.3 1.4-1 2.4-2 2.9.4-3.4-.4-6.7-1.4-8.5Z" /></svg>],
  ['Analytics', 'Time by subject, accuracy, and when you focus best.', <svg key="i" {...P}><path d="M4 20V14M10 20V10M16 20v-5M22 20H2" /><path d="m4 9 6-4 6 4 5-4" /></svg>],
]

/** The tiles fade up one after another once the grid is on screen. */
export default function Everything() {
  const [ref, seen] = useInView({ threshold: 0.15 })
  return (
    <ul ref={ref} className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-4">
      {ITEMS.map(([title, line, icon], i) => (
        <li
          key={title}
          className="rounded-[16px] border p-3.5 sm:p-4"
          style={{
            borderColor: 'var(--border-strong)',
            background: 'var(--surface)',
            opacity: seen ? 1 : 0,
            transform: seen ? 'none' : 'translateY(16px) scale(0.98)',
            transition: `opacity 520ms ease ${i * 80}ms, transform 620ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms`,
          }}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>
            {icon}
          </span>
          <p className="mt-3 text-[13px] font-semibold leading-snug tracking-[-0.01em] sm:text-[14px]">{title}</p>
          <p className="mt-1 text-[11.5px] leading-snug sm:text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
            {line}
          </p>
        </li>
      ))}
    </ul>
  )
}
