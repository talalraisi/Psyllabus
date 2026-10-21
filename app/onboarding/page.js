'use client'
import { CURRICULUMS } from '@/lib/catalogue'
import { useState, useEffect } from 'react'
import { CONSENT_TEXT } from '@/lib/consent'
import { getCoverage, coverageLabel, bestCoverage, COVERAGE_TONE } from '@/lib/coverage'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Select, { Chevron } from '@/components/Select'
import Logo from '@/components/Logo'
import PlanStep from '@/components/onboarding/PlanStep'
import { splitLevel, coursesOf, defaultLevel } from '@/lib/course-levels'
import { getCurrentUser } from '@/lib/auth'
import { realismNote, curriculumOf } from '@/lib/curriculum'
import { claimFreeSubject } from '@/lib/free-claim'
import { invalidateProfile } from '@/lib/cache'
import {
  IB_CORE_SUBJECTS,
  CORE_GRADES,
  coreBonusPoints,
  predictedTotal,
  MAX_TOTAL_POINTS,
  MAX_SUBJECT_POINTS,
} from '@/lib/ib-points'


const GRAD_YEARS = ['2027', '2028', '2029', '2030']

export default function Onboarding() {
  const [step, setStep] = useState(1)
  const [curriculum, setCurriculum] = useState('')
  const [gradYear, setGradYear] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState([])
  const [targetGrades, setTargetGrades] = useState({})
  // The grade predicted now, where the student has one. Optional.
  const [predictedGrades, setPredictedGrades] = useState({})
  const [loading, setLoading] = useState(false)
  // Groups open in the picker. Several can be open, and none closes by
  // itself: picking one subject used to fold the group and jump on, which
  // lost anyone taking two from the same group.
  const [openGroups, setOpenGroups] = useState(() => new Set([0]))
  const [subjectQuery, setSubjectQuery] = useState('')
  const [freePick, setFreePick] = useState('')
  const [savingPick, setSavingPick] = useState(false)
  const [pickError, setPickError] = useState('')
  // Who this is about to be saved against, and whether that account is already
  // set up. Both are read once on arrival.
  const [account, setAccount] = useState(null)
  // Consent, for anyone who did not give it on the sign-up form — which is
  // everybody who came in through Google.
  const [needsConsent, setNeedsConsent] = useState(false)
  const [guardianOk, setGuardianOk] = useState(false)
  const [termsOk, setTermsOk] = useState(false)
  const [alreadySetUp, setAlreadySetUp] = useState(false)
  // Changing subjects later (?edit=subjects from Profile): the same picker,
  // with the free subject held in place and no free-subject step after.
  const [editing, setEditing] = useState(false)
  const [keepFree, setKeepFree] = useState('')
  const [skipFreePick, setSkipFreePick] = useState(false)
  const [checking, setChecking] = useState(true)
  // How much of each subject has questions in it, so nobody picks four empty
  // ones without being told.
  const [coverage, setCoverage] = useState({})
  const router = useRouter()
  const supabase = createClient()

  const currentCurriculum = CURRICULUMS[curriculum]

  // Six subjects for the Diploma, and no rules about which groups they come
  // from. Plenty of real timetables break the standard pattern, and blocking
  // someone at sign-up over it helps nobody.
  const subjectsValid = curriculum === 'IB'
    ? selectedSubjects.length === 6
    : selectedSubjects.length > 0

  /**
   * Choosing a course, then choosing its level.
   *
   * The list used to be "Biology HL" and "Biology SL" as two unrelated
   * entries, so a student scanning for their subject read the same word
   * twice and had to know which of the two they were before they could find
   * either. Now the course is the choice, and the level is the question that
   * follows it — including the honest answer, which for a lot of people in
   * their first week is that nobody has told them yet.
   */
  const [levelFor, setLevelFor] = useState(null)

  const toggleSubject = (subject) => {
    // A free account's free subject stays on its list (the database holds
    // the same rule), or removing it would hand the free place to another.
    if (editing && keepFree && subject === keepFree && selectedSubjects.includes(subject)) return
    if (selectedSubjects.includes(subject)) {
      setSelectedSubjects(selectedSubjects.filter(s => s !== subject))
      const newGrades = {...targetGrades}
      delete newGrades[subject]
      setTargetGrades(newGrades)
    } else if (!currentCurriculum || selectedSubjects.length < currentCurriculum.maxSubjects) {
      setSelectedSubjects([...selectedSubjects, subject])
    }
  }

  const pickLevel = (full) => {
    toggleSubject(full)
    setLevelFor(null)
  }

  const setGrade = (subject, grade) => {
    setTargetGrades({...targetGrades, [subject]: grade})
  }
  const setPredicted = (subject, grade) => {
    const next = { ...predictedGrades }
    if (grade) next[subject] = grade
    else delete next[subject]
    setPredictedGrades(next)
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
        .select('subjects, curriculum, grad_year, target_grades, predicted_grades, free_subject, plan, is_admin, access_expires_at')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      const subjects = Array.isArray(profile?.subjects) ? profile.subjects : []

      // Set up is not the same as used. A student who picked wrong two minutes
      // ago has nothing filed under those subjects, and the database will let
      // them change the list; refusing here would be the app being stricter
      // than the rule it is enforcing.
      const [{ count: progressCount }, { count: attemptCount }] = await Promise.all([
        supabase
          .from('progress')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('quiz_attempts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ])
      const hasWork = (progressCount || 0) > 0 || (attemptCount || 0) > 0
      // Google never showed the boxes, so ask here. The metadata is only set by
      // the e-mail form, which records the wording as it goes.
      setNeedsConsent(!user.user_metadata?.guardian_consent_text)
      setAccount({ email: user.email, id: user.id })
      const edit = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('edit') === 'subjects'
      const everything =
        profile?.is_admin || ['basic', 'premium'].includes(profile?.plan) || (profile?.access_expires_at && new Date(profile.access_expires_at) > new Date())
      setAlreadySetUp(subjects.length > 0 && hasWork && !edit)
      // Coming back to change the list: start on the subjects rather than on
      // the curriculum, with the old choices in place.
      if (subjects.length > 0 && (!hasWork || edit)) {
        setEditing(edit)
        setKeepFree(everything ? '' : profile.free_subject || '')
        setSkipFreePick(Boolean(everything || profile.free_subject))
        setCurriculum(profile.curriculum || '')
        setGradYear(profile.grad_year ? String(profile.grad_year) : '')
        setSelectedSubjects(subjects.filter((s) => !IB_CORE_SUBJECTS.includes(s)))
        setTargetGrades(profile.target_grades || {})
        setPredictedGrades(profile.predicted_grades || {})
        setStep(2)
      }
      setChecking(false)
    }
    check()
    return () => {
      cancelled = true
    }
  }, [router, supabase])

  useEffect(() => {
    let cancelled = false
    getCoverage(supabase).then((c) => {
      if (!cancelled) setCoverage(c)
    })
    return () => {
      cancelled = true
    }
  }, [supabase])

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

      // Changing subjects later touches only the subject fields, never the
      // name or the consent record.
      const { error } = editing
        ? await supabase
            .from('profiles')
            .update({ curriculum, grad_year: gradYear, subjects: allSubjects, target_grades: targetGrades, predicted_grades: predictedGrades, updated_at: new Date().toISOString() })
            .eq('id', user.id)
        : await supabase.from('profiles').upsert({
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
        predicted_grades: predictedGrades,
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

      // A list being changed already has its free subject (or needs none).
      if (skipFreePick) {
        invalidateProfile(user.id)
        router.push(editing ? '/dashboard/profile' : '/dashboard')
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
    // Chosen once, through the claim that also checks this is not a second
    // free account for the same person (lib/free-claim.js).
    setPickError('')
    const res = await claimFreeSubject(supabase, freePick)
    if (!res.ok && res.reason !== 'already') {
      setPickError(res.error)
      setSavingPick(false)
      return
    }
    invalidateProfile(user.id)
    router.push('/dashboard')
  }

  const frame = (children) => (
    <main className="page ground px-5 py-10 md:px-6 md:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-12 flex justify-center">
          <Link href="/">
            <Logo width={320} height={96} priority className="h-auto w-[240px] md:w-[280px]" />
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
              This account is already set up, so nothing here will overwrite it. Somebody else on this device should start a new account.
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
          Want different subjects?{' '}
          <Link href="/onboarding?edit=subjects" className="font-medium underline underline-offset-2">
            Change them here
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <main className="page ground px-5 py-10 md:px-6 md:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-12 flex justify-center">
          <Link href="/">
            <Logo width={320} height={96} priority className="h-auto w-[240px] md:w-[280px]" />
          </Link>
        </div>

        {/* Whose account this is, said out loud before any of it is filled in. */}
        {account?.email && (
          /* This was 12.5px of grey, centred, and it got missed — which is
             how somebody signed up a second account, was sent here because
             the new one had no profile, and filled in their subjects again
             believing they were on their first account. Whose account this
             is has to be readable from across the room, because everything
             below gets filed under it. */
          <div
            className="elev mb-8 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border px-4 py-3"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
          >
            <p className="text-[13.5px]">
              <span style={{ color: 'var(--text-muted)' }}>Setting up </span>
              <span className="font-semibold">{account.email}</span>
            </p>
            <button onClick={startOver} className="btn btn-outline control-sm">
              Not you? Sign out
            </button>
          </div>
        )}

        {/* Where you are. A rail rather than four discs: the numbers were
            decoration, and the only thing worth reading is which part you are
            on and how much is left. */}
        <div className="mb-12">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
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
              {['Setup', 'Subjects', 'Goals', 'Plan', 'Start'][step - 1]}
            </p>
            <p className="text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
              Step {step} of 5
            </p>
          </div>
        </div>

        {/* Keyed on the step, so moving between them remounts the panel and
            the entrance plays again instead of the content swapping in place. */}
        <div key={step} className="step-enter">
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
              {curriculum === 'IB' && 'Pick the six subjects you actually take. Theory of Knowledge and the Extended Essay are added for you.'}
              {curriculum === 'AP' && 'Select the AP courses you are taking.'}
              {curriculum === 'A-Level' && 'Most students take 3-4 A-Level subjects.'}
            </p>
            {/* Said before the choice, not after it — but once, in a line.
                Two paragraphs of warning before anybody has chosen anything
                is a wall, and a wall is what people click past. */}
            <p className="mt-4 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
              {editing ? (
                <>
                  <strong className="font-semibold">Your work stays with each subject.</strong> Remove one and
                  its progress is hidden; add it back and it all returns.{keepFree ? ` ${keepFree} is your free subject, so it stays.` : ''}
                </>
              ) : (
                <>
                  <strong className="font-semibold">Choose the subjects you actually take.</strong> You can change
                  them later in Profile; your progress stays filed under each one.
                </>
              )}
            </p>

            {/* The count, as a row of slots that fill up. A student can see
                how many are left without reading a fraction. */}
            <div className="mb-8 mt-6 flex items-center gap-3">
              <div className="flex gap-1.5">
                {Array.from({ length: currentCurriculum.maxSubjects }, (_, i) => (
                  <span
                    key={i}
                    className="h-1.5 w-7 rounded-full transition-colors duration-300"
                    style={{
                      background:
                        i < selectedSubjects.length ? 'var(--brand)' : 'var(--border-strong)',
                    }}
                  />
                ))}
              </div>
              <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: 'var(--brand)' }}>
                {selectedSubjects.length} of {currentCurriculum.maxSubjects}
              </span>
            </div>

            {/* Your picks, removable, so nothing chosen is ever out of sight. */}
            {selectedSubjects.length > 0 && (
              <div className="mb-5 flex flex-wrap gap-1.5">
                {selectedSubjects.map((s) => {
                  const locked = editing && keepFree && s === keepFree
                  return (
                    <span key={s} className="inline-flex items-center gap-1.5 rounded-full py-1 pl-3 pr-1.5 text-[12.5px] font-medium" style={{ background: 'var(--brand-tint)', color: 'var(--text)' }}>
                      {s}
                      {!locked && (
                        <button type="button" onClick={() => toggleSubject(s)} aria-label={`Remove ${s}`} className="flex h-5 w-5 items-center justify-center rounded-full text-[13px] leading-none transition-colors hover:bg-[var(--surface)]" style={{ color: 'var(--text-muted)' }}>
                          ×
                        </button>
                      )}
                    </span>
                  )
                })}
              </div>
            )}

            <input
              value={subjectQuery}
              onChange={(e) => setSubjectQuery(e.target.value)}
              placeholder="Search for a subject"
              aria-label="Search for a subject"
              className="input mb-4 h-11 rounded-full px-4 text-[16px] sm:text-[14px]"
            />

            <div className="mb-8 flex flex-col gap-2.5">
              {currentCurriculum.groups.map((group, gi) => {
                const chosenHere = selectedSubjects.filter((s) => group.subjects.includes(s))
                const q = subjectQuery.trim().toLowerCase()
                const courses = coursesOf(group.subjects).filter((c) => !q || c.base.toLowerCase().includes(q))
                if (q && !courses.length) return null
                const open = Boolean(q) || openGroups.has(gi)
                return (
                  <section
                    key={gi}
                    className="overflow-hidden rounded-[16px] border transition-colors duration-200"
                    style={{ borderColor: chosenHere.length ? 'color-mix(in oklab, var(--brand) 45%, var(--border-strong))' : 'var(--border-strong)', background: 'var(--surface)' }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenGroups((prev) => {
                          const next = new Set(prev)
                          next.has(gi) ? next.delete(gi) : next.add(gi)
                          return next
                        })
                      }
                      aria-expanded={open}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--surface-sunken)]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold">{group.name}</span>
                        <span className="mt-0.5 block truncate text-[12px]" style={{ color: chosenHere.length ? 'var(--brand)' : 'var(--text-faint)' }}>
                          {chosenHere.length ? chosenHere.join(' · ') : group.required > 0 ? 'Usually one from here' : 'Optional'}
                        </span>
                      </span>
                      {chosenHere.length > 0 && (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums" style={{ background: 'var(--brand)', color: '#fff' }}>
                          {chosenHere.length}
                        </span>
                      )}
                      <span className="shrink-0" style={{ color: 'var(--text-faint)' }}>
                        <Chevron open={open} />
                      </span>
                    </button>

                    {open && (
                      <div className="grid grid-cols-1 gap-2 border-t px-4 py-4 sm:grid-cols-2" style={{ borderColor: 'var(--border)' }}>
                        {courses.map((course) => {
                          const chosen = [course.only, ...Object.values(course.levels)].find((f) => f && selectedSubjects.includes(f))
                          const levels = Object.keys(course.levels)
                          const single = course.only || (levels.length === 1 ? course.levels[levels[0]] : null)
                          const asking = levelFor === course.base && !chosen && !single
                          const empty = coverageLabel(chosen || single ? coverage[chosen || single] : bestCoverage(coverage, Object.values(course.levels))).label === 'No questions yet'
                          return (
                            <div
                              key={course.base}
                              className="rounded-[12px] border transition-colors duration-150"
                              style={{ borderColor: chosen || asking ? 'var(--brand)' : 'var(--border)', background: chosen ? 'var(--brand-tint)' : 'transparent' }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (chosen) toggleSubject(chosen)
                                  else if (single) toggleSubject(single)
                                  else setLevelFor(asking ? null : course.base)
                                }}
                                aria-pressed={!!chosen}
                                aria-expanded={single ? undefined : asking}
                                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
                              >
                                <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border" style={{ borderColor: chosen ? 'var(--brand)' : 'var(--border-strong)', background: chosen ? 'var(--brand)' : 'transparent', color: '#fff' }}>
                                  {chosen && (
                                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="m2.5 6.5 2.5 2.5 4.5-5" />
                                    </svg>
                                  )}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{course.base}</span>
                                {splitLevel(chosen || single || '').level && (
                                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={chosen ? { background: 'var(--brand)', color: '#fff' } : { border: '1px solid var(--border-strong)', color: 'var(--text-faint)' }}>
                                    {splitLevel(chosen || single).level}
                                  </span>
                                )}
                                {empty && !chosen && (
                                  <span className="shrink-0 text-[10.5px]" style={{ color: 'var(--text-faint)' }} title="Questions for this subject are still being written">
                                    soon
                                  </span>
                                )}
                              </button>
                              {asking && (
                                <div className="flex flex-wrap items-center gap-1.5 border-t px-3.5 py-2.5" style={{ borderColor: 'var(--border)' }}>
                                  <span className="mr-1 text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                                    Level
                                  </span>
                                  {levels.map((lv) => (
                                    <button key={lv} type="button" onClick={() => pickLevel(course.levels[lv])} className="btn btn-outline control-sm">
                                      {lv}
                                    </button>
                                  ))}
                                  <button type="button" onClick={() => pickLevel(defaultLevel(course))} className="btn btn-quiet control-sm">
                                    Not sure
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>

            {/* The DP core is compulsory, so it is shown as included rather than offered. */}
            {isIB && coreSubjects.length > 0 && (
              <div className="mb-7 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
                <p className="text-[14px] font-medium">Included automatically</p>
                <p className="mb-4 mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Added for you. TOK and the EE are worth up to 3 points.
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
            <p className="mb-8 mt-3 text-[14.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Where you honestly intend to land. Raise them whenever you get there.
            </p>

            {/* What the two numbers are, said once, quietly. */}
            <p className="-mt-4 mb-5 text-[12.5px] leading-relaxed" style={{ color: 'oklch(0.8 0.09 85)' }}>
              On the left, the grade you are predicted now, if you have one. On the right, the grade you are aiming for.
            </p>

            <div className="mb-6 flex flex-col">
              {[...selectedSubjects, ...(isIB ? ['Theory of Knowledge', 'Extended Essay'] : [])].map((subject) => {
                const core = subject === 'Theory of Knowledge' || subject === 'Extended Essay'
                const grades = core ? CORE_GRADES : currentCurriculum.grades
                return (
                  <div key={subject} className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b py-3.5" style={{ borderColor: 'var(--border)' }}>
                    <p className="min-w-[9rem] flex-1 text-[14px] font-medium">
                      {subject}
                      {core && (
                        <span className="ml-2 text-[12px] font-normal" style={{ color: 'var(--text-faint)' }}>
                          A–E
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      <Select
                        value={predictedGrades[subject] || ''}
                        onChange={(e) => setPredicted(subject, e.target.value)}
                        aria-label={`${subject}: predicted now`}
                        className="h-10 w-[5.75rem] rounded-full border pl-3.5 pr-1.5 text-[13.5px] font-semibold tabular-nums"
                        style={{ borderColor: 'var(--border-strong)', color: predictedGrades[subject] ? 'var(--text)' : 'var(--text-faint)' }}
                      >
                        <option value="">Now</option>
                        {[...grades].reverse().map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </Select>
                      <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--text-faint)' }}>
                        <path d="m4.5 2.5 3.5 3.5-3.5 3.5" />
                      </svg>
                      <Select
                        value={targetGrades[subject] || ''}
                        onChange={(e) => setGrade(subject, e.target.value)}
                        aria-label={`${subject}: target`}
                        className="h-10 w-[5.75rem] rounded-full border pl-3.5 pr-1.5 text-[13.5px] font-semibold tabular-nums"
                        style={{ borderColor: targetGrades[subject] ? 'var(--brand)' : 'var(--border-strong)', background: targetGrades[subject] ? 'var(--brand-tint)' : 'transparent', color: targetGrades[subject] ? 'var(--text)' : 'var(--text-faint)' }}
                      >
                        <option value="">Target</option>
                        {[...grades].reverse().map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                )
              })}
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
                      ? '. An E in TOK or the EE fails the Diploma.'
                      : '. Set TOK and EE to see your bonus points.'}
                </p>
                {/* The two caveats worth making, and only when they apply:
                    one about aiming high, one about what this number is. */}
                <details className="mt-3">
                  <summary className="cursor-pointer text-[12px]" style={{ color: 'var(--text-faint)' }}>
                    What this number is
                  </summary>
                  <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                    A target, not a prediction. Your dashboard predicts the {MAX_SUBJECT_POINTS}
                    {' '}points it can measure from quizzes; TOK and the EE arrive when that
                    coursework is marked. {realismNote({ curriculum })}
                  </p>
                </details>
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
                <label className="flex cursor-pointer items-start gap-2.5 py-2.5">
                  <input
                    type="checkbox"
                    checked={guardianOk}
                    onChange={(e) => setGuardianOk(e.target.checked)}
                    className="mt-[1px] h-[15px] w-[15px] shrink-0 accent-[var(--brand)]"
                  />
                  <span className="text-[12px] leading-[1.55]" style={{ color: 'var(--text-muted)' }}>
                    {CONSENT_TEXT.en}
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 border-t py-2.5" style={{ borderColor: 'var(--border)' }}>
                  <input
                    type="checkbox"
                    checked={termsOk}
                    onChange={(e) => setTermsOk(e.target.checked)}
                    className="mt-[1px] h-[15px] w-[15px] shrink-0 accent-[var(--brand)]"
                  />
                  <span className="text-[12px] leading-[1.55]" style={{ color: 'var(--text-muted)' }}>
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

        {/* Step 4, the plans: before the free subject, with a code box and
            what free leaves out (components/onboarding/PlanStep). */}
        {step === 4 && (
          <PlanStep
            supabase={supabase}
            onFree={() => setStep(5)}
            onUnlocked={async () => {
              const user = await getCurrentUser(supabase)
              if (user) invalidateProfile(user.id)
              router.push('/dashboard')
            }}
          />
        )}

        {/* Step 5, the one subject a free account starts with */}
        {step === 5 && (
          <div
            className="rounded-[14px] border p-6 md:p-9"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
          >
            <h1 className="text-[clamp(1.5rem,3vw,1.9rem)] font-semibold leading-[1.15] tracking-[-0.03em]">
              Which subject do you want to start with?
            </h1>
            <p className="mb-8 mt-3 text-[14.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              One subject, completely: every topic, every quiz, its own plan. Pick the one you are actually revising. This is the one that stays open, and it is not changed later.
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
              TOK and the EE stay open whatever you pick.
            </p>

            <button
              onClick={saveFreeSubject}
              disabled={savingPick || !freePick}
              className="btn btn-solid control-lg w-full text-base"
            >
              {savingPick ? 'Setting up…' : 'Go to my dashboard'}
            </button>
            {pickError && (
              <p className="mt-3 text-center text-[13px]" role="alert" style={{ color: 'var(--status-weak)' }}>
                {pickError}
              </p>
            )}

            <button type="button" onClick={() => setStep(4)} className="t-caption mx-auto mt-4 block hover:underline">
              Back to the plans, or use a code
            </button>
          </div>
        )}
        </div>
      </div>
    </main>
  )
}