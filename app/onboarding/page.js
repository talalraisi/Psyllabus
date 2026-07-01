'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { isIBSelectionValid, ibSelectionHint } from '@/lib/ib-validation'

const CURRICULUMS = {
  'IB': {
    groups: [
      {
        name: 'Group 1 — Language A',
        required: 1,
        subjects: [
          'English A: Literature HL', 'English A: Literature SL',
          'English A: Language & Literature HL', 'English A: Language & Literature SL',
          'Arabic A: Literature HL', 'Arabic A: Literature SL',
          'French A: Literature HL', 'French A: Literature SL',
          'Spanish A: Literature HL', 'Spanish A: Literature SL',
        ]
      },
      {
        name: 'Group 2 — Language Acquisition',
        required: 1,
        subjects: [
          'English B HL', 'English B SL',
          'Arabic B HL', 'Arabic B SL',
          'French B HL', 'French B SL',
          'Spanish B HL', 'Spanish B SL',
          'English ab initio SL', 'French ab initio SL', 'Spanish ab initio SL',
        ]
      },
      {
        name: 'Group 3 — Individuals & Societies',
        required: 1,
        subjects: [
          'Economics HL', 'Economics SL',
          'History HL', 'History SL',
          'Geography HL', 'Geography SL',
          'Psychology HL', 'Psychology SL',
          'Business Management HL', 'Business Management SL',
          'Global Politics HL', 'Global Politics SL',
          'Philosophy HL', 'Philosophy SL',
          'Digital Society HL', 'Digital Society SL',
        ]
      },
      {
        name: 'Group 4 — Sciences',
        required: 1,
        subjects: [
          'Biology HL', 'Biology SL',
          'Chemistry HL', 'Chemistry SL',
          'Physics HL', 'Physics SL',
          'Computer Science HL', 'Computer Science SL',
          'Environmental Systems & Societies SL',
          'Sports Exercise & Health Science HL', 'Sports Exercise & Health Science SL',
          'Design Technology HL', 'Design Technology SL',
        ]
      },
      {
        name: 'Group 5 — Mathematics',
        required: 1,
        subjects: [
          'Math Analysis & Approaches HL',
          'Math Analysis & Approaches SL',
          'Math Applications & Interpretation HL',
          'Math Applications & Interpretation SL',
        ]
      },
      {
        name: 'Group 6 — The Arts',
        required: 0,
        subjects: [
          'Visual Arts HL', 'Visual Arts SL',
          'Music HL', 'Music SL',
          'Theatre HL', 'Theatre SL',
          'Film HL', 'Film SL',
          'Dance HL', 'Dance SL',
        ]
      },
    ],
    grades: ['1','2','3','4','5','6','7'],
    maxSubjects: 6
  },
  'AP': {
    groups: [
      {
        name: 'Math & Computer Science',
        required: 0,
        subjects: [
          'AP Calculus AB', 'AP Calculus BC', 'AP Precalculus',
          'AP Statistics', 'AP Computer Science A', 'AP Computer Science Principles',
        ]
      },
      {
        name: 'Sciences',
        required: 0,
        subjects: [
          'AP Biology', 'AP Chemistry', 'AP Physics 1',
          'AP Physics 2', 'AP Physics C: Mechanics',
          'AP Physics C: Electricity & Magnetism', 'AP Environmental Science',
        ]
      },
      {
        name: 'History & Social Sciences',
        required: 0,
        subjects: [
          'AP World History: Modern', 'AP US History', 'AP European History',
          'AP US Government & Politics', 'AP Comparative Government & Politics',
          'AP Macroeconomics', 'AP Microeconomics',
          'AP Psychology', 'AP Human Geography', 'AP African American Studies',
        ]
      },
      {
        name: 'English',
        required: 0,
        subjects: [
          'AP English Language & Composition',
          'AP English Literature & Composition',
        ]
      },
      {
        name: 'World Languages',
        required: 0,
        subjects: [
          'AP Spanish Language & Culture',
          'AP French Language & Culture',
          'AP Chinese Language & Culture',
          'AP German Language & Culture',
          'AP Japanese Language & Culture',
          'AP Latin',
        ]
      },
      {
        name: 'Arts',
        required: 0,
        subjects: [
          'AP Art History', 'AP Music Theory',
          'AP 2-D Art & Design', 'AP 3-D Art & Design', 'AP Drawing',
        ]
      },
      {
        name: 'AP Capstone',
        required: 0,
        subjects: ['AP Seminar', 'AP Research']
      }
    ],
    grades: ['1','2','3','4','5'],
    maxSubjects: 10
  },
  'A-Level': {
    groups: [
      {
        name: 'Mathematics & Computer Science',
        required: 0,
        subjects: [
          'Mathematics', 'Further Mathematics', 'Statistics',
          'Computer Science', 'Information Technology',
        ]
      },
      {
        name: 'Sciences',
        required: 0,
        subjects: [
          'Biology', 'Chemistry', 'Physics', 'Psychology',
          'Environmental Science', 'Geology', 'Marine Science',
        ]
      },
      {
        name: 'Humanities & Social Sciences',
        required: 0,
        subjects: [
          'History', 'Geography', 'Economics',
          'Politics & Government', 'Sociology', 'Philosophy',
          'Law', 'Ancient History', 'Classical Civilisation',
          'Religious Studies',
        ]
      },
      {
        name: 'English',
        required: 0,
        subjects: [
          'English Language', 'English Literature',
          'English Language & Literature',
        ]
      },
      {
        name: 'Business & Technical',
        required: 0,
        subjects: [
          'Business Studies', 'Accounting',
          'Design & Technology', 'Electronics',
          'Food Science & Nutrition', 'Travel & Tourism',
        ]
      },
      {
        name: 'Creative & Performing Arts',
        required: 0,
        subjects: [
          'Art & Design', 'Drama & Theatre Studies',
          'Music', 'Music Technology', 'Film Studies',
          'Media Studies', 'Dance', 'Physical Education',
        ]
      },
      {
        name: 'Languages',
        required: 0,
        subjects: [
          'Spanish', 'French', 'German',
          'Chinese / Mandarin', 'Arabic',
        ]
      }
    ],
    grades: ['A*','A','B','C','D','E'],
    maxSubjects: 4
  }
}

const GRAD_YEARS = ['2027', '2028', '2029', '2030', '2031', '2032']

export default function Onboarding() {
  const [step, setStep] = useState(1)
  const [curriculum, setCurriculum] = useState('')
  const [gradYear, setGradYear] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState([])
  const [targetGrades, setTargetGrades] = useState({})
  const [loading, setLoading] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState(null)
  const router = useRouter()
  const supabase = createClient()

  const currentCurriculum = CURRICULUMS[curriculum]

  const subjectsValid =
    curriculum === 'IB' && currentCurriculum
      ? isIBSelectionValid(selectedSubjects, currentCurriculum.groups)
      : selectedSubjects.length > 0

  const toggleSubject = (subject) => {
    if (selectedSubjects.includes(subject)) {
      setSelectedSubjects(selectedSubjects.filter(s => s !== subject))
      const newGrades = {...targetGrades}
      delete newGrades[subject]
      setTargetGrades(newGrades)
    } else if (!currentCurriculum || selectedSubjects.length < currentCurriculum.maxSubjects) {
      setSelectedSubjects([...selectedSubjects, subject])
    }
  }

  const setGrade = (subject, grade) => {
    setTargetGrades({...targetGrades, [subject]: grade})
  }

  const handleFinish = async () => {
    setLoading(true)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push('/login')
        return
      }
      
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name || null,
        curriculum,
        grad_year: gradYear,
        subjects: selectedSubjects,
        target_grades: targetGrades,
        updated_at: new Date().toISOString()
      })

      if (error) {
        console.error('Profile save error:', error)
        setLoading(false)
        return
      }

      router.push('/dashboard')
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  return (
    <main className="page px-6 py-12">
      
      <div className="max-w-2xl mx-auto">

        <div className="flex justify-center mb-10">
          <Link href="/">
            <Logo width={260} height={78} priority />
          </Link>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-2 mb-10 justify-center">
          {[
            {n: 1, label: 'Setup'},
            {n: 2, label: 'Subjects'},
            {n: 3, label: 'Goals'}
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center 
                text-sm font-bold transition-all ${step >= s.n 
                  ? 'bg-accent text-white' 
                  : 'bg-bg-subtle text-text-faint border border-border'}`}>
                  {s.n}
                </div>
                <span className={`text-xs ${step >= s.n ? 'text-accent font-semibold' : 'text-text-faint'}`}>
                  {s.label}
                </span>
              </div>
              {i < 2 && (
                <div className={`w-16 h-px mb-4 ${step > s.n ? 'bg-accent' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1 — Curriculum and year */}
        {step === 1 && (
          <div className="card card-pad">
            <h1 className="text-2xl font-bold text-text mb-2">
              Let's set up your profile
            </h1>
            <p className="text-text-muted text-sm mb-8">
              Tell us about your curriculum so we can map your exact syllabus.
            </p>

            <div className="mb-6">
              <label className="label">
                Which curriculum are you studying?
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['IB', 'AP', 'A-Level'].map(c => (
                  <button key={c} onClick={() => {
                    setCurriculum(c)
                    setSelectedSubjects([])
                    setTargetGrades({})
                  }}
                  className={`py-4 rounded-[var(--radius-sm)] font-bold text-sm transition-all border
                  ${curriculum === c ? 'chip-active' : 'chip hover:border-border-strong'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <label className="label">
                When do you graduate?
              </label>
              <div className="grid grid-cols-6 gap-2">
                {GRAD_YEARS.map(y => (
                  <button key={y} onClick={() => setGradYear(y)}
                  className={`py-3 rounded-[var(--radius-sm)] font-bold text-xs transition-all border
                  ${gradYear === y ? 'chip-active' : 'chip hover:border-border-strong'}`}>
                    {y}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!curriculum || !gradYear}
              className="btn-primary w-full py-3.5 text-base disabled:opacity-40 disabled:cursor-not-allowed">
              Continue
            </button>
          </div>
        )}

        {/* Step 2 — Subject selection by group */}
        {step === 2 && currentCurriculum && (
          <div className="card card-pad">
            <h1 className="text-2xl font-bold text-text mb-2">
              Select your subjects
            </h1>
            <p className="text-text-muted text-sm mb-1">
              {curriculum === 'IB' && ibSelectionHint(selectedSubjects, currentCurriculum.groups)}
              {curriculum === 'AP' && 'Select the AP courses you are taking.'}
              {curriculum === 'A-Level' && 'Most students take 3-4 A-Level subjects.'}
            </p>
            <p className="text-accent text-xs font-bold mb-6">
              {selectedSubjects.length}/{currentCurriculum.maxSubjects} selected
            </p>

            <div className="space-y-3 mb-8 max-h-96 overflow-y-auto pr-1">
              {currentCurriculum.groups.map((group, gi) => (
                <div key={gi} className="border border-border rounded-[var(--radius-sm)] overflow-hidden">
                  <button
                    onClick={() => setExpandedGroup(expandedGroup === gi ? null : gi)}
                    className="w-full px-4 py-3 flex items-center justify-between
                    text-left hover:bg-bg-subtle transition-colors">
                    <div>
                      <span className="text-text font-semibold text-sm">{group.name}</span>
                      {group.required > 0 && (
                        <span className="ml-2 text-text-muted text-xs">
                          Required: {group.required}
                        </span>
                      )}
                      {selectedSubjects.filter(s => group.subjects.includes(s)).length > 0 && (
                        <span className="ml-2 text-solid text-xs">
                          {selectedSubjects.filter(s => group.subjects.includes(s)).length} selected
                        </span>
                      )}
                    </div>
                    <span className="text-text-faint text-sm">
                      {expandedGroup === gi ? '▲' : '▼'}
                    </span>
                  </button>
                  
                  {expandedGroup === gi && (
                    <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                      {group.subjects.map(subject => (
                        <button key={subject} onClick={() => toggleSubject(subject)}
                        className={`px-3 py-2 rounded-[var(--radius-sm)] text-xs font-medium 
                        text-left transition-all border
                        ${selectedSubjects.includes(subject) ? 'chip-active' : 'chip hover:border-border-strong'}`}>
                          {subject}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {selectedSubjects.length > 0 && (
              <div className="mb-6 p-4 rounded-[var(--radius-sm)] border border-border bg-accent-soft">
                <p className="section-label mb-2">
                  Your subjects
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedSubjects.map(s => (
                    <span key={s} className="chip text-text text-xs">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn-secondary px-6 py-3 text-sm">
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!subjectsValid}
                className="btn-primary flex-1 py-3.5 text-base disabled:opacity-40 disabled:cursor-not-allowed">
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Target grades */}
        {step === 3 && currentCurriculum && (
          <div className="card card-pad">
            <h1 className="text-2xl font-bold text-text mb-2">
              Set your target grades
            </h1>
            <p className="text-text-muted text-sm mb-8">
              What are you aiming for? Be ambitious — the planner adjusts to your goals.
            </p>

            <div className="space-y-4 mb-8 max-h-96 overflow-y-auto pr-1">
              {selectedSubjects.map(subject => (
                <div key={subject} className="p-4 rounded-[var(--radius-sm)] border border-border bg-bg-subtle">
                  <p className="text-text font-medium text-sm mb-3">{subject}</p>
                  <div className="flex gap-2 flex-wrap">
                    {currentCurriculum.grades.map(grade => (
                      <button key={grade} onClick={() => setGrade(subject, grade)}
                      className={`w-10 h-10 rounded-[var(--radius-sm)] font-bold text-sm 
                      transition-all border
                      ${targetGrades[subject] === grade ? 'chip-active' : 'chip hover:border-border-strong'}`}>
                        {grade}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="btn-secondary px-6 py-3 text-sm">
                Back
              </button>
              <button
                onClick={handleFinish}
                disabled={loading || Object.keys(targetGrades).length !== selectedSubjects.length}
                className="btn-primary flex-1 py-3.5 text-base disabled:opacity-40 disabled:cursor-not-allowed">
                {loading ? 'Setting up…' : 'Go to my dashboard'}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}