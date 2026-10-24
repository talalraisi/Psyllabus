/**
 * Maths, parsed into something a browser can set properly.
 *
 * Questions arrive as a mix: some carry LaTeX in $…$, some write TC = 100 +
 * 5Q + Q^2 as flat text, a few use unicode. All three currently render as
 * whatever the font does with a caret, which on a physics or economics paper
 * is the difference between a formula and a typo.
 *
 * This is deliberately not a LaTeX engine. It covers what an IB paper
 * actually contains — powers, indices, the Greek letters that carry meaning,
 * roots, fractions and the operators — and leaves anything it does not
 * recognise exactly as it found it, because a half-rendered formula is worse
 * than an unrendered one. When KaTeX can be installed it should replace the
 * token renderer; this parser is the part that would stay either way.
 *
 * Returns a flat list of tokens so the React component stays presentational
 * and this stays testable without a DOM.
 */

/** \name → the character it means. Only ones that turn up in IB papers. */
const SYMBOLS = {
  times: '×', div: '÷', cdot: '·', pm: '±', mp: '∓',
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈',
  infty: '∞', propto: '∝', therefore: '∴', degree: '°',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε',
  theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ',
  Sigma: 'Σ', tau: 'τ', phi: 'φ', omega: 'ω', Omega: 'Ω',
  rightarrow: '→', to: '→', leftarrow: '←', leftrightarrow: '↔',
  int: '∫', sum: '∑', partial: '∂', nabla: '∇', in: '∈', cup: '∪', cap: '∩',
  circ: '°', percent: '%', ldots: '…', cdots: '⋯', dots: '…',
  eta: 'η', kappa: 'κ', nu: 'ν', xi: 'ξ', psi: 'ψ', chi: 'χ', zeta: 'ζ', iota: 'ι',
  varepsilon: 'ε', varphi: 'φ', vartheta: 'θ', ell: 'ℓ', hbar: 'ℏ',
  Gamma: 'Γ', Theta: 'Θ', Lambda: 'Λ', Pi: 'Π', Phi: 'Φ', Psi: 'Ψ',
  Rightarrow: '⇒', Leftarrow: '⇐', iff: '⇔', implies: '⇒', mapsto: '↦',
  sim: '∼', equiv: '≡', perp: '⊥', parallel: '∥', angle: '∠', triangle: '△',
  ast: '∗', lt: '<', gt: '>', neg: '¬', forall: '∀', exists: '∃', emptyset: '∅',
  subset: '⊂', subseteq: '⊆', notin: '∉', setminus: '∖', prime: '′', star: '⋆',
}

/* Named functions are set upright, as words, with the space LaTeX would give. */
const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'exp', 'lim', 'max', 'min', 'det', 'mod', 'gcd'])

/* Commands that only change spacing or sizing: dropped, or a space. */
const SPACING = { ',': ' ', ';': ' ', ':': ' ', '!': '', ' ': ' ', quad: ' ', qquad: '  ', displaystyle: '', textstyle: '', left: '', right: '', big: '', Big: '', limits: '' }

/* Commands whose braced argument is plain text. */
const TEXTLIKE = new Set(['text', 'mathrm', 'mathbf', 'mathit', 'textrm', 'textbf', 'operatorname', 'mbox'])

/* Accents, as combining characters on the letter they sit over. */
const ACCENTS = { vec: '\u20d7', bar: '\u0304', overline: '\u0305', hat: '\u0302', dot: '\u0307', ddot: '\u0308', tilde: '\u0303' }

const BLACKBOARD = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ' }

/** Superscript and subscript digits, so simple powers need no markup at all. */
const SUP = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻','n':'ⁿ' }

/**
 * One run of maths, as tokens.
 *
 * kind: 'text' | 'sup' | 'sub' | 'frac' | 'sqrt'
 */
function tokenise(src) {
  const out = []
  let text = ''
  let i = 0
  const flush = () => {
    if (text) out.push({ kind: 'text', value: text })
    text = ''
  }

  /**
   * Whatever follows ^ or _: a braced group, or the run that obviously
   * belongs to it. x^10 is ten, not one followed by a stray zero, and
   * m s^-1 is a negative index rather than a minus sign and a 1.
   */
  const group = () => {
    // ^\circ is a degree sign; ^\prime a prime: a command as the whole group.
    if (src[i] === '\\') {
      const cmd = /^\\([a-zA-Z]+)/.exec(src.slice(i))
      if (cmd && SYMBOLS[cmd[1]]) {
        i += cmd[0].length
        return SYMBOLS[cmd[1]]
      }
    }
    if (src[i] === '{') {
      const close = src.indexOf('}', i)
      if (close === -1) return null
      const inner = src.slice(i + 1, close)
      i = close + 1
      return inner
    }
    // Digits or letters, never both: H_2O is water, not H subscript "2O",
    // while v_max is one word. Which it is, is decided by the first character.
    const run = /^(?:[+-]?\d+|[A-Za-z]+)/.exec(src.slice(i))
    if (run) {
      i += run[0].length
      return run[0]
    }
    if (i < src.length) return src[i++]
    return null
  }

  while (i < src.length) {
    const ch = src[i]

    if (ch === '^' || ch === '_') {
      i++
      const g = group()
      if (g == null) {
        text += ch
        continue
      }
      // A short run of digits sets perfectly well as unicode, which keeps the
      // line height honest and copies as text.
      if (ch === '^' && [...g].every((c) => SUP[c])) {
        text += [...g].map((c) => SUP[c]).join('')
        continue
      }
      // A degree or a prime sits on the line as its own character.
      if (ch === '^' && (g === '°' || g === '′')) {
        text += g
        continue
      }
      flush()
      out.push({ kind: ch === '^' ? 'sup' : 'sub', value: g })
      continue
    }

    if (ch === '\\') {
      // \, \; \! \  and \% \$ \{ \}: one punctuation character after the slash.
      const punct = src[i + 1]
      if (punct != null && Object.prototype.hasOwnProperty.call(SPACING, punct)) {
        text += SPACING[punct]
        i += 2
        continue
      }
      if (punct === '%' || punct === '$' || punct === '{' || punct === '}' || punct === '#' || punct === '&') {
        text += punct
        i += 2
        continue
      }
      const name = /^\\([a-zA-Z]+)/.exec(src.slice(i))
      if (name) {
        const word = name[1]
        if (FUNCTIONS.has(word)) {
          // Fs\cos\theta is F s cos θ: a word set straight after a letter needs its space.
          if (/[A-Za-z0-9)]/.test(src[i - 1] || '') && !/\s$/.test(text)) text += ' '
          i += name[0].length
          text += word + (/^\s*[\^_]/.test(src.slice(i)) ? '' : ' ')
          while (src[i] === ' ') i++
          continue
        }
        if (Object.prototype.hasOwnProperty.call(SPACING, word)) {
          i += name[0].length
          text += SPACING[word]
          continue
        }
        if (TEXTLIKE.has(word) && src[i + name[0].length] === '{') {
          i += name[0].length
          const inner = group()
          if (inner != null) {
            text += inner
            continue
          }
        }
        if (word === 'mathbb' && src[i + name[0].length] === '{') {
          i += name[0].length
          const inner = group()
          if (inner != null) {
            text += [...inner].map((c) => BLACKBOARD[c] || c).join('')
            continue
          }
        }
        if (ACCENTS[word]) {
          const save = i
          i += name[0].length
          const inner = group()
          if (inner != null && inner.length >= 1) {
            text += inner + JSON.parse(`"${ACCENTS[word]}"`)
            continue
          }
          i = save
        }
        if (word === 'frac') {
          i += name[0].length
          const a = group()
          const b = group()
          if (a != null && b != null) {
            flush()
            out.push({ kind: 'frac', num: a, den: b })
            continue
          }
          text += '\\frac'
          continue
        }
        if (word === 'sqrt') {
          i += name[0].length
          const a = group()
          if (a != null) {
            flush()
            out.push({ kind: 'sqrt', value: a })
            continue
          }
          text += '\\sqrt'
          continue
        }
        if (SYMBOLS[word]) {
          i += name[0].length
          text += SYMBOLS[word]
          continue
        }
      }
      // Not something we know: keep the backslash rather than eat it.
      text += ch
      i++
      continue
    }

    text += ch
    i++
  }
  flush()
  return out
}

/**
 * Split a string into prose and maths.
 *
 * `$…$` and `\(…\)` are explicit. Beyond that, a bare run like `Q^2` or
 * `v_max` is treated as maths too, because most of the bank was written
 * before anyone was asked for delimiters and those questions still have to
 * read correctly.
 */
export function parseMath(input) {
  const src = String(input ?? '')
  if (!src) return []

  /**
   * A dollar sign is money far more often than it is a delimiter.
   *
   * "raises the price from $40 to $50" contains a perfectly good $…$ match
   * whose contents are "40 to ", and treating that as a formula turns a
   * question about percentages into a rendering bug. So a delimited span
   * only counts as maths if it contains something only maths contains: a
   * power, an index, or a backslash command.
   */
  const MATHS_INSIDE = /[\^_\\]/
  // $s$ and $W = Fs$ are maths too. Money spans give themselves away: they
  // touch a space at an edge ("from $40 to $50" captures "40 to "), or start
  // with a number and then carry words.
  const looksLikeMaths = (body) =>
    MATHS_INSIDE.test(body) || (!/^\s|\s$/.test(body) && !(/^\d/.test(body) && /\s[a-z]{2,}/i.test(body)) && body.length <= 60)

  const parts = []
  const re = /\$([^$]+)\$|\\\(([\s\S]+?)\\\)/g
  let last = 0
  let m
  while ((m = re.exec(src))) {
    const body = m[1] ?? m[2]
    const isParen = m[2] != null
    if (!isParen && !looksLikeMaths(body)) continue
    if (m.index > last) parts.push({ math: false, value: src.slice(last, m.index) })
    parts.push({ math: true, value: body })
    last = m.index + m[0].length
  }
  if (last < src.length) parts.push({ math: false, value: src.slice(last) })

  // Undelimited powers and indices in the prose: Q^2, x_1, CO_2.
  const BARE = /[A-Za-z0-9)\]]\s*[\^_]\s*(?:\{[^}]*\}|[A-Za-z0-9+\-]+)/g

  const out = []
  for (const part of parts) {
    if (part.math) {
      // The source too: a delimited span is real LaTeX and is set by KaTeX
      // (components/MathText.js); the tokens are the fallback.
      out.push({ math: true, tex: part.value, tokens: tokenise(part.value) })
      continue
    }
    let cursor = 0
    let hit
    BARE.lastIndex = 0
    while ((hit = BARE.exec(part.value))) {
      if (hit.index > cursor) {
        out.push({ math: false, tokens: [{ kind: 'text', value: part.value.slice(cursor, hit.index) }] })
      }
      out.push({ math: true, tokens: tokenise(hit[0]) })
      cursor = hit.index + hit[0].length
    }
    if (cursor < part.value.length) {
      out.push({ math: false, tokens: [{ kind: 'text', value: part.value.slice(cursor) }] })
    }
  }
  return out
}

/** True when there is anything worth rendering as maths. */
export function hasMath(input) {
  return parseMath(input).some((p) => p.math)
}
