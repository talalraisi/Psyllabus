import { redirect } from 'next/navigation'

/**
 * The study type quiz lives in the study plan now (components/plan/
 * StudyTypePanel.js), since setting the plan up is all it is for. Old links
 * land there with it open.
 */
export default function StudyStylePage() {
  redirect('/dashboard/study-plan?type=1')
}
