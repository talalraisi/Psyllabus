'use client'

/** The brief before a test, with sample questions. Development only; nothing is saved. */

import { notFound } from 'next/navigation'
import { Page } from '@/components/PageShell'
import DashboardLayout from '@/components/DashboardLayout'
import QuizBrief from '@/components/QuizBrief'

const ENABLED = process.env.NODE_ENV !== 'production'

const SUBTOPICS = ['Kinematics', 'Forces and momentum', 'Work, energy and power', 'Rigid body mechanics', 'Circular motion and gravitation']
const QUESTIONS = Array.from({ length: 14 }, (_, i) => ({
  id: `q${i}`,
  subtopic: SUBTOPICS[i % SUBTOPICS.length],
  difficulty: [0.2, 0.4, 0.45, 0.6, 0.75, 0.9][i % 6],
  marks: i % 4 === 0 ? 2 : 1,
  question_type: i % 3 === 0 ? 'short_answer' : 'mcq',
}))

export default function QuizBriefPreview() {
  if (!ENABLED) notFound()
  return (
    <DashboardLayout profile={{ id: 'preview', full_name: 'Sample Student', curriculum: 'IB', subjects: ['Physics HL'] }}>
      <Page>
        <QuizBrief
          eyebrow="Custom test · Physics HL"
          title="Theme A: Space, time and motion"
          questions={QUESTIONS}
          timed
          totalMinutes={24}
          sit="exam"
          review="exam"
          hintsAllowed={false}
          redemptionCount={3}
          startLabel="Start timed mock"
          onStart={() => {}}
          backHref="/dev-preview"
        />
      </Page>
    </DashboardLayout>
  )
}
