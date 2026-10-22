'use client'

import { useMemo, useState } from 'react'
import MathText from '@/components/MathText'
import { IconCheck, IconClose } from '@/components/Icons'
import { gradeShortAnswer } from '@/lib/grading'
import { checkWritten } from '@/lib/flashcard-modes'

/**
 * The things a lesson asks a student to do, beyond picking an option.
 *
 * All of them work by tapping, because dragging is fiddly on a phone and
 * impossible with a keyboard: tap a word to fill the next gap, tap items in
 * the order they go, tap an item and then the group it belongs to, tap a term
 * and then its match. Each reports once, when the student checks, with
 * whether it was right; the frame shows the feedback.
 *
 * Shuffling is seeded by the content, so a frame shows the same order every
 * time it renders and the server and browser agree.
 */

function seeded(list, seedText) {
  let h = 0
  for (const ch of seedText) h = (h * 31 + ch.charCodeAt(0)) | 0
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) | 0
    const j = Math.abs(h) % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  // Never hand back the answer already in order.
  if (out.length > 1 && out.every((x, i) => x === list[i])) [out[0], out[1]] = [out[1], out[0]]
  return out
}

const norm = (s) => String(s ?? '').trim().toLowerCase()

function Chip({ children, on, done, good, bad, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-[12px] border px-3 py-2 text-left text-[14.5px] transition-[background,border-color,transform] active:scale-[0.98] disabled:cursor-default"
      style={{
        borderColor: good ? 'var(--status-proficient)' : bad ? 'var(--status-weak)' : on ? 'var(--brand)' : 'var(--border-strong)',
        background: good ? 'color-mix(in oklab, var(--status-proficient) 12%, var(--surface))' : on ? 'var(--brand-tint)' : done ? 'var(--surface-sunken)' : 'var(--surface)',
        opacity: done && !good && !bad ? 0.55 : 1,
      }}
    >
      <MathText>{children}</MathText>
    </button>
  )
}

function CheckButton({ ready, onClick, label = 'Check' }) {
  return (
    <button type="button" onClick={onClick} disabled={!ready} className="btn btn-solid control-md mt-4 disabled:opacity-40">
      {label}
    </button>
  )
}

function Mcq({ c, answered, onAnswer }) {
  const [pick, setPick] = useState(null)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[15.5px] leading-relaxed">
        <MathText>{c.prompt}</MathText>
      </p>
      {c.options.map((o) => (
        <Chip
          key={o.id}
          on={pick === o.id}
          good={answered && o.id === c.answer}
          bad={answered && pick === o.id && o.id !== c.answer}
          disabled={answered}
          onClick={() => {
            setPick(o.id)
            onAnswer(o.id === c.answer, o.id !== c.answer ? o.why : '')
          }}
        >
          {o.text}
        </Chip>
      ))}
    </div>
  )
}

function TrueFalse({ c, answered, onAnswer }) {
  const [pick, setPick] = useState(null)
  return (
    <div>
      <p className="text-[16px] font-medium leading-relaxed">
        <MathText>{c.statement}</MathText>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[true, false].map((v) => (
          <Chip
            key={String(v)}
            on={pick === v}
            good={answered && v === c.answer}
            bad={answered && pick === v && v !== c.answer}
            disabled={answered}
            onClick={() => {
              setPick(v)
              onAnswer(v === c.answer)
            }}
          >
            {v ? 'True' : 'False'}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function Match({ c, answered, onAnswer }) {
  const rights = useMemo(() => seeded(c.pairs.map((p) => p.right), c.prompt + 'r'), [c])
  const [left, setLeft] = useState(null)
  const [made, setMade] = useState({}) // left index → right text
  const used = new Set(Object.values(made))
  const done = Object.keys(made).length === c.pairs.length
  return (
    <div>
      <p className="text-[15.5px] leading-relaxed">
        <MathText>{c.prompt}</MathText>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
          {c.pairs.map((p, i) => (
            <Chip
              key={i}
              on={left === i}
              done={made[i] != null && !answered}
              good={answered && made[i] === p.right}
              bad={answered && made[i] !== p.right}
              disabled={answered}
              onClick={() => {
                if (made[i] != null) {
                  const next = { ...made }
                  delete next[i]
                  setMade(next)
                }
                setLeft(i)
              }}
            >
              {made[i] != null ? `${p.left} → ${made[i]}` : p.left}
            </Chip>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {rights.map((r) => (
            <Chip key={r} done={used.has(r)} disabled={answered || used.has(r) || left == null} onClick={() => {
              setMade({ ...made, [left]: r })
              setLeft(null)
            }}>
              {r}
            </Chip>
          ))}
        </div>
      </div>
      {!answered && <CheckButton ready={done} onClick={() => onAnswer(c.pairs.every((p, i) => made[i] === p.right))} />}
    </div>
  )
}

function Order({ c, answered, onAnswer }) {
  const shuffled = useMemo(() => seeded(c.items, c.prompt), [c])
  const [seq, setSeq] = useState([])
  return (
    <div>
      <p className="text-[15.5px] leading-relaxed">
        <MathText>{c.prompt}</MathText>
      </p>
      <p className="mt-1 text-[13px]" style={{ color: 'var(--text-faint)' }}>
        Tap them in order. Tap a placed one to take it back.
      </p>
      <ol className="mt-3 flex flex-col gap-2">
        {seq.map((item, i) => (
          <li key={item} className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>
              {i + 1}
            </span>
            <Chip good={answered && c.items[i] === item} bad={answered && c.items[i] !== item} disabled={answered} onClick={() => setSeq(seq.filter((x) => x !== item))}>
              {item}
            </Chip>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        {shuffled.filter((x) => !seq.includes(x)).map((item) => (
          <Chip key={item} disabled={answered} onClick={() => setSeq([...seq, item])}>
            {item}
          </Chip>
        ))}
      </div>
      {answered && seq.some((x, i) => c.items[i] !== x) && (
        <p className="mt-3 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
          The order: {c.items.join(' → ')}
        </p>
      )}
      {!answered && <CheckButton ready={seq.length === c.items.length} onClick={() => onAnswer(seq.every((x, i) => c.items[i] === x))} />}
    </div>
  )
}

function Sort({ c, answered, onAnswer }) {
  const all = useMemo(() => seeded(c.groups.flatMap((g) => g.items), c.prompt), [c])
  const home = useMemo(() => Object.fromEntries(c.groups.flatMap((g) => g.items.map((it) => [it, g.name]))), [c])
  const [placed, setPlaced] = useState({})
  const [pick, setPick] = useState(null)
  return (
    <div>
      <p className="text-[15.5px] leading-relaxed">
        <MathText>{c.prompt}</MathText>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {all.filter((x) => !placed[x]).map((item) => (
          <Chip key={item} on={pick === item} disabled={answered} onClick={() => setPick(item)}>
            {item}
          </Chip>
        ))}
      </div>
      <div className={`mt-3 grid gap-2 ${c.groups.length === 3 ? 'sm:grid-cols-3' : 'grid-cols-2'}`}>
        {c.groups.map((g) => (
          <button
            key={g.name}
            type="button"
            disabled={answered || !pick}
            onClick={() => {
              setPlaced({ ...placed, [pick]: g.name })
              setPick(null)
            }}
            className="min-h-[96px] rounded-[14px] border-2 border-dashed p-3 text-left transition-colors disabled:cursor-default"
            style={{ borderColor: pick ? 'var(--brand)' : 'var(--border-strong)' }}
          >
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>
              {g.name}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(placed)
                .filter(([, grp]) => grp === g.name)
                .map(([item]) => (
                  <span
                    key={item}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      if (answered) return
                      e.stopPropagation()
                      const next = { ...placed }
                      delete next[item]
                      setPlaced(next)
                    }}
                    className="rounded-full px-2.5 py-1 text-[13px]"
                    style={{
                      background: answered ? (home[item] === g.name ? 'color-mix(in oklab, var(--status-proficient) 18%, transparent)' : 'color-mix(in oklab, var(--status-weak) 18%, transparent)') : 'var(--surface-sunken)',
                    }}
                  >
                    {item}
                  </span>
                ))}
            </div>
          </button>
        ))}
      </div>
      {!answered && <CheckButton ready={Object.keys(placed).length === all.length} onClick={() => onAnswer(all.every((x) => placed[x] === home[x]))} />}
    </div>
  )
}

function Gap({ c, answered, onAnswer }) {
  const bank = useMemo(() => seeded(c.bank, c.text), [c])
  const [fill, setFill] = useState([])
  const parts = String(c.text).split('___')
  return (
    <div>
      <p className="text-[15.5px] leading-relaxed">
        <MathText>{c.prompt}</MathText>
      </p>
      <p className="mt-3 text-[16px] leading-[2.1]">
        {parts.map((t, i) => (
          <span key={i}>
            <MathText>{t}</MathText>
            {i < parts.length - 1 && (
              <button
                type="button"
                disabled={answered || !fill[i]}
                onClick={() => setFill(fill.filter((_, k) => k !== i))}
                className="mx-1 inline-block min-w-[84px] rounded-[8px] border-b-2 px-2 text-center font-semibold"
                style={{
                  borderColor: answered ? (norm(fill[i]) === norm(c.answers[i]) ? 'var(--status-proficient)' : 'var(--status-weak)') : 'var(--brand)',
                  background: 'var(--surface-sunken)',
                }}
              >
                {fill[i] || ' '}
              </button>
            )}
          </span>
        ))}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {bank.map((w, i) => (
          <Chip key={`${w}${i}`} done={fill.includes(w)} disabled={answered || fill.includes(w) || fill.length >= c.answers.length} onClick={() => setFill([...fill, w])}>
            {w}
          </Chip>
        ))}
      </div>
      {answered && fill.some((w, i) => norm(w) !== norm(c.answers[i])) && (
        <p className="mt-3 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
          The words: {c.answers.join(', ')}
        </p>
      )}
      {!answered && <CheckButton ready={fill.length === c.answers.length} onClick={() => onAnswer(c.answers.every((a, i) => norm(fill[i]) === norm(a)))} />}
    </div>
  )
}

function Typed({ c, answered, onAnswer }) {
  const [value, setValue] = useState('')
  const right = () => {
    if (c.kind === 'numeric') return gradeShortAnswer({ accepted_answers: c.accepted || [String(c.answer)], answer_kind: 'numeric' }, value).correct
    const r = checkWritten(value, (c.accepted || []).join(' / '))
    return r.correct || r.close
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim() && !answered) onAnswer(right())
      }}
    >
      <p className="text-[15.5px] leading-relaxed">
        <MathText>{c.prompt}</MathText>
      </p>
      <div className="mt-3 flex gap-2">
        <input value={value} onChange={(e) => setValue(e.target.value)} disabled={answered} placeholder={c.unit ? `Answer in ${c.unit}` : 'Your answer'} autoComplete="off" className="input h-11 flex-1 text-[16px] sm:text-[15px]" />
        {!answered && (
          <button type="submit" disabled={!value.trim()} className="btn btn-solid control-lg disabled:opacity-40">
            Check
          </button>
        )}
      </div>
      {answered && (
        <p className="mt-2 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
          Answer: <MathText>{String(c.answer ?? (c.accepted || [])[0] ?? '')}</MathText>
          {c.unit ? ` ${c.unit}` : ''}
        </p>
      )}
    </form>
  )
}

const KINDS = { mcq: Mcq, truefalse: TrueFalse, match: Match, order: Order, sort: Sort, gap: Gap, numeric: Typed, short: Typed }

/** One interaction with its verdict and teaching feedback underneath. */
export default function Interaction({ c, result, onResult }) {
  const Kind = KINDS[c?.kind]
  if (!Kind) return null
  const answered = result != null
  return (
    <div>
      <Kind c={c} answered={answered} onAnswer={(correct, why) => onResult({ correct, why })} />
      {answered && (
        <div className={`verdict-in mt-4 rounded-[14px] border-l-4 px-4 py-3 ${result.correct ? 'lift-once' : 'card-wrong'}`} style={{ borderColor: result.correct ? 'var(--status-proficient)' : 'var(--status-weak)', background: 'var(--surface-sunken)' }}>
          <p className="flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: result.correct ? 'var(--status-proficient)' : 'var(--status-weak)' }}>
            {result.correct ? <IconCheck width={14} height={14} /> : <IconClose width={13} height={13} />}
            {result.correct ? 'Yes' : 'Not quite'}
          </p>
          <p className="mt-1 text-[14px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            <MathText>{result.correct ? c.right : result.why || c.wrong}</MathText>
          </p>
        </div>
      )}
    </div>
  )
}
