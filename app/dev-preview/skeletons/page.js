'use client'

/**
 * Every page's loading state, without waiting for a slow network to see one.
 * Development only. ?v= picks the page; the bar at the top switches page and
 * theme. Each entry is the same PageLoading call its page makes, so what shows
 * here is what a student sees in the second before their data arrives.
 */

import { Suspense } from 'react'
import { notFound, useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { PageLoading, SkeletonActions } from '@/components/PageShell'

const ENABLED = process.env.NODE_ENV !== 'production'

const PAGES = [
  ['dashboard', { title: 'Dashboard', width: 'wide', variant: 'dashboard' }],
  ['analytics', { title: 'Analytics', subtitle: 'Where your study time goes, what you have covered, and how it is going.', width: 'wide', variant: 'analytics' }],
  ['flashcards', { title: 'Flashcards', subtitle: 'Your own cards, from your notes or written yourself. Study them whenever you like.', action: <SkeletonActions widths={[132]} />, variant: 'flashcards' }],
  ['syllabi', { title: 'Syllabi', variant: 'syllabi' }],
  ['map', { title: 'Subject map', variant: 'map' }],
  ['test', { title: 'Build a Test', eyebrow: 'Test builder', subtitle: 'Set the paper on the left. It takes shape on the right as you go.', width: 'wide', rows: 6, variant: 'test' }],
  ['quiz', { title: 'Quiz', width: 'narrow', variant: 'quiz' }],
  ['paper', { title: 'Paper', variant: 'paper' }],
  ['lesson', { title: 'Lesson', variant: 'lesson' }],
  ['subjects', { title: 'My Subjects', width: 'wide', rows: 6, variant: 'subjects' }],
  ['calendar', { title: 'Calendar', subtitle: 'Your tests, your own calendar and your study plan, in one place.', action: <SkeletonActions widths={[106]} />, width: 'wide', variant: 'calendar' }],
  ['study-plan', { title: 'Study Plan', action: <SkeletonActions widths={[118, 98]} />, rows: 5, variant: 'plan' }],
  ['mistakes', { title: 'Redemption', subtitle: 'Questions you got wrong come back until you get them right three times running.', rows: 4, variant: 'redemption' }],
  ['core', { title: 'Diploma core', subtitle: 'TOK and the extended essay are worth up to three points together.', variant: 'core' }],
  ['prediction', { title: 'Predicted Grade', variant: 'prediction' }],
  ['profile', { title: 'Profile', subtitle: 'Your account and access', width: 'narrow', rows: 6, variant: 'form' }],
  ['feedback', { title: 'Feedback', eyebrow: 'Beta', rows: 5, variant: 'feedback' }],
  ['list', { title: 'A plain list', variant: 'list' }],
]

function Gallery() {
  const router = useRouter()
  const params = useSearchParams()
  const key = PAGES.some(([k]) => k === params.get('v')) ? params.get('v') : PAGES[0][0]
  const props = PAGES.find(([k]) => k === key)[1]
  const at = PAGES.findIndex(([k]) => k === key)
  const go = (k) => router.replace(`/dev-preview/skeletons?v=${k}`, { scroll: false })
  const flipTheme = () => {
    const el = document.documentElement
    el.setAttribute('data-theme', el.getAttribute('data-theme') === 'dark' ? 'light' : 'dark')
  }

  return (
    <>
      <DashboardLayout profile={null}>
        <PageLoading key={key} {...props} />
      </DashboardLayout>
      <div
        className="fixed bottom-3 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-1.5 rounded-full border p-1.5 shadow-xl"
        style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
      >
        <button type="button" className="btn btn-quiet control-sm px-3" onClick={() => go(PAGES[(at + PAGES.length - 1) % PAGES.length][0])} aria-label="Previous">
          ‹
        </button>
        <select value={key} onChange={(e) => go(e.target.value)} className="h-8 rounded-full border px-2 text-[13px]" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
          {PAGES.map(([k]) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-quiet control-sm px-3" onClick={() => go(PAGES[(at + 1) % PAGES.length][0])} aria-label="Next">
          ›
        </button>
        <button type="button" className="btn btn-outline control-sm" onClick={flipTheme}>
          Theme
        </button>
      </div>
    </>
  )
}

export default function SkeletonGallery() {
  if (!ENABLED) notFound()
  return (
    <Suspense>
      <Gallery />
    </Suspense>
  )
}
