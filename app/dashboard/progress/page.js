import { redirect } from 'next/navigation'

/**
 * Progress and the subject map are one page now: you, every subject circling
 * you, and the counts and heatmap under it (app/dashboard/map). Old links land
 * there.
 */
export default function ProgressPage() {
  redirect('/dashboard/map')
}
