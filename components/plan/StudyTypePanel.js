'use client'

/**
 * Find your study type, inside the study plan.
 *
 * It used to be a page and a sidebar tab of its own, but all it is for is
 * setting the plan up (rhythm, mix, methods, goal), so it lives where the plan
 * does. The answers are kept on the profile so the result is here next time,
 * and the plan only changes when the student presses apply.
 */

import { invalidateProfile } from '@/lib/cache'
import StudyStyle from '@/components/StudyStyle'
import { resultOf, applyTo } from '@/lib/study-style'

export default function StudyTypePanel({ supabase, profile, onProfile, onClose, fresh = false }) {
  // Read fresh each time: the plan's own settings may have changed meanwhile.
  const save = async (change) => {
    const { data } = await supabase.from('profiles').select('plan_settings').eq('id', profile.id).maybeSingle()
    const plan_settings = change(data?.plan_settings || profile.plan_settings || {})
    const { error } = await supabase.from('profiles').update({ plan_settings }).eq('id', profile.id)
    if (error) return false
    invalidateProfile(profile.id)
    onProfile((p) => ({ ...p, plan_settings }))
    return true
  }

  const saved = profile.plan_settings?.studyStyle
  return (
    <section className="mb-12 rounded-[20px] border px-5 py-8 sm:px-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} aria-label="Your study type">
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
          Your study type
        </p>
        <button type="button" onClick={onClose} className="btn btn-quiet control-sm">
          Close
        </button>
      </div>
      <StudyStyle
        initialAnswers={fresh ? null : saved?.answers || null}
        initialApplied={!fresh && Boolean(saved?.applied)}
        onResult={(answers) => save((ps) => ({ ...ps, studyStyle: { answers, type: resultOf(answers).type, at: new Date().toISOString() } }))}
        onApply={(answers) =>
          save((ps) => {
            const next = applyTo(ps, answers)
            next.studyStyle.applied = true
            return next
          })
        }
      />
    </section>
  )
}
