import { Fragment } from 'react'
import katex from 'katex'
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
 * Anything between $…$ is real LaTeX (\frac12, \left( … \right), \dots)
 * and is set by KaTeX. The home-made tokeniser could not follow those and
 * printed them raw, which on a binomial-expansion question left the student
 * reading "-\frac12". Bare runs in prose (Q^2, v_max) still go through the
 * tokeniser, because they were never written as LaTeX.
 */

const cache = new Map()
/** KaTeX's HTML for one span, or null when it cannot set it (the tokens are shown instead). */
function tex(src) {
  if (cache.has(src)) return cache.get(src)
  let html = null
  try {
    // trust stays false: no \href, \url or \includegraphics from a question.
    // Fractions, sums and integrals at full size: inline they shrink to a
    // size nobody can read on a phone.
    const body = /\\(d?frac|sum|int|prod|lim)(?![a-zA-Z])/.test(src) ? `\\displaystyle ${src}` : src
    html = katex.renderToString(body, { throwOnError: true, strict: 'ignore', output: 'html' })
  } catch {
    html = null
  }
  if (cache.size > 2000) cache.clear()
  cache.set(src, html)
  return html
}

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
        const html = part.tex ? tex(part.tex) : null
        if (html) return <span key={i} className="math math-tex" dangerouslySetInnerHTML={{ __html: html }} />
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
