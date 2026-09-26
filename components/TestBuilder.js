'use client'

import { useState } from 'react'
import { IconClock, IconCheck, IconChevronRight, IconArrowLeft, IconArrowRight } from '@/components/Icons'
import { SkeletonLine } from '@/components/PageShell'
import { displaySubtopic } from '@/lib/progress'

/**
 * One decision at a time.
 *
 * This was a long form: every control on one page, the paper summarised in a
 * sidebar, and a scroll between you and the button. Restyling it did not help,
 * because the shape was the problem. A page that shows you sixteen controls at
 * once is a settings screen, and setting a paper is not what anyone came here
 * to do — they came to sit one.
 *
 * So it is a flow. Five screens, one question each, nothing below the fold, and
 * the paper itself as the last screen rather than a panel off to the side. Each
 * step knows whether it can be left, so Next is refused rather than leading
 * somewhere broken, and every step is reachable from the rail at the top once
 * you have been past it.
 *
 * Nothing was dropped to get here. Every choice the long form had is still in
 * it, just not all at once.
 *
 * Presentational on purpose: every value and handler is a prop, which is what
 * lets this be rendered and looked at with made-up data rather than deployed
 * and guessed at.
 */

const STEPS = [
  { key: 'subject', label: 'Subject' },
  { key: 'source', label: 'Source' },
  { key: 'topics', label: 'Topics' },
  { key: 'shape', label: 'Shape' },
  { key: 'sit', label: 'Sit it' },
]

/** A full-width choice. Big enough to press without aiming. */
function Option({ on, disabled, onClick, title, hint, meta }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className="flex w-full items-start gap-4 rounded-[12px] border px-5 py-4 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        borderColor: on ? 'var(--brand)' : 'var(--border-strong)',
        background: on ? 'var(--brand-tint)' : 'transparent',
      }}
    >
      <span
        className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border"
        style={{
          borderColor: on ? 'var(--brand)' : 'var(--border-hover)',
          background: on ? 'var(--brand)' : 'transparent',
          color: '#fff',
        }}
      >
        {on && <IconCheck width={11} height={11} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-medium">{title}</span>
          {meta != null && (
            <span className="shrink-0 text-[12.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
              {meta}
            </span>
          )}
        </span>
        {hint && (
          <span className="mt-1 block text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {hint}
          </span>
        )}
      </span>
    </button>
  )
}

/** A compact row of choices, for the settings that are genuinely small. */
function Chips({ children }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

function Chip({ on, disabled, onClick, children, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      title={title}
      className={`${on ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'} disabled:cursor-not-allowed disabled:opacity-35`}
    >
      {children}
    </button>
  )
}

function Toggle({ on, onClick, label, hint }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className="flex w-full items-start gap-4 rounded-[12px] border px-5 py-4 text-left transition-colors duration-150"
      style={{ borderColor: on ? 'var(--brand)' : 'var(--border-strong)' }}
    >
      <span
        className="relative mt-[2px] h-5 w-9 shrink-0 rounded-full transition-colors duration-150"
        style={{ background: on ? 'var(--brand)' : 'var(--border-strong)' }}
      >
        <span
          className="absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white transition-all duration-150"
          style={{ left: on ? 18 : 3 }}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        {hint && (
          <span className="mt-1 block text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {hint}
          </span>
        )}
      </span>
    </button>
  )
}

function Question({ title, hint, children }) {
  return (
    <div>
      <h2 className="text-[clamp(1.35rem,3vw,1.75rem)] font-semibold leading-tight tracking-[-0.03em]">
        {title}
      </h2>
      {hint && (
        <p className="mt-2.5 max-w-lg text-[14px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </p>
      )}
      <div className="mt-8">{children}</div>
    </div>
  )
}

/**
 * A feature this account does not have, shown rather than hidden.
 *
 * Hiding it means a student never learns the app can do it; a row with a lock
 * and a price is an honest advert and takes the same space.
 */
function UpgradeRow({ label, hint }) {
  return (
    <div className="flex items-start gap-3 py-2 opacity-70">
      <span className="mt-0.5 text-[13px]" style={{ color: 'var(--text-faint)' }}>
        🔒
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-medium">{label}</p>
        <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
          {hint}{' '}
          <a href="/pricing" className="underline underline-offset-2">
            On Basic and above
          </a>
          .
        </p>
      </div>
    </div>
  )
}

export default function TestBuilder({
  subject, subjects, onSubject, freeNote,
  levels, level, onLevel, showLevel, hlCount,
  focusModes, focusMode, onFocusMode,
  topics, selected, onToggleTopic, onSelectAll, perTopicCounts,
  subtopicsByTopic, pickedSubtopics, onToggleSubtopic, openTopic, onOpenTopic, loadingPool,
  unitBySubtopic = {},
  difficulties, difficulty, onDifficulty, difficultyCount,
  questionTypes, qtype, onQtype, qtypeCount,
  orders, order, onOrder,
  lengthMetric, onLengthMetric, lengthPresets, lengthUnit,
  length, onLength, customLength, onCustomLength,
  timed, onTimed, customMinutes, onCustomMinutes, budgetMinutes,
  review, onReview, canTime = true,
  paper, onStart,
}) {
  const [step, setStep] = useState(0)
  const [furthest, setFurthest] = useState(0)

  const canLeave = {
    subject: !!subject,
    source: !!focusMode,
    topics: selected.length > 0,
    shape: true,
    sit: paper.canStart,
  }[STEPS[step].key]

  const go = (n) => {
    const next = Math.max(0, Math.min(STEPS.length - 1, n))
    setStep(next)
    setFurthest((f) => Math.max(f, next))
    // A step change is a new screen, so it starts at the top of one.
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Where you are. Steps you have been past are reachable; ones you have
          not are not, because they would be asking about a paper that does not
          exist yet. */}
      <nav className="mb-10 flex items-center gap-1.5" aria-label="Progress">
        {STEPS.map((s, i) => {
          const done = i < step
          const here = i === step
          const reachable = i <= furthest
          return (
            <button
              key={s.key}
              onClick={() => reachable && go(i)}
              disabled={!reachable}
              aria-current={here ? 'step' : undefined}
              className="group flex flex-1 flex-col gap-2 disabled:cursor-default"
              title={s.label}
            >
              <span
                className="h-[3px] w-full rounded-full transition-colors duration-200"
                style={{
                  background: here
                    ? 'var(--brand)'
                    : done
                      ? 'color-mix(in oklab, var(--brand) 45%, transparent)'
                      : 'var(--border-strong)',
                }}
              />
              <span
                className="text-left text-[11px] font-medium uppercase tracking-[0.1em]"
                style={{ color: here ? 'var(--text)' : 'var(--text-faint)' }}
              >
                {s.label}
              </span>
            </button>
          )
        })}
      </nav>

      {STEPS[step].key === 'subject' && (
        <Question title="Which subject?" hint="One paper, one subject.">
          <div className="flex flex-col gap-2">
            {subjects.map((s) => (
              <Option key={s} on={subject === s} onClick={() => onSubject(s)} title={s} />
            ))}
          </div>
          {freeNote && (
            <p className="mt-4 text-[13px]" style={{ color: 'var(--text-faint)' }}>
              {freeNote}
            </p>
          )}

          {showLevel && (
            <div className="mt-9 border-t pt-7" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[14px] font-medium">Which half of the course?</p>
              <p className="mt-1 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                {`${hlCount} of this subject\u2019s subtopics are the higher level extension.`}
              </p>
              <div className="mt-4">
                <Chips>
                  {levels.map((l) => (
                    <Chip key={l.key} on={level === l.key} onClick={() => onLevel(l.key)} title={l.hint}>
                      {l.label}
                    </Chip>
                  ))}
                </Chips>
              </div>
            </div>
          )}
        </Question>
      )}

      {STEPS[step].key === 'source' && (
        <Question title="What should it draw from?" hint="Anywhere in the subject, or only what needs work.">
          <div className="flex flex-col gap-2">
            {focusModes.map((m) => (
              <Option
                key={m.key}
                on={focusMode === m.key}
                onClick={() => onFocusMode(m.key)}
                title={m.label}
                hint={m.hint}
              />
            ))}
          </div>
        </Question>
      )}

      {STEPS[step].key === 'topics' && (
        <Question title="Which topics?" hint="Open one to pick subtopics. Nothing ticked means all of it.">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[13px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {selected.length} of {topics.length} selected
            </span>
            <button onClick={onSelectAll} className="text-[12.5px] font-medium text-[var(--brand)] hover:underline">
              {topics.length > 0 && selected.length === topics.length ? 'Clear all' : 'Select all'}
            </button>
          </div>

          {loadingPool ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonLine key={i} height={56} />
              ))}
            </div>
          ) : topics.length === 0 ? (
            <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>
              No syllabus loaded for this subject yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {topics.map((topic) => {
                const n = perTopicCounts[topic] || 0
                const isSelected = selected.includes(topic)
                const within = subtopicsByTopic[topic] || {}
                // Guide order, not alphabetical: kinematics comes before
                // momentum in every class and on every paper.
                const names = Object.keys(within).sort(
                  (a, b) =>
                    (unitBySubtopic[a]?.position ?? Number.MAX_SAFE_INTEGER) -
                      (unitBySubtopic[b]?.position ?? Number.MAX_SAFE_INTEGER) ||
                    a.localeCompare(b)
                )
                // The middle level of the syllabus, kept as runs of the same
                // unit so a long topic reads as a few short lists.
                const unitRuns = []
                for (const name of names) {
                  const unit = unitBySubtopic[name]?.unit || null
                  const last = unitRuns[unitRuns.length - 1]
                  if (last && last.unit === unit) last.names.push(name)
                  else unitRuns.push({ unit, code: unitBySubtopic[name]?.code || null, names: [name] })
                }
                const picked = pickedSubtopics[topic] || []
                const isOpen = openTopic === topic

                return (
                  <div
                    key={topic}
                    className="rounded-[12px] border transition-colors duration-150"
                    style={{
                      borderColor: isSelected ? 'var(--brand)' : 'var(--border-strong)',
                      background: isSelected ? 'var(--brand-tint)' : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-4 px-5 py-4">
                      <button
                        onClick={() => onToggleTopic(topic)}
                        aria-pressed={isSelected}
                        className="flex min-w-0 flex-1 items-center gap-4 text-left"
                      >
                        <span
                          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border"
                          style={{
                            borderColor: isSelected ? 'var(--brand)' : 'var(--border-hover)',
                            background: isSelected ? 'var(--brand)' : 'transparent',
                            color: '#fff',
                          }}
                        >
                          {isSelected && <IconCheck width={11} height={11} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[14.5px]">{topic}</span>
                      </button>
                      <span className="shrink-0 text-[12.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                        {picked.length ? `${picked.length}/${names.length}` : n > 0 ? n : '·'}
                      </span>
                      {names.length > 0 && (
                        <button
                          onClick={() => onOpenTopic(isOpen ? null : topic)}
                          aria-expanded={isOpen}
                          aria-label={`${isOpen ? 'Hide' : 'Show'} subtopics in ${topic}`}
                          className="shrink-0"
                          style={{ color: 'var(--text-faint)' }}
                        >
                          <IconChevronRight
                            width={14}
                            height={14}
                            className={`transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                          />
                        </button>
                      )}
                    </div>

                    {isOpen && (
                      <div className="border-t px-5" style={{ borderColor: 'var(--border)' }}>
                        {unitRuns.map(({ unit, code, names: unitNames }) => (
                          <div key={unit || 'ungrouped'}>
                            {unit && (
                              <div className="flex items-baseline gap-2 pt-3">
                                {code && (
                                  <span
                                    className="text-[11px] font-semibold tabular-nums"
                                    style={{ color: 'var(--text-faint)' }}
                                  >
                                    {code}
                                  </span>
                                )}
                                <span className="text-[12.5px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                  {unit}
                                </span>
                              </div>
                            )}
                            <ul className="flex flex-col">
                        {unitNames.map((name) => {
                          const on = picked.includes(name)
                          return (
                            <li key={name}>
                              <button
                                onClick={() => onToggleSubtopic(topic, name)}
                                aria-pressed={on}
                                className="flex w-full items-center gap-4 py-2.5 text-left"
                              >
                                <span
                                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border"
                                  style={{
                                    borderColor: on ? 'var(--brand)' : 'var(--border-hover)',
                                    background: on ? 'var(--brand)' : 'transparent',
                                    color: '#fff',
                                  }}
                                >
                                  {on && <IconCheck width={9} height={9} />}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: 'var(--text-muted)' }}>
                                  {displaySubtopic(name)}
                                </span>
                                <span className="shrink-0 text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                                  {within[name]}
                                </span>
                              </button>
                            </li>
                          )
                        })}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Question>
      )}

      {STEPS[step].key === 'shape' && (
        <Question title="What shape is the paper?" hint="Difficulty, question type, order, length.">
          <div className="flex flex-col gap-8">
            <div>
              <p className="mb-3 text-[14px] font-medium">Heat</p>
              <Chips>
                {difficulties.map((d) => {
                  const n = difficultyCount(d)
                  return (
                    <Chip key={d.key} on={difficulty === d.key} disabled={n === 0} onClick={() => onDifficulty(d.key)}>
                      {d.label}
                      <span className="ml-1.5 tabular-nums opacity-60">{n}</span>
                    </Chip>
                  )
                })}
              </Chips>
            </div>

            <div>
              <p className="mb-3 text-[14px] font-medium">Question type</p>
              <Chips>
                {questionTypes.map((t) => {
                  const n = qtypeCount(t)
                  return (
                    <Chip key={t.key} on={qtype === t.key} disabled={n === 0} onClick={() => onQtype(t.key)} title={t.hint}>
                      {t.label}
                      <span className="ml-1.5 tabular-nums opacity-60">{n}</span>
                    </Chip>
                  )
                })}
              </Chips>
            </div>

            <div>
              <p className="mb-3 text-[14px] font-medium">Order</p>
              <Chips>
                {orders.map((o) => (
                  <Chip key={o.key} on={order === o.key} onClick={() => onOrder(o.key)} title={o.hint}>
                    {o.label}
                  </Chip>
                ))}
              </Chips>
            </div>

            <div>
              <p className="mb-1 text-[14px] font-medium">Length</p>
              <p className="mb-3 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                Counted however you are thinking about it. Same draw either way.
              </p>
              <Chips>
                {[
                  ['questions', 'questions'],
                  ['marks', 'marks'],
                  ['minutes', 'minutes'],
                ].map(([key, label]) => (
                  <Chip key={key} on={lengthMetric === key} onClick={() => onLengthMetric(key)}>
                    by {label}
                  </Chip>
                ))}
              </Chips>
              <div className="mt-2.5">
                <Chips>
                  {lengthPresets[lengthMetric].map((n) => (
                    <Chip key={n} on={!customLength && length === n} onClick={() => onLength(n)}>
                      {n} {lengthUnit[lengthMetric]}
                    </Chip>
                  ))}
                  {/* Not another pill. A number you type is a different kind
                      of thing from a preset you press, and dressing it as one
                      made it read as a button that had lost its label. */}
                  <label
                    className="flex h-8 items-center gap-1.5 rounded-[7px] border px-2.5"
                    style={{ borderColor: 'var(--border-strong)' }}
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customLength}
                      aria-label={`Or type a number of ${lengthMetric}`}
                      placeholder="·"
                      onChange={(e) => onCustomLength(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-9 border-0 bg-transparent p-0 text-center text-[12.5px] tabular-nums outline-none"
                      style={{ color: 'var(--text)' }}
                    />
                    <span className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                      {lengthUnit[lengthMetric]}
                    </span>
                  </label>
                </Chips>
              </div>
            </div>
          </div>
        </Question>
      )}

      {STEPS[step].key === 'sit' && (
        <Question title="How do you want to sit it?" hint="Untimed to learn, timed to rehearse.">
          <div className="flex flex-col gap-3">
            {canTime ? (
              <Toggle
                on={timed}
                onClick={() => onTimed(!timed)}
                label="Exam conditions"
                hint="A countdown and live marks-per-minute pacing."
              />
            ) : (
              <UpgradeRow
                label="Exam conditions"
                hint="A countdown and live marks-per-minute pacing, the way the real paper runs."
              />
            )}
            {timed && (
              <label className="flex flex-wrap items-center gap-2 pl-5">
                <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                  Time limit
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={customMinutes}
                  aria-label="Time limit in minutes"
                  placeholder={String(budgetMinutes)}
                  onChange={(e) => onCustomMinutes(e.target.value.replace(/[^0-9]/g, ''))}
                  className="input control-sm w-[84px] text-center tabular-nums"
                />
                <span className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                  minutes · blank uses {budgetMinutes}, what these questions are worth in real exam time
                </span>
              </label>
            )}
            {/* One switch, stated the way round people think about it.
                Marking as you go is what practice is; exam mode is the thing
                you deliberately turn on. */}
            <Toggle
              on={review === 'exam'}
              onClick={() => onReview(review === 'exam' ? 'practice' : 'exam')}
              label="Exam mode"
              hint="Nothing marked until you finish. No hints."
            />

          </div>

          {/* The paper, once there is one. Last screen rather than a sidebar. */}
          <div className="elev mt-10 rounded-[14px] border p-6" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--text-faint)' }}>
              Your paper
            </p>
            <h3 className="mt-3.5 text-[18px] font-semibold tracking-[-0.02em]">{subject}</h3>
            <p className="mt-1.5 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
              {paper.scopeLabel}
            </p>

            {paper.canStart ? (
              <>
                <dl className="mt-6 flex flex-wrap gap-x-9 gap-y-5">
                  {[
                    ['Questions', paper.actualLength],
                    ['Marks', paper.totalMarks],
                    [timed ? 'Time limit' : 'Est. time', `${paper.estMinutes}m`],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                        {label}
                      </dt>
                      <dd className="mt-1 text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>

                {paper.composition?.length > 0 && (
                  <div className="mt-7">
                    <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                      Spread of heat
                    </p>
                    <div className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full">
                      {paper.composition.map((c) => (
                        <span key={c.key} title={`${c.label}: ${c.count}`} style={{ width: `${c.share * 100}%`, background: c.color }} />
                      ))}
                    </div>
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                      {paper.composition.map((c) => (
                        <li key={c.key} className="flex items-center gap-1.5 text-[11.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                          <span className="h-[7px] w-[7px] rounded-full" style={{ background: c.color }} />
                          {c.label} {c.count}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {paper.short && (
                  <p className="mt-6 text-[12px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                    Only {paper.eligibleCount} question{paper.eligibleCount === 1 ? '' : 's'} match these
                    settings, so the paper will be {paper.actualLength} long. Go back and widen the
                    topics or the heat for more.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-5 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {paper.emptyReason ||
                  'Nothing matches these settings. Go back and try a different source, a wider heat range, or more topics.'}
              </p>
            )}
          </div>
        </Question>
      )}

      {/* Back, where you are, and the one way forward. */}
      <div className="mt-10 flex items-center gap-3 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => go(step - 1)}
          disabled={step === 0}
          className="btn btn-quiet control-md disabled:opacity-40"
        >
          <IconArrowLeft width={15} height={15} />
          Back
        </button>

        <span className="flex-1 text-center text-[12.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
          {step + 1} of {STEPS.length}
        </span>

        {step < STEPS.length - 1 ? (
          <button onClick={() => go(step + 1)} disabled={!canLeave} className="btn btn-solid control-md disabled:opacity-40">
            Next
            <IconArrowRight width={15} height={15} />
          </button>
        ) : (
          <button onClick={onStart} disabled={!paper.canStart} className="btn btn-solid control-lg disabled:opacity-40">
            {timed && <IconClock width={16} height={16} />}
            Start {timed ? 'timed test' : 'test'}
          </button>
        )}
      </div>
    </div>
  )
}
