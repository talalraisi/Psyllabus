import { redirect } from 'next/navigation'

// Draft feedback is a tab of Syllabi now; old links land on it.
export default function DraftFeedback() {
  redirect('/dashboard/syllabi?tab=draft')
}
