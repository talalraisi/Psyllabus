/**
 * A calculator that does not phone anywhere.
 *
 * Students sit these subjects with a GDC on the desk, and the app kept sending
 * them out to a browser tab to work something out, which is also the tab with
 * everything else in it. So the arithmetic happens here.
 *
 * Written rather than installed: a parser for the subset an exam actually uses
 * is a couple of hundred lines, and it is one less dependency loading on a
 * page a student is timed on. It is deliberately strict — no `eval`, no
 * implicit globals, nothing that runs anything but numbers.
 *
 * Shunting-yard into RPN, then evaluate. Degrees or radians is a setting
 * rather than a guess, because sin(30) means two different things in a physics
 * paper and a maths paper.
 */

const FUNCTIONS = {
  sin: (x, deg) => Math.sin(deg ? (x * Math.PI) / 180 : x),
  cos: (x, deg) => Math.cos(deg ? (x * Math.PI) / 180 : x),
  tan: (x, deg) => Math.tan(deg ? (x * Math.PI) / 180 : x),
  asin: (x, deg) => (deg ? (Math.asin(x) * 180) / Math.PI : Math.asin(x)),
  acos: (x, deg) => (deg ? (Math.acos(x) * 180) / Math.PI : Math.acos(x)),
  atan: (x, deg) => (deg ? (Math.atan(x) * 180) / Math.PI : Math.atan(x)),
  sinh: (x) => Math.sinh(x),
  cosh: (x) => Math.cosh(x),
  tanh: (x) => Math.tanh(x),
  ln: (x) => Math.log(x),
  log: (x) => Math.log10(x),
  sqrt: (x) => Math.sqrt(x),
  cbrt: (x) => Math.cbrt(x),
  abs: (x) => Math.abs(x),
  exp: (x) => Math.exp(x),
  round: (x) => Math.round(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
}

const CONSTANTS = { pi: Math.PI, π: Math.PI, e: Math.E }

const OPERATORS = {
  '+': { precedence: 1, associativity: 'left', apply: (a, b) => a + b },
  '-': { precedence: 1, associativity: 'left', apply: (a, b) => a - b },
  '*': { precedence: 2, associativity: 'left', apply: (a, b) => a * b },
  '/': { precedence: 2, associativity: 'left', apply: (a, b) => a / b },
  '%': { precedence: 2, associativity: 'left', apply: (a, b) => a % b },
  '^': { precedence: 4, associativity: 'right', apply: (a, b) => Math.pow(a, b) },
}

/** Where unary minus sits: below ^ (4), above × (2). */
const UNARY_PRECEDENCE = 3

export class CalcError extends Error {}

function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) throw new CalcError('Factorial needs a whole number')
  if (n > 170) return Infinity
  let out = 1
  for (let i = 2; i <= n; i++) out *= i
  return out
}

/** Text to tokens. Unary minus becomes its own token so 3 * -2 works. */
export function tokenize(input) {
  const src = String(input).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/√/g, 'sqrt')
  const tokens = []
  let i = 0

  const previous = () => tokens[tokens.length - 1]
  const impliesMultiplication = () => {
    const p = previous()
    return p && (p.type === 'number' || p.type === 'constant' || p.type === 'rparen' || p.type === 'postfix')
  }

  while (i < src.length) {
    const ch = src[i]

    if (ch === ' ' || ch === ',' || ch === '\t') {
      i++
      continue
    }

    if (/[0-9.]/.test(ch)) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j++
      const text = src.slice(i, j)
      if ((text.match(/\./g) || []).length > 1) throw new CalcError(`"${text}" is not a number`)
      if (impliesMultiplication()) tokens.push({ type: 'operator', value: '*' })
      tokens.push({ type: 'number', value: parseFloat(text) })
      i = j
      continue
    }

    if (/[a-zA-Zπ]/.test(ch)) {
      let j = i
      while (j < src.length && /[a-zA-Z0-9π]/.test(src[j])) j++
      const name = src.slice(i, j)
      const lower = name.toLowerCase()
      if (impliesMultiplication()) tokens.push({ type: 'operator', value: '*' })
      if (FUNCTIONS[lower]) tokens.push({ type: 'function', value: lower })
      else if (lower in CONSTANTS || name in CONSTANTS) tokens.push({ type: 'constant', value: name in CONSTANTS ? name : lower })
      else if (lower === 'x') tokens.push({ type: 'variable', value: 'x' })
      else if (lower === 'ans') tokens.push({ type: 'variable', value: 'ans' })
      else throw new CalcError(`I do not know "${name}"`)
      i = j
      continue
    }

    if (ch === '(') {
      if (impliesMultiplication()) tokens.push({ type: 'operator', value: '*' })
      tokens.push({ type: 'lparen' })
      i++
      continue
    }

    if (ch === ')') {
      tokens.push({ type: 'rparen' })
      i++
      continue
    }

    if (ch === '!') {
      tokens.push({ type: 'postfix', value: '!' })
      i++
      continue
    }

    if (OPERATORS[ch]) {
      // Minus is unary when nothing that could be a left operand precedes it.
      const p = previous()
      const unary =
        ch === '-' && (!p || p.type === 'operator' || p.type === 'lparen' || p.type === 'unary')
      tokens.push(unary ? { type: 'unary', value: '-' } : { type: 'operator', value: ch })
      i++
      continue
    }

    throw new CalcError(`"${ch}" does not belong here`)
  }

  return tokens
}

/** Tokens to reverse Polish notation. */
export function toRPN(tokens) {
  const output = []
  const stack = []

  for (const token of tokens) {
    if (token.type === 'number' || token.type === 'constant' || token.type === 'variable') {
      output.push(token)
    } else if (token.type === 'function') {
      stack.push(token)
    } else if (token.type === 'postfix') {
      output.push(token)
    } else if (token.type === 'unary') {
      stack.push(token)
    } else if (token.type === 'operator') {
      const op = OPERATORS[token.value]
      while (stack.length) {
        const top = stack[stack.length - 1]
        if (top.type === 'function') {
          output.push(stack.pop())
          continue
        }
        // Unary minus binds tighter than × but looser than ^, so -3^2 is -9,
        // the way it is written on every mark scheme.
        const topPrecedence =
          top.type === 'unary' ? UNARY_PRECEDENCE : top.type === 'operator' ? OPERATORS[top.value].precedence : null
        if (topPrecedence == null) break
        const shouldPop =
          topPrecedence > op.precedence ||
          (topPrecedence === op.precedence && op.associativity === 'left')
        if (!shouldPop) break
        output.push(stack.pop())
      }
      stack.push(token)
    } else if (token.type === 'lparen') {
      stack.push(token)
    } else if (token.type === 'rparen') {
      let matched = false
      while (stack.length) {
        const top = stack.pop()
        if (top.type === 'lparen') {
          matched = true
          break
        }
        output.push(top)
      }
      if (!matched) throw new CalcError('A bracket is not closed')
      const top = stack[stack.length - 1]
      if (top && (top.type === 'function' || top.type === 'unary')) output.push(stack.pop())
    }
  }

  while (stack.length) {
    const top = stack.pop()
    if (top.type === 'lparen') throw new CalcError('A bracket is not closed')
    output.push(top)
  }

  return output
}

/**
 * Evaluate an expression.
 *
 * `x` is bound for graphing, `ans` for the previous result. Both are plain
 * numbers; there is no way to define anything else, which is the point.
 */
export function evaluate(input, { degrees = false, ans = 0, x = 0 } = {}) {
  const rpn = toRPN(tokenize(input))
  const stack = []

  const pop = () => {
    if (!stack.length) throw new CalcError('That expression is incomplete')
    return stack.pop()
  }

  for (const token of rpn) {
    switch (token.type) {
      case 'number':
        stack.push(token.value)
        break
      case 'constant':
        stack.push(CONSTANTS[token.value])
        break
      case 'variable':
        stack.push(token.value === 'x' ? x : ans)
        break
      case 'unary':
        stack.push(-pop())
        break
      case 'postfix':
        stack.push(factorial(pop()))
        break
      case 'function':
        stack.push(FUNCTIONS[token.value](pop(), degrees))
        break
      case 'operator': {
        const b = pop()
        const a = pop()
        stack.push(OPERATORS[token.value].apply(a, b))
        break
      }
      default:
        throw new CalcError('That expression is incomplete')
    }
  }

  if (stack.length !== 1) throw new CalcError('That expression is incomplete')
  const result = stack[0]
  if (typeof result !== 'number' || Number.isNaN(result)) throw new CalcError('That has no answer')
  return result
}

/** Does this parse at all? Used to decide whether to draw a graph. */
export function isPlottable(input) {
  try {
    evaluate(input, { x: 1 })
    return true
  } catch {
    return false
  }
}

/** A number the way a student would write it down. */
export function formatResult(value, significantFigures = 10) {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞'
  if (value === 0) return '0'
  const magnitude = Math.abs(value)
  if (magnitude >= 1e10 || magnitude < 1e-6) {
    return value
      .toExponential(6)
      .replace(/\.?0+e/, 'e')
      .replace('e+', 'e')
  }
  const rounded = parseFloat(value.toPrecision(significantFigures))
  return String(rounded)
}
