'use client'

/** The to-do list with sample tasks, without signing in. Development only; nothing is saved. */

import { notFound } from 'next/navigation'
import { Page, PageHeader } from '@/components/PageShell'
import DashboardLayout from '@/components/DashboardLayout'
import TodoList from '@/components/TodoList'
import { previewTodos } from '@/lib/todos'
import { dayKey } from '@/lib/todo-parse'

const ENABLED = process.env.NODE_ENV !== 'production'
const SUBJECTS = ['Physics HL', 'Math Analysis & Approaches HL', 'English A Language & Literature SL', 'History SL']
const on = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return dayKey(d)
}
const SAMPLE = [
  { title: 'Finish IA data table', due_on: on(-2), subject: 'Physics HL', note: 'Trials 4-6 still missing' },
  { title: 'Print the TOK essay rubric', due_on: on(-1) },
  { title: 'Revise kinematics before the quiz', due_on: on(0), subject: 'Physics HL' },
  { title: 'Email Ms Haddad about the EE meeting', due_on: on(0) },
  { title: 'Past paper 1, questions 1-6', due_on: on(2), subject: 'Math Analysis & Approaches HL' },
  { title: 'Read chapter 4 of the set text', due_on: on(5), subject: 'English A Language & Literature SL' },
  { title: 'Cold War source practice', due_on: on(12), subject: 'History SL' },
  { title: 'Buy a graphing calculator battery' },
  { title: 'Hand in CAS reflection', due_on: on(-5), done: true },
].map((t, i) => ({ id: `sample-${i}`, done: false, note: null, subject: null, due_on: null, position: i, created_at: new Date().toISOString(), ...t }))

// Seeded once, in the browser, when the module loads.
if (ENABLED && typeof window !== 'undefined') previewTodos(SAMPLE)

export default function TodoPreview() {
  if (!ENABLED) notFound()
  return (
    <DashboardLayout profile={{ id: 'preview', full_name: 'Sample Student', curriculum: 'IB', subjects: SUBJECTS }}>
      <Page width="narrow">
        <PageHeader title="To-do" subtitle="Everything that is not a test: coursework steps, forms, things to print. Dated tasks show on your calendar too." />
        <TodoList title="All to-dos" subjects={SUBJECTS} />
        <div className="mt-16">
          <TodoList title="To-do (home page)" compact limit={5} subjects={SUBJECTS} />
        </div>
      </Page>
    </DashboardLayout>
  )
}
