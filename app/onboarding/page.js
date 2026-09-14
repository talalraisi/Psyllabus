'use client'
import { useState, useEffect } from 'react'
import { CONSENT_TEXT } from '@/lib/consent'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { getCurrentUser } from '@/lib/auth'
import { freeSubjectLockUntil } from '@/lib/access'
import { realismNote, curriculumOf } from '@/lib/curriculum'
import {
  IB_CORE_SUBJECTS,
  CORE_GRADES,
  coreBonusPoints,
  predictedTotal,
  MAX_TOTAL_POINTS,
  MAX_SUBJECT_POINTS,
} from '@/lib/ib-points'

const CURRICULUMS = {
  'IB': {
    groups: [
      {
        name: 'Group 1: Language A',
        required: 1,
        subjects: [
          'English A: Literature HL', 'English A: Literature SL',
          'English A: Language & Literature HL', 'English A: Language & Literature SL',
          'Arabic A: Literature HL', 'Arabic A: Literature SL',
          'French A: Literature HL', 'French A: Literature SL',
          'Spanish A: Literature HL', 'Spanish A: Literature SL',
        
          'Arabic A: Language & Literature HL',
          'Arabic A: Language & Literature SL',
          'French A: Language & Literature HL',
          'French A: Language & Literature SL',
          'Mandarin A: Language & Literature HL',
          'Mandarin A: Language & Literature SL',
          'Spanish A: Language & Literature HL',
          'Spanish A: Language & Literature SL',
          'Literature and Performance SL',
        ]
      },
      {
        name: 'Group 2: Language Acquisition',
        required: 1,
        subjects: [
          'English B HL', 'English B SL',
          'Arabic B HL', 'Arabic B SL',
          'French B HL', 'French B SL',
          'Spanish B HL', 'Spanish B SL',
          'English ab initio SL', 'French ab initio SL', 'Spanish ab initio SL',
        
          'Mandarin B HL',
          'Mandarin B SL',
          'Arabic ab initio SL',
          'Mandarin ab initio SL',
          'Classical Languages: Latin HL',
          'Classical Languages: Latin SL',
          'Classical Languages: Classical Greek HL',
          'Classical Languages: Classical Greek SL',
        ]
      },
      {
        name: 'Group 3: Individuals & Societies',
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
        
          'Social and Cultural Anthropology HL',
          'Social and Cultural Anthropology SL',
          'World Religions SL',
        ]
      },
      {
        name: 'Group 4: Sciences',
        required: 1,
        subjects: [
          'Biology HL', 'Biology SL',
          'Chemistry HL', 'Chemistry SL',
          'Physics HL', 'Physics SL',
          'Computer Science HL', 'Computer Science SL',
          'Environmental Systems & Societies SL',
          'Sports Exercise & Health Science HL', 'Sports Exercise & Health Science SL',
          'Design Technology HL', 'Design Technology SL',
        
          'Environmental Systems and Societies HL',
          'Environmental Systems and Societies SL',
          'Sports, Exercise, and Health Science HL',
          'Sports, Exercise, and Health Science SL',
        ]
      },
      {
        name: 'Group 5: Mathematics',
        required: 1,
        subjects: [
          'Math Analysis & Approaches HL',
          'Math Analysis & Approaches SL',
          'Math Applications & Interpretation HL',
          'Math Applications & Interpretation SL',
        ]
      },
      {
        name: 'Group 6: The Arts',
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
    maxSubjects: 6,
    // Added automatically for every IB student; never chosen from the groups.
    core: IB_CORE_SUBJECTS,
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
          'AP Biology', 'AP Chemistry', 'AP Physics 1: Algebra-Based',
          'AP Physics 2: Algebra-Based', 'AP Physics C: Mechanics',
          'AP Physics C: Electricity and Magnetism', 'AP Environmental Science',
        ]
      },
      {
        name: 'History & Social Sciences',
        required: 0,
        subjects: [
          'AP World History: Modern', 'AP United States History', 'AP European History',
          'AP United States Government and Politics', 'AP Comparative Government and Politics',
          'AP Macroeconomics', 'AP Microeconomics',
          'AP Psychology', 'AP Human Geography', 'AP African American Studies',
        ]
      },
      {
        name: 'English',
        required: 0,
        subjects: [
          'AP English Language and Composition',
          'AP English Literature and Composition',
        ]
      },
      {
        name: 'World Languages',
        required: 0,
        subjects: [
          'AP Spanish Language and Culture',
          'AP French Language and Culture',
          'AP Chinese Language and Culture',
          'AP German Language and Culture', 'AP Italian Language and Culture',
          'AP Japanese Language and Culture',
        ]
      },
      {
        name: 'Arts',
        required: 0,
        subjects: [
          'AP Art History', 'AP Music Theory',
          'AP 2-D Art and Design', 'AP 3-D Art and Design', 'AP Drawing',
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
          'Computer Science', 'Information Technology (IT) / Applied ICT',
        ]
      },
      {
        name: 'Sciences',
        required: 0,
        subjects: [
          'Biology', 'Chemistry', 'Physics', 'Psychology',
          'Environmental Science / Environmental Management', 'Geology', 'Marine Science',
        ]
      },
      {
        name: 'Humanities & Social Sciences',
        required: 0,
        subjects: [
          'History', 'Geography', 'Economics',
          'Politics / Government and Politics', 'Sociology', 'Philosophy',
          'Law', 'Ancient History', 'Classical Civilisation / Classical Studies',
          'Religious Studies / Divinity',
        ]
      },
      {
        name: 'English',
        required: 0,
        subjects: [
          'English Language', 'English Literature',
          'English Language and Literature',
        ]
      },
      {
        name: 'Business & Technical',
        required: 0,
        subjects: [
          'Business Studies', 'Accounting',
          'Design and Technology (D&T)', 'Electronics',
          'Food Science and Nutrition', 'Travel and Tourism',
        ]
      },
      {
        name: 'Creative & Performing Arts',
        required: 0,
        subjects: [
          'Art and Design (Fine Art, Graphics, Photography, Textiles, 3D Design)', 'Drama and Theatre Studies',
          'Music', 'Music Technology', 'Film Studies',
          'Media Studies', 'Dance', 'Physical Education (PE) / Sports Science',
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

const GRAD_YEARS = ['2027', '2028', '2029', '2030']

export default function Onboarding() {
  const [step, setStep] = useState(1)
  const [curriculum, setCurriculum] = useState('')
  const [gradYear, setGradYear] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState([])
  const [targetGrades, setTargetGrades] = useState({})
  const [loading, setLoading] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState(null)
  const [freePick, setFreePick] = useState('')
  const [savingPick, setSavingPick] = useState(false)
  // Who this is about to be saved against, and whether that account is already
  // set up. Both are read once on arrival.
  const [account, setAccount] = useState(null)
  // Consent, for anyone who did not give it on the sign-up form — which is
  // everybody who came in through Google.
  const [needsConsent, setNeedsConsent] = useState(false)
  const [guardianOk, setGuardianOk] = useState(false)
  const [termsOk, setTermsOk] = useState(false)
  const [alreadySetUp, setAlreadySetUp] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const currentCurriculum = CURRICULUMS[curriculum]

  // Six subjects for the Diploma, and no rules about which groups they come
  // from. Plenty of real timetables break the standard pattern, and blocking
  // someone at sign-up over it helps nobody.
  const subjectsValid = curriculum === 'IB'
    ? selectedSubjects.length === 6
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

  const isIB = curriculum === 'IB'
  const coreSubjects = currentCurriculum?.core || []

  // IB needs a grade for each chosen subject plus TOK and EE; other curricula
  // only need one per chosen subject.
  const ibTotal = predictedTotal(targetGrades, selectedSubjects)
  const consentComplete = !needsConsent || (guardianOk && termsOk)

  const gradesComplete = isIB
    ? selectedSubjects.every((s) => targetGrades[s]) &&
      !!targetGrades['Theory of Knowledge'] &&
      !!targetGrades['Extended Essay']
    : Object.keys(targetGrades).length === selectedSubjects.length

  /**
   * Whose account is this?
   *
   * Onboarding used to write to whatever session happened to be live, without
   * ever checking whether that account was already set up. On a shared device
   * that is how one student's answers replaced another's: the friend signed
   * up, the browser was still signed in as the first student, and onboarding
   * saved the friend's subjects onto the first student's profile.
   *
   * Signing out before a sign-up stops that starting. This stops it finishing.
   */
  useEffect(() => {
    let cancelled = false
    async function check() {
      const user = await getCurrentUser(supabase)
      if (cancelled) return
      if (!user) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('subjects')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      const subjects = Array.isArray(profile?.subjects) ? profile.subjects : []
      // Google never showed the boxes, so ask here. The metadata is only set by
      // the e-mail form, which records the wording as it goes.
      setNeedsConsent(!user.user_metadata?.guardian_consent_text)
      setAccount({ email: user.email, id: user.id })
      setAlreadySetUp(subjects.length > 0)
      setChecking(false)
    }
    check()
    return () => {
      cancelled = true
    }
  }, [router, supabase])

  const startOver = async () => {
    await supabase.auth.signOut()
    router.push('/signup')
  }

  const handleFinish = async () => {
    setLoading(true)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push('/login')
        return
      }
      // Checked again at the moment of writing, not only on arrival: a sign-in
      // in another tab can change who this session belongs to while the form
      // is being filled in.
      if (account && user.id !== account.id) {
        setLoading(false)
        setAccount({ email: user.email, id: user.id })
        setAlreadySetUp(true)
        return
      }
      
      // The IB core is part of every Diploma, so it is appended rather than chosen.
      const coreSubjects = currentCurriculum?.core || []
      const allSubjects = [...selectedSubjects, ...coreSubjects]

      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        // Carried from the sign-up form so the record sits on the profile, with
        // the wording that was actually agreed to rather than a bare boolean.
        // Recorded with the wording that was actually agreed to, on whichever
        // screen agreed to it. Stamping a timestamp with no text — which is
        // what this did for every Google account — records a consent nobody
        // was ever shown.
        guardian_consent_at:
          user.user_metadata?.guardian_consent_at || new Date().toISOString(),
        guardian_consent_text:
          user.user_metadata?.guardian_consent_text || (needsConsent ? CONSENT_TEXT.en : null),
        curriculum,
        grad_year: gradYear,
        subjects: allSubjects,
        target_grades: targetGrades,
        updated_at: new Date().toISOString()
      })

      if (error) {
        console.error('Profile save error:', error)
        setLoading(false)
        return
      }

      // Apply a school code entered at signup. The server decides entitlement,
      // checks the email domain and counts the seat, so nothing is self-granted.
      const code = user.user_metadata?.school_code
      let unlocked = false
      if (code) {
        const { data: result } = await supabase.rpc('redeem_access_code', { p_code: code })
        unlocked = !!result?.ok
      }

      // Premium accounts have every subject, so there is nothing to choose.
      // Free accounts pick their one subject here rather than later, because
      // picking later means picking repeatedly.
      if (unlocked) {
        router.push('/dashboard')
        return
      }

      setFreePick(selectedSubjects[0] || '')
      setLoading(false)
      setStep(4)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  const saveFreeSubject = async () => {
    if (savingPick || !freePick) return
    setSavingPick(true)
    const user = await getCurrentUser(supabase)
    if (!user) {
      router.push('/login')
      return
    }
    // The hold is what stops the free plan being cycled through every subject.
    await supabase
      .from('profiles')
      .update({
        free_subject: freePick,
        free_subject_locked_until: freeSubjectLockUntil(),
      })
      .eq('id', user.id)
    router.push('/dashboard')
  }

  const frame = (children) => (
    <main className="page ground px-5 py-10 md:px-6 md:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-12 flex justify-center">
          <Link href="/">
            <Logo width={220} height={66} priority className="h-auto w-[170px] md:w-[200px]" />
          </Link>
        </div>
        {children}
      </div>
    </main>
  )

  if (checking) {
    return frame(
      <span className="sr-only" role="status" aria-live="polite">
        Checking your account
      </span>
    )
  }

  /**
   * This account is already set up, so nothing here is going to be saved over
   * it. Filling the form in again is how somebody else's subjects replaced a
   * real student's, and the fix is to say plainly whose account this is before
   * a single question is asked.
   */
  if (alreadySetUp) {
    return frame(
      <div className="text-center">
        <p
          className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: 'var(--text-faint)' }}
        >
          Already set up
        </p>
        <h1 className="mt-3 text-[clamp(1.5rem,3.4vw,2.1rem)] font-semibold leading-tight tracking-[-0.03em]">
          You are signed in as {account?.email}
        </h1>
        <p
          className="mx-auto mt-4 max-w-md text-[14.5px] leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          This account already has its subjects and targets. Setting them up again here
          would write over them, so it stops. If you are somebody else on this device,
          start a new account and you will be signed out of this one first.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard" className="btn btn-solid control-md">
            Go to my dashboard
          </Link>
          <button onClick={startOver} className="btn btn-outline control-md">
            This is not me, make a new account
          </button>
        </div>
        <p className="mt-8 text-[13px]" style={{ color: 'var(--text-faint)' }}>
          To change subjects on this account, use Profile rather than this page.
        </p>
      </div>
    )
  }

  return (
    <main className="page ground px-5 py-10 md:px-6 md:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-12 flex justify-center">
          <Link href="/">
            <Logo width={220} height={66} priority className="h-auto w-[170px] md:w-[200px]" />
          </Link>
        </div>

        {/* Whose account this is, said out loud before any of it is filled in. */}
        {account?.email && (
          <p
            className="mb-8 text-center text-[12.5px]"
            style={{ color: 'var(--text-faint)' }}
          >
            Setting up {account.email} ·{' '}
            <button onClick={startOver} className="underline underline-offset-2">
              not you?
            </button>
          </p>
        )}

        {/* Where you are. A rail rather than four discs: the numbers were
            decoration, and the only thing worth reading is which part you are
            on and how much is left. */}
        <div className="mb-12">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((n) => (
              <span
                key={n}
                className="h-1 flex-1 rounded-full transition-colors duration-300"
                style={{ background: step >= n ? 'var(--brand)' : 'var(--border-strong)' }}
              />
            ))}
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p
              className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: 'var(--text-faint)' }}
            >
              {['Setup', 'Subjects', 'Goals', 'Start'][step - 1]}
            </p>
            <p className="text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
              Step {step} of 4
            </p>
          </div>
        </div>

        {/* Step 1, Curriculum and year */}
        {step === 1 && (
          <div
            className="rounded-[14px] border p-6 md:p-9"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
          >
            <h1 className="text-[clamp(1.5rem,3vw,1.9rem)] font-semibold leading-[1.15] tracking-[-0.03em]">
              Let&rsquo;s set up your profile
            </h1>
            <p className="mb-9 mt-3 text-[14.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Tell us about your curriculum so we can map your exact syllabus.
            </p>

            <div className="mb-6">
              <p className="label" id="curriculum-label">
                Which curriculum are you studying?
              </p>
              <div className="grid grid-cols-3 gap-3" role="group" aria-labelledby="curriculum-label">
                {['IB', 'AP', 'A-Level'].map(c => (
                  <button key={c} aria-pressed={curriculum === c} onClick={() => {
                    setCurriculum(c)
                    setSelectedSubjects([])
                    setTargetGrades({})
                  }}
                  className={`rounded-full border py-3.5 text-[13.5px] font-semibold transition-colors duration-150
                  ${curriculum === c ? 'chip-active' : 'chip hover:border-border-strong'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <p className="label" id="gradyear-label">
                When do you graduate?
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-labelledby="gradyear-label">
                {GRAD_YEARS.map(y => (
                  <button key={y} aria-pressed={gradYear === y} onClick={() => setGradYear(y)}
                  className={`control-lg rounded-full border text-[13.5px] font-semibold tabular-nums transition-colors duration-150
                  ${gradYear === y ? 'chip-active' : 'chip hover:border-border-strong'}`}>
                    {y}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!curriculum || !gradYear}
              className="btn btn-solid control-lg w-full text-base">
              Continue
            </button>
          </div>
        )}

        {/* Step 2, Subject selection by group */}
        {step === 2 && currentCurriculum && (
          <div
            className="rounded-[14px] border p-6 md:p-9"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
          >
            <h1 className="text-[clamp(1.5rem,3vw,1.9rem)] font-semibold leading-[1.15] tracking-[-0.03em]">
              Select your subjects
            </h1>
            <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {curriculum === 'IB' && 'Pick the six subjects you actually take. Theory of Knowledge, the Extended Essay and CAS are added for you.'}
              {curriculum === 'AP' && 'Select the AP courses you are taking.'}
              {curriculum === 'A-Level' && 'Most students take 3-4 A-Level subjects.'}
            </p>
            <p className="mb-8 mt-2 text-[12.5px] font-semibold tabular-nums" style={{ color: 'var(--brand)' }}>
              {selectedSubjects.length}/{currentCurriculum.maxSubjects} selected
            </p>

            <div className="space-y-3 mb-8 max-h-96 overflow-y-auto pr-1">
              {currentCurriculum.groups.map((group, gi) => (
                <div key={gi} className="overflow-hidden rounded-xl border border-border">
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
                        className={`rounded-full border px-3.5 py-2 text-left text-[12.5px] font-medium transition-colors duration-150
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
              <div className="mb-7 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
                <p className="section-label mb-3">
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

            {/* The DP core is compulsory, so it is shown as included rather than offered. */}
            {isIB && coreSubjects.length > 0 && (
              <div className="mb-7 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
                <p className="text-[14px] font-medium">Included automatically</p>
                <p className="mb-4 mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Every Diploma candidate takes the core, so we add it for you. TOK and the
                  Extended Essay are worth up to 3 bonus points.
                </p>
                <div className="flex flex-wrap gap-2">
                  {coreSubjects.map((s) => (
                    <span key={s} className="chip">{s}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn btn-quiet control-md px-6">
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!subjectsValid}
                className="btn btn-solid control-lg flex-1 text-base">
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3, Target grades */}
        {step === 3 && currentCurriculum && (
          <div
            className="rounded-[14px] border p-6 md:p-9"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
          >
            <h1 className="text-[clamp(1.5rem,3vw,1.9rem)] font-semibold leading-[1.15] tracking-[-0.03em]">
              Set your target grades
            </h1>
            <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              What are you aiming for in each one? Everything on your dashboard is measured
              against these, so set them where you honestly intend to land.
            </p>
            <p
              className="mb-9 mt-5 border-l-2 pl-4 text-[14px] leading-relaxed"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-body)' }}
            >
              {realismNote({ curriculum })} You can raise them whenever you get there.
            </p>

            <div className="space-y-4 mb-6 max-h-80 overflow-y-auto pr-1">
              {selectedSubjects.map(subject => (
                <div key={subject} className="border-b pb-4" style={{ borderColor: 'var(--border)' }}>
                  <p className="mb-3 text-[14px] font-medium">{subject}</p>
                  <div className="flex gap-2 flex-wrap">
                    {currentCurriculum.grades.map(grade => (
                      <button key={grade} onClick={() => setGrade(subject, grade)}
                      className={`h-10 w-10 rounded-full border text-[13.5px] font-semibold transition-colors duration-150
                      ${targetGrades[subject] === grade ? 'chip-active' : 'chip hover:border-border-strong'}`}>
                        {grade}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* TOK and EE are graded A-E and combine for up to 3 bonus points. */}
              {isIB && ['Theory of Knowledge', 'Extended Essay'].map(component => (
                <div key={component} className="border-b pb-4" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-[14px] font-medium">{component}</p>
                  <p className="mb-3 mt-1 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                    Graded A to E
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {CORE_GRADES.map(grade => (
                      <button key={grade} onClick={() => setGrade(component, grade)}
                      className={`h-10 w-10 rounded-full border text-[13.5px] font-semibold transition-colors duration-150
                      ${targetGrades[component] === grade ? 'chip-active' : 'chip hover:border-border-strong'}`}>
                        {grade}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Live Diploma total */}
            {isIB && (
              <div className="mb-9 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[14px] font-medium">Target Diploma total</span>
                  <span
                    className="text-[30px] font-semibold leading-none tracking-[-0.028em] tabular-nums"
                    style={{ color: 'var(--brand)' }}
                  >
                    {ibTotal.total}
                    <span className="text-[14px] font-normal" style={{ color: 'var(--text-faint)' }}>
                      /{MAX_TOTAL_POINTS}
                    </span>
                  </span>
                </div>
                <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {ibTotal.subjectPoints} from {ibTotal.gradedCount} subject
                  {ibTotal.gradedCount === 1 ? '' : 's'}
                  {typeof ibTotal.bonus === 'number'
                    ? ` plus ${ibTotal.bonus} core bonus point${ibTotal.bonus === 1 ? '' : 's'}`
                    : ibTotal.failing
                      ? '. A grade of E in TOK or the Extended Essay is a failing condition.'
                      : '. Set TOK and Extended Essay grades to see your bonus points.'}
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                  This is what you are aiming for, not a prediction. Your dashboard predicts the{' '}
                  {MAX_SUBJECT_POINTS} points from your six subjects, because those are the ones it
                  can measure. The TOK and Extended Essay points arrive when that coursework is
                  marked.
                </p>
              </div>
            )}

            {/* The consent that the sign-up form asks for, for the people who
                never saw that form. It is the last thing before the account
                starts being used, and it is recorded with its wording. */}
            {needsConsent && (
              <div
                className="mb-7 border-t pt-6"
                style={{ borderColor: 'var(--border)' }}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={guardianOk}
                    onChange={(e) => setGuardianOk(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
                  />
                  <span className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                    {CONSENT_TEXT.en}
                  </span>
                </label>
                <label className="mt-3 flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={termsOk}
                    onChange={(e) => setTermsOk(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
                  />
                  <span className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                    I agree to the{' '}
                    <Link href="/terms" className="underline" style={{ color: 'var(--brand)' }}>
                      Terms
                    </Link>
                    ,{' '}
                    <Link href="/privacy" className="underline" style={{ color: 'var(--brand)' }}>
                      Privacy Policy
                    </Link>{' '}
                    and{' '}
                    <Link href="/cookies" className="underline" style={{ color: 'var(--brand)' }}>
                      Cookie Policy
                    </Link>
                    .
                  </span>
                </label>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="btn btn-quiet control-md px-6">
                Back
              </button>
              <button
                onClick={handleFinish}
                disabled={loading || !gradesComplete || !consentComplete}
                className="btn btn-solid control-lg flex-1 text-base">
                {loading ? 'Setting up…' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4, the one subject a free account starts with */}
        {step === 4 && (
          <div
            className="rounded-[14px] border p-6 md:p-9"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
          >
            <h1 className="text-[clamp(1.5rem,3vw,1.9rem)] font-semibold leading-[1.15] tracking-[-0.03em]">
              Which subject do you want to start with?
            </h1>
            <p className="mb-8 mt-3 text-[14.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              The free plan opens one subject completely: every topic, every quiz, its own study
              plan. Pick the one you most need to get on top of. You can change it later, though
              not straight away, so choose the subject you are actually revising.
            </p>

            <div className="flex flex-col gap-2 mb-6">
              {selectedSubjects.map((subject) => (
                <button
                  key={subject}
                  onClick={() => setFreePick(subject)}
                  aria-pressed={freePick === subject}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors duration-150 ${
                    freePick === subject
                      ? 'border-[var(--brand)] bg-[var(--brand-tint)]'
                      : 'border-[var(--border-strong)] hover:border-[var(--border-hover)]'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      freePick === subject ? 'border-[var(--brand)]' : 'border-[var(--border-hover)]'
                    }`}
                  >
                    {freePick === subject && (
                      <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
                    )}
                  </span>
                  <span className="text-[14.5px] font-medium">{subject}</span>
                </button>
              ))}
            </div>

            <p className="t-caption mb-5">
              Theory of Knowledge, the Extended Essay and CAS stay open whatever you pick, because
              they are part of the Diploma rather than a subject you chose.
            </p>

            <button
              onClick={saveFreeSubject}
              disabled={savingPick || !freePick}
              className="btn btn-solid control-lg w-full text-base"
            >
              {savingPick ? 'Setting up…' : 'Go to my dashboard'}
            </button>

            <p className="t-caption mt-4 text-center">
              Have a school code? Add it in your profile and every subject opens.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}