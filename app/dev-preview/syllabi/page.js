'use client'

/**
 * Syllabi's screens with sample data, without signing in.
 *
 * Not reachable in production — same gate as the parent harness. Nothing
 * here calls a model or writes anywhere: the draft studio is seeded with a
 * sample review in this tab's storage, and the drawer's chat only answers if
 * someone is signed in with a key configured.
 *
 *   ?view=draft   the draft studio, marked
 *   ?view=ask     the chat
 *   ?view=drawer  the buttons the rest of the app uses, and the drawer
 *   ?view=layout  the signed-in frame
 *   ?view=streak  the frame with the dashboard's streak and ways to study
 *   ?view=redemption  the Redemption page with sample questions
 */

import { Suspense, useState } from 'react'
import { notFound, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'

// Browser only, as on the real page, which draws these after the profile loads.
const DraftStudio = dynamic(() => import('@/components/syllabi/DraftStudio'), { ssr: false })
const TutorChat = dynamic(() => import('@/components/syllabi/TutorChat'), { ssr: false })
const ChatHistory = dynamic(() => import('@/components/syllabi/ChatHistory'), { ssr: false })

const DAY = 86400000
const CHATS = [
  { id: '1', subject: 'Physics SL', title: 'Why does a pendulum’s period not depend on mass?', source: null, updated_at: new Date().toISOString() },
  { id: '2', subject: 'Math Analysis & Approaches HL', title: 'Chain rule practice question', source: 'Study plan · Maths AA', updated_at: new Date(Date.now() - DAY).toISOString() },
  { id: '3', subject: 'Economics HL', title: 'Explain price elasticity of demand', source: 'Flashcard · Economics HL', updated_at: new Date(Date.now() - 3 * DAY).toISOString() },
  { id: '4', subject: 'Computer Science SL', title: 'Binary search vs linear search', source: 'Quiz · Algorithms', updated_at: new Date(Date.now() - 20 * DAY).toISOString() },
]
import { SyllabiProvider, AskSyllabi } from '@/components/syllabi/SyllabiDrawer'
import DashboardLayout from '@/components/DashboardLayout'
import { StreakCard } from '@/components/Streak'
import WaysToStudy from '@/components/WaysToStudy'
import { RedemptionView } from '@/components/Redemption'
import { primeStudyDays } from '@/lib/streak'
import { dayKey } from '@/lib/study-time'

// Six days running with Friday, a rest day, bridged; and an older run of nine.
const STUDY = [[0, 12], [1, 35], [2, 22], [3, 41], [5, 18], [6, 25], ...Array.from({ length: 9 }, (_, i) => [20 + i, 15 + i * 3])]

const ENABLED = process.env.NODE_ENV !== 'production'
const SUBJECTS = ['Physics SL', 'Math Analysis & Approaches HL', 'Computer Science SL', 'Economics HL', 'English A: Language & Literature SL']
const PROFILE = { is_admin: true, subjects: SUBJECTS }

const TEXT = `Investigating how the length of a pendulum affects its period

Research question: How does the length of a simple pendulum (0.20 m to 1.00 m) affect its period of oscillation?

I chose this topic because I have always been interested in clocks and how they keep time. In class we learned that the period of a pendulum should depend only on its length and the gravitational field strength, and I wanted to test whether this holds in a real experiment.

The independent variable was the length of the string, measured from the pivot to the centre of mass of the bob with a metre rule. The dependent variable was the period, found by timing ten oscillations with a stopwatch and dividing by ten. The mass of the bob and the starting angle were kept constant.

I repeated each measurement three times and calculated the mean. The results show that the period increases with length. A graph of T squared against L gives a straight line through the origin, which agrees with the theory.

The value of g I calculated from the gradient was 9.62 m s^-2, which is close to the accepted value. The main source of error was my reaction time when starting and stopping the stopwatch. In the future I could use a light gate to reduce this error.`

const NEXT = 'The next band asks for uncertainties that are processed and used to judge the result, not just mentioned.'

const REVIEW = {
  known: true,
  scale: '1-7',
  overview: 'A clear, well-focused investigation with a sound method, held back mainly by the absence of any treatment of uncertainty, which limits the analysis, conclusion and evaluation together.',
  criteria: [
    { id: 'A', name: 'Research design', max: 6, score: 4, comment: 'The research question is focused and ranged, and the variables are identified. The method is repeatable, but it does not say how the starting angle was kept small, which the small-angle theory depends on, or why ten oscillations were timed.', next_band: NEXT },
    { id: 'B', name: 'Data analysis', max: 6, score: 3, comment: 'The T squared against L graph is the right choice and is clearly the strongest decision in the piece. There is no treatment of uncertainty in the raw data or the gradient, and no error bars are described.', next_band: NEXT },
    { id: 'C', name: 'Conclusion', max: 6, score: 4, comment: 'The conclusion links back to theory and states a value of g. Without an uncertainty, the comparison with the accepted value cannot be judged.', next_band: NEXT },
    { id: 'D', name: 'Evaluation', max: 6, score: 2, comment: 'Only reaction time is discussed, and the improvement is generic. Neither is tied to a specific effect on the result.', next_band: NEXT },
  ],
  grade_estimate: '5',
  grade_note: 'Clear and well focused, held back by missing uncertainties. Quantifying them would lift B, C and D together.',
  examiner_comment: 'This is a focused investigation with a clearly stated research question and a sensible choice of independent variable. The method is described well enough to be repeated, though the control of the release angle needs explaining. Linearising the data with T squared against L shows good judgement. However, no uncertainties are given for the measurements or propagated to the gradient, so the value of g cannot be meaningfully compared with the accepted value. The evaluation identifies only reaction time and proposes a generic improvement. With uncertainties quantified and the evaluation tied to specific results, this could move up a band in three of the four criteria.',
  sections: [
    { name: 'Research question', rating: 'strong', comment: 'Focused and ranged. It names the variables and the range tested.' },
    { name: 'Method', rating: 'adequate', comment: 'Repeatable, but the control of the angle and the choice of ten oscillations are not justified.' },
    { name: 'Data processing', rating: 'weak', comment: 'No uncertainties, no error bars, no gradient uncertainty.' },
    { name: 'Conclusion', rating: 'adequate', comment: 'Links to theory and states g, but without uncertainty the comparison is hollow.' },
    { name: 'Evaluation', rating: 'weak', comment: 'One generic weakness and one generic improvement.' },
    { name: 'Bibliography', rating: 'weak', comment: 'Missing. Sources for the theory and the accepted value of g should be cited.' },
  ],
  writing: 'Clear and concise, with correct physics terminology. Units are given but the notation m s^-2 should be formatted properly. There are no citations.',
  word_count_note: 'Far below the expected length for a physics IA, so most criteria cannot yet be fully met.',
  priorities: [
    'Quantify the uncertainty in your length and period measurements.',
    'Propagate them to an uncertainty in the gradient and in g.',
    'Judge your g against 9.81 using that uncertainty.',
    'Rewrite the evaluation around specific, quantified weaknesses.',
  ],
  highlights: [
    { quote: 'How does the length of a simple pendulum (0.20 m to 1.00 m) affect its period of oscillation?', criterion: 'A', kind: 'strength', impact: 'high', comment: 'A focused question with a stated range.', how_to_fix: 'Keep stating the range explicitly.' },
    { quote: 'The mass of the bob and the starting angle were kept constant.', criterion: 'A', kind: 'issue', impact: 'medium', comment: 'Say how, and why the angle must stay small for the theory to hold.', how_to_fix: 'State the angle you used, how you set it each time, and why small angles matter here.' },
    { quote: 'I repeated each measurement three times and calculated the mean.', criterion: 'B', kind: 'question', impact: 'medium', comment: 'How big was the spread between repeats, and how did it set your uncertainty?', how_to_fix: 'Use half the range of your repeats as the uncertainty in each period.' },
    { quote: 'A graph of T squared against L', criterion: 'B', kind: 'strength', impact: 'medium', comment: 'Linearising is exactly the right move.', how_to_fix: 'Keep it, and add error bars.' },
    { quote: 'gives a straight line through the origin, which agrees with the theory', criterion: 'C', kind: 'issue', impact: 'high', comment: 'Does it really pass through the origin within uncertainty? Show it.', how_to_fix: 'Draw the steepest and shallowest lines that fit your error bars and check both against the origin.' },
    { quote: 'The value of g I calculated from the gradient was 9.62 m s^-2', criterion: 'C', kind: 'issue', impact: 'high', comment: 'Give the uncertainty in g and the percentage difference from 9.81.', how_to_fix: 'Propagate the gradient uncertainty to g, then compare the gap with it.' },
    { quote: 'In the future I could use a light gate to reduce this error.', criterion: 'D', kind: 'issue', impact: 'low', comment: 'Generic. Which result would change, and by how much?', how_to_fix: 'Say how big the reaction-time error is compared with your period, and what a light gate would change.' },
  ],
  strengths: ['A focused, ranged research question', 'Linearising with T squared against L'],
  questions: ['What is the uncertainty in your gradient, and how did you find it?', 'Is 9.62 within your uncertainty of 9.81?', 'Which systematic error would push g low?'],
  next_step: 'Work out the uncertainty in the gradient and use it to judge your value of g.',
}

/** The chat list with folders, all in this tab's memory. */
function HistoryPreview() {
  const [chats, setChats] = useState(() => CHATS.map((c, i) => ({ ...c, folder_id: i === 1 ? 'f1' : null })))
  const [folders, setFolders] = useState([{ id: 'f1', name: 'Maths revision' }, { id: 'f2', name: 'IA ideas' }])
  return (
    <ChatHistory
      chats={chats}
      folders={folders}
      activeId="2"
      loading={false}
      onOpen={() => {}}
      onNew={() => {}}
      onDelete={(c) => setChats((l) => l.filter((x) => x.id !== c.id))}
      onMove={(c, f) => setChats((l) => l.map((x) => (x.id === c.id ? { ...x, folder_id: f } : x)))}
      onCreateFolder={async (name) => {
        const id = `f${folders.length + 1}${name.length}`
        setFolders((f) => [...f, { id, name }])
        return id
      }}
      onRenameFolder={(f, name) => setFolders((l) => l.map((x) => (x.id === f.id ? { ...x, name } : x)))}
      onDeleteFolder={(f) => (setFolders((l) => l.filter((x) => x.id !== f.id)), setChats((l) => l.map((x) => (x.folder_id === f.id ? { ...x, folder_id: null } : x))))}
    />
  )
}

function Preview() {
  const view = useSearchParams().get('view') || 'draft'
  // Seeded once, before the studio first reads its storage.
  const [ready] = useState(() => {
    if (typeof window !== 'undefined' && view === 'draft') {
      try {
        sessionStorage.setItem(
          'psyllabus:draft-studio',
          JSON.stringify({ subject: 'Physics SL', kind: 'ia', text: TEXT, review: REVIEW, markedText: TEXT, markedFor: 'Physics SL|ia' })
        )
      } catch {
        /* preview only */
      }
    }
    return true
  })
  // Seeded before anything reads it; the streak loads after mount.
  useState(() => {
    if (typeof window === 'undefined' || view !== 'streak') return false
    const now = new Date()
    primeStudyDays(
      'preview',
      STUDY.map(([ago, value]) => ({ date: dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - ago)), value }))
    )
    return true
  })
  if (!ENABLED) notFound()
  if (!ready) return null

  if (view === 'redemption') {
    const NOW = Date.UTC(2026, 9, 21, 12)
    const H = 3600000
    const q = (i, subject, subtopic, stem, review_count, hours) => ({ id: String(i), review_count, next_review_at: new Date(NOW + hours * H).toISOString(), questions: { subject, subtopic, stem } })
    const sample = [
      q(1, 'Physics SL', 'Simple harmonic motion', 'A mass on a spring oscillates with period 0.8 s. What is its angular frequency?', 0, -5),
      q(2, 'Physics SL', 'Simple harmonic motion', 'At which point in its oscillation is the acceleration of a pendulum bob greatest?', 1, -2),
      q(3, 'Physics SL', 'Simple harmonic motion', 'Doubling the amplitude of a simple harmonic oscillator changes its period by what factor?', 2, 20),
      q(4, 'Physics SL', 'Simple harmonic motion', 'Sketch how kinetic energy varies with displacement for a body in SHM.', 0, -1),
      q(5, 'Physics SL', 'Simple harmonic motion', 'Explain why the period of a simple pendulum does not depend on the mass of the bob.', 1, 70),
      q(6, 'Physics SL', 'Thermal energy transfers', 'Why does a metal spoon feel colder than a wooden one at the same temperature?', 0, -3),
      q(7, 'Physics SL', 'Thermal energy transfers', 'Calculate the energy needed to melt 0.25 kg of ice at 0 °C.', 2, 200),
      q(8, 'Economics HL', 'Price elasticity of demand', 'If PED is -0.4 and price rises by 10%, what happens to total revenue?', 0, -6),
      q(9, 'Economics HL', 'Price elasticity of demand', 'Why is the demand for petrol relatively inelastic in the short run?', 1, 10),
      q(10, 'Economics HL', 'Market failure: externalities', 'Draw and explain a negative externality of production diagram.', 0, -4),
      q(11, 'Economics HL', 'Market failure: externalities', 'Evaluate a carbon tax as a response to negative externalities.', 2, 120),
      q(12, 'Biology HL', 'Cell membranes', 'Explain why phospholipids form a bilayer in water.', 1, -1),
      q(13, 'Biology HL', 'Cell membranes', 'Distinguish between facilitated diffusion and active transport.', 0, 30),
    ]
    return (
      <DashboardLayout profile={{ ...PROFILE, id: 'preview', full_name: 'Sample Student', curriculum: 'IB', grad_year: '2028' }}>
        <RedemptionView mistakes={sample} now={NOW} />
      </DashboardLayout>
    )
  }

  if (view === 'streak') {
    const profile = { ...PROFILE, id: 'preview', full_name: 'Sample Student', curriculum: 'IB', grad_year: '2028' }
    return (
      <DashboardLayout profile={profile}>
        <div className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8">
          <h1 className="mb-8 text-[28px] font-semibold tracking-[-0.03em]">Good afternoon, Sample</h1>
          <StreakCard profile={profile} cta={{ href: '#', label: 'Start: Simple harmonic motion' }} />
          <h2 className="mb-4 text-[15px] font-semibold">Ways to study</h2>
          <WaysToStudy profile={profile} focus={{ subject: 'Physics SL', topic: 'Oscillations', subtopic: 'Simple harmonic motion' }} />
        </div>
      </DashboardLayout>
    )
  }

  // The signed-in frame every dashboard page uses, with the Syllabi drawer in it.
  if (view === 'layout') {
    return (
      <DashboardLayout profile={{ ...PROFILE, full_name: 'Sample Student', curriculum: 'IB', grad_year: '2028' }}>
        <div className="p-10">
          <p>Inside the dashboard frame.</p>
          <AskSyllabi subject="Physics SL" label="Open the drawer" autoSend={false} text="Hello" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <SyllabiProvider profile={PROFILE}>
      <div className="flex h-dvh flex-col p-4 md:p-6" style={{ background: 'var(--bg)' }}>
        {view === 'draft' && <DraftStudio subjects={SUBJECTS} />}
        {view === 'ask' && <TutorChat subjects={SUBJECTS} />}
        {view === 'history' && (
          <div className="flex min-h-0 flex-1 gap-5">
            <aside className="flex w-64 shrink-0 flex-col border-r pr-5" style={{ borderColor: 'var(--border)' }}>
              <HistoryPreview />
            </aside>
            <div className="flex min-h-0 flex-1 flex-col">
              <TutorChat subjects={SUBJECTS} />
            </div>
          </div>
        )}
        {view === 'drawer' && (
          <div className="flex flex-wrap gap-3">
            <AskSyllabi subject="Physics SL" topic="Kinematics" context="Physics SL · Kinematics" label="Why was I wrong?" text="I got this question wrong: a ball is thrown up at 12 m/s. What is its maximum height? My answer: 14.7 m. Correct: 7.3 m." />
            <AskSyllabi subject="Economics HL" context="Flashcard · Economics HL" label="Explain this card" autoSend={false} text="Front: Price elasticity of demand. Back: The responsiveness of quantity demanded to a change in price." />
            <AskSyllabi size="xs" subject="Math Analysis & Approaches HL" context="Test · Calculus" label="Prepare" autoSend={false} text="I have a test in Maths AA on Thursday: Calculus. Make me a revision plan." />
          </div>
        )}
      </div>
    </SyllabiProvider>
  )
}

export default function SyllabiPreview() {
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  )
}
