'use client'

import { IconClock, IconCheck, IconChevronRight } from '@/components/Icons'
import { SkeletonLine } from '@/components/PageShell'
import { displaySubtopic } from '@/lib/progress'

/**
 * Building a paper, rather than filling in a form.
 *
 * The last version was a column of numbered steps with the summary parked in a
 * sidebar. Everything worked and none of it felt like assembling anything: the
 * choices were a questionnaire, and the thing being made was a box of statistics
 * off to one side.
 *
 * So the paper is the subject of the screen now. It sits on the right at the
 * size of an actual front sheet, it fills in as you choose, and it shows what
 * is in it — the spread of heat across the questions that would be drawn — not
 * just how many there are. The choices are on the left in three quiet bands,
 * without numbers, because nobody needs to be told that a form has an order.
 *
 * It is presentational on purpose. Every value and every handler comes in as a
 * prop, which is what lets the design be rendered and looked at with made-up
 * data instead of being deployed and guessed at.
 */

function Band({ title, hint, children, className = '' }) {
  return (
    <section className={`border-t pt-6 ${className}`} style={{ borderColor: 'var(--border)' }}>
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--text-faint)' }}>
        {title}
      </h2>
      {hint && (
        <p className="mt-1.5 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  )
}

/** A labelled row of choices. The label sits beside them on a wide screen. */
function Row({ label, children, className = '' }) {
  return (
    <div className={`grid gap-2 sm:grid-cols-[8rem_1fr] sm:items-baseline sm:gap-5 ${className}`}>
      <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function Choice({ on, disabled, onClick, children, title }) {
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
    <button onClick={onClick} role="switch" aria-checked={on} className="flex items-start gap-3 text-left">
      <span
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-150"
        style={{ background: on ? 'var(--brand)' : 'var(--border-strong)' }}
      >
        <span
          className="absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white transition-all duration-150"
          style={{ left: on ? 18 : 3 }}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
            {hint}
          </span>
        )}
      </span>
    </button>
  )
}

export default function TestBuilder({
  // what goes in it
  subject,
  subjects,
  onSubject,
  freeNote,
  levels,
  level,
  onLevel,
  showLevel,
  hlCount,
  focusModes,
  focusMode,
  onFocusMode,
  // topics and subtopics
  topics,
  selected,
  onToggleTopic,
  onSelectAll,
  perTopicCounts,
  subtopicsByTopic,
  pickedSubtopics,
  onToggleSubtopic,
  openTopic,
  onOpenTopic,
  loadingPool,
  // shape
  difficulties,
  difficulty,
  onDifficulty,
  difficultyCount,
  questionTypes,
  qtype,
  onQtype,
  qtypeCount,
  orders,
  order,
  onOrder,
  lengthMetric,
  onLengthMetric,
  lengthPresets,
  lengthUnit,
  length,
  onLength,
  customLength,
  onCustomLength,
  // conditions
  timed,
  onTimed,
  customMinutes,
  onCustomMinutes,
  budgetMinutes,
  review,
  onReview,
  hintsAllowed,
  onHintsAllowed,
  // the paper itself
  paper,
  onStart,
}) {
  const allSelected = topics.length > 0 && selected.length === topics.length

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_21rem] lg:gap-14">
      <div className="flex flex-col gap-10">
        <Band title="What goes in it" hint="The subject, which half of the course, and where the questions come from.">
          <div className="flex flex-col gap-5">
            <Row label="Subject">
              <select
                value={subject}
                onChange={(e) => onSubject(e.target.value)}
                aria-label="Subject"
                className="field max-w-sm"
              >
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Row>
            {freeNote && (
              <p className="text-[12.5px] sm:pl-[8.6rem]" style={{ color: 'var(--text-faint)' }}>
                {freeNote}
              </p>
            )}

            {showLevel && (
              <Row label="Level">
                {levels.map((l) => (
                  <Choice key={l.key} on={level === l.key} onClick={() => onLevel(l.key)} title={l.hint}>
                    {l.label}
                  </Choice>
                ))}
                <span className="self-center text-[12px]" style={{ color: 'var(--text-faint)' }}>
                  {hlCount} HL subtopics
                </span>
              </Row>
            )}

            <Row label="Draw from">
              {focusModes.map((m) => (
                <Choice key={m.key} on={focusMode === m.key} onClick={() => onFocusMode(m.key)} title={m.hint}>
                  {m.label}
                </Choice>
              ))}
            </Row>
          </div>
        </Band>

        <Band
          title="Topics"
          hint="Open one to pick individual subtopics. A topic with nothing ticked inside it means all of it."
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {selected.length} of {topics.length} selected
            </span>
            <button
              onClick={onSelectAll}
              className="text-[12.5px] font-medium text-[var(--brand)] hover:underline"
            >
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          </div>

          {loadingPool ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonLine key={i} height={44} />
              ))}
            </div>
          ) : topics.length === 0 ? (
            <p className="text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
              No syllabus loaded for this subject yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {topics.map((topic) => {
                const n = perTopicCounts[topic] || 0
                const isSelected = selected.includes(topic)
                const within = subtopicsByTopic[topic] || {}
                const names = Object.keys(within).sort()
                const picked = pickedSubtopics[topic] || []
                const isOpen = openTopic === topic

                return (
                  <div
                    key={topic}
                    className="rounded-[10px] border transition-colors duration-150"
                    style={{
                      borderColor: isSelected ? 'var(--brand)' : 'var(--border-strong)',
                      background: isSelected ? 'var(--brand-tint)' : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button
                        onClick={() => onToggleTopic(topic)}
                        aria-pressed={isSelected}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border"
                          style={{
                            borderColor: isSelected ? 'var(--brand)' : 'var(--border-hover)',
                            background: isSelected ? 'var(--brand)' : 'transparent',
                            color: '#fff',
                          }}
                        >
                          {isSelected && <IconCheck width={11} height={11} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13.5px]">{topic}</span>
                      </button>

                      <span className="shrink-0 text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                        {picked.length ? `${picked.length}/${names.length}` : n > 0 ? n : '—'}
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
                            width={13}
                            height={13}
                            className={`transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                          />
                        </button>
                      )}
                    </div>

                    {isOpen && (
                      <ul className="flex flex-col border-t px-4" style={{ borderColor: 'var(--border)' }}>
                        {names.map((name) => {
                          const on = picked.includes(name)
                          return (
                            <li key={name}>
                              <button
                                onClick={() => onToggleSubtopic(topic, name)}
                                aria-pressed={on}
                                className="flex w-full items-center gap-3 py-2 text-left"
                              >
                                <span
                                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border"
                                  style={{
                                    borderColor: on ? 'var(--brand)' : 'var(--border-hover)',
                                    background: on ? 'var(--brand)' : 'transparent',
                                    color: '#fff',
                                  }}
                                >
                                  {on && <IconCheck width={9} height={9} />}
                                </span>
                                <span
                                  className="min-w-0 flex-1 truncate text-[12.5px]"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  {displaySubtopic(name)}
                                </span>
                                <span
                                  className="shrink-0 text-[11.5px] tabular-nums"
                                  style={{ color: 'var(--text-faint)' }}
                                >
                                  {within[name]}
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Band>

        <Band title="Shape of the paper" hint="How hard, what kind, what order, and how long.">
          <div className="flex flex-col gap-5">
            <Row label="Heat">
              {difficulties.map((d) => {
                const n = difficultyCount(d)
                return (
                  <Choice
                    key={d.key}
                    on={difficulty === d.key}
                    disabled={n === 0}
                    onClick={() => onDifficulty(d.key)}
                  >
                    {d.label}
                    <span className="ml-1.5 tabular-nums opacity-60">{n}</span>
                  </Choice>
                )
              })}
            </Row>

            <Row label="Question type">
              {questionTypes.map((t) => {
                const n = qtypeCount(t)
                return (
                  <Choice key={t.key} on={qtype === t.key} disabled={n === 0} onClick={() => onQtype(t.key)} title={t.hint}>
                    {t.label}
                    <span className="ml-1.5 tabular-nums opacity-60">{n}</span>
                  </Choice>
                )
              })}
            </Row>

            <Row label="Order">
              {orders.map((o) => (
                <Choice key={o.key} on={order === o.key} onClick={() => onOrder(o.key)} title={o.hint}>
                  {o.label}
                </Choice>
              ))}
            </Row>

            <Row label="Length">
              <span className="flex w-full flex-wrap gap-2">
                {[
                  ['questions', 'questions'],
                  ['marks', 'marks'],
                  ['minutes', 'minutes'],
                ].map(([key, label]) => (
                  <Choice key={key} on={lengthMetric === key} onClick={() => onLengthMetric(key)}>
                    by {label}
                  </Choice>
                ))}
              </span>
              <span className="flex w-full flex-wrap gap-2">
                {lengthPresets[lengthMetric].map((n) => (
                  <Choice key={n} on={!customLength && length === n} onClick={() => onLength(n)}>
                    {n} {lengthUnit[lengthMetric]}
                  </Choice>
                ))}
                <input
                  type="text"
                  inputMode="numeric"
                  value={customLength}
                  aria-label={`Or type a number of ${lengthMetric}`}
                  placeholder="or type"
                  onChange={(e) => onCustomLength(e.target.value.replace(/[^0-9]/g, ''))}
                  className="input control-sm w-[92px] text-center tabular-nums"
                />
              </span>
            </Row>
          </div>
        </Band>

        <Band title="How you sit it" hint="Untimed to learn, timed to rehearse the real thing.">
          <div className="flex flex-col gap-5">
            <Toggle
              on={timed}
              onClick={() => onTimed(!timed)}
              label="Exam conditions"
              hint="A countdown, and live marks-per-minute pacing against what the paper needs."
            />

            {timed && (
              <label className="flex flex-wrap items-center gap-2 sm:pl-12">
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
                  minutes · blank uses {budgetMinutes}, what these questions are worth in real exam
                  time
                </span>
              </label>
            )}

            <Toggle
              on={review === 'practice'}
              onClick={() => onReview(review === 'practice' ? 'exam' : 'practice')}
              label="Mark each question as I answer it"
              hint="Off is exam mode: everything is held back until the end."
            />

            <Toggle
              on={!hintsAllowed}
              onClick={() => onHintsAllowed(!hintsAllowed)}
              label="No hints"
              hint="Hides the hint button, the way the real paper does."
            />
          </div>
        </Band>
      </div>

      {/* The paper. Front sheet rather than a box of statistics. */}
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div
          className="rounded-[14px] border p-6"
          style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: 'var(--text-faint)' }}
          >
            Your paper
          </p>

          <h2 className="mt-4 text-[19px] font-semibold leading-snug tracking-[-0.02em]">{subject}</h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {paper.scopeLabel}
          </p>

          <div className="my-6 border-t" style={{ borderColor: 'var(--border)' }} />

          {paper.canStart ? (
            <>
              <dl className="flex flex-wrap gap-x-8 gap-y-5">
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

              {/* What is actually in it. A count says how big the paper is;
                  this says what sitting it will feel like. */}
              {paper.composition?.length > 0 && (
                <div className="mt-7">
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    Spread of heat
                  </p>
                  <div className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full">
                    {paper.composition.map((c) => (
                      <span
                        key={c.key}
                        title={`${c.label}: ${c.count}`}
                        style={{ width: `${c.share * 100}%`, background: c.color }}
                      />
                    ))}
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                    {paper.composition.map((c) => (
                      <li
                        key={c.key}
                        className="flex items-center gap-1.5 text-[11.5px] tabular-nums"
                        style={{ color: 'var(--text-faint)' }}
                      >
                        <span className="h-[7px] w-[7px] rounded-full" style={{ background: c.color }} />
                        {c.label} {c.count}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {paper.short && (
                <p className="mt-6 text-[12px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                  Only {paper.eligibleCount} question{paper.eligibleCount === 1 ? '' : 's'} match
                  these settings, so the paper will be {paper.actualLength} long. Widen the topics
                  or the heat for more.
                </p>
              )}

              <button onClick={onStart} className="btn btn-solid control-lg mt-7 w-full">
                {timed && <IconClock width={17} height={17} />}
                Start {timed ? 'timed test' : 'test'}
              </button>
            </>
          ) : (
            <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {selected.length === 0
                ? 'Select at least one topic and the paper will build itself here.'
                : 'Nothing matches these settings. Try a different source, a wider heat range, or more topics.'}
            </p>
          )}
        </div>
      </aside>
    </div>
  )
}
