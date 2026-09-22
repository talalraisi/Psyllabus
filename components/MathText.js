import { Fragment } from 'react'
import { parseMath } from '@/lib/math-render'

/**
 * A question's text, with the formulas in it set properly.
 *
 * Stems arrive as "TC = 100 + 5Q + Q^2" and were being rendered exactly like
 * that — a caret and a two, which on an economics paper is the difference
 * between a formula and a typo. This sets the powers and indices, turns the
 * backslash commands into the characters they mean, and leaves every other
 * character alone.
 *
 * The maths runs are wrapped rather than styled inline so they can be given a
 * face of their own later, and so a real engine can be dropped in behind this
 * component without any caller changing.
 */

function Token({ t }) {
  if (t.kind === 'sup') return <sup className="math-sup">{t.value}</sup>
  if (t.kind === 'sub') return <sub className="math-sub">{t.value}</sub>
  if (t.kind === 'sqrt') {
    return (
      <span className="math-sqrt">
        <span aria-hidden="true">√</span>
        <span className="math-sqrt-body">{t.value}</span>
        <span className="sr-only"> the square root of {t.value} </span>
      </span>
    )
  }
  if (t.kind === 'frac') {
    return (
      <span className="math-frac">
        <span className="math-frac-num">{t.num}</span>
        <span className="math-frac-den">{t.den}</span>
        <span className="sr-only">
          {' '}
          {t.num} over {t.den}{' '}
        </span>
      </span>
    )
  }
  return <>{t.value}</>
}

/**
 * Named MathText, not Math, because a component called Math shadows the
 * global one for the whole module — and the first thing that broke was
 * Math.random() in the shuffle, which resolved to a React component.
 */
export default function MathText({ children, className = '' }) {
  const parts = parseMath(children)
  if (!parts.length) return null
  return (
    <span className={className}>
      {parts.map((part, i) => {
        const inner = part.tokens.map((t, j) => <Token key={j} t={t} />)
        return part.math ? (
          <span key={i} className="math">
            {inner}
          </span>
        ) : (
          <Fragment key={i}>{inner}</Fragment>
        )
      })}
    </span>
  )
}
