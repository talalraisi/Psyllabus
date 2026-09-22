/**
 * The maths parser, against what the bank actually contains.
 *
 * Two rules matter more than coverage: a formula it understands has to come
 * out right, and a string it does not understand has to come out unchanged.
 * A half-rendered formula is worse than a plain one.
 */
import { parseMath, hasMath } from '../lib/math-render.js'

let failed = 0
const check = (name, ok) => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
}

/** Flatten back to a readable string, so expectations stay legible. */
const flat = (input) =>
  parseMath(input)
    .flatMap((p) => p.tokens)
    .map((t) =>
      t.kind === 'text' ? t.value
      : t.kind === 'sup' ? `^(${t.value})`
      : t.kind === 'sub' ? `_(${t.value})`
      : t.kind === 'frac' ? `(${t.num})/(${t.den})`
      : t.kind === 'sqrt' ? `sqrt(${t.value})`
      : ''
    )
    .join('')

// Real stems from the bank.
check('a bare power becomes a superscript', flat('TC = 100 + 5Q + Q^2') === 'TC = 100 + 5Q + Q²')
check('two-digit powers too', flat('x^10') === 'x¹⁰')
check('braced powers', flat('e^{-kt}').includes('^(-kt)'))
check('subscripts', flat('v_1 = 3').startsWith('v_(1) = 3'))
check('chemistry indices', flat('CO_2 and H_2O') === 'CO_(2) and H_(2)O')

// Delimited LaTeX, which 49 questions already use.
check('dollar delimiters are maths', hasMath('The value $x^2 + 1$ is positive'))
check('and render inside', flat('The value $x^2$ here') === 'The value x² here')
check('paren delimiters', hasMath('Given \\(a^2\\) and more'))

check('fractions', flat('$\\frac{dy}{dx}$') === '(dy)/(dx)')
check('roots', flat('$\\sqrt{2}$') === 'sqrt(2)')
check('symbols become characters', flat('$5 \\times 3 \\leq 20$') === '5 × 3 ≤ 20')
check('greek', flat('$\\theta$ and $\\Delta$') === 'θ and Δ')

// The important half: leave alone what it does not understand.
const plain = 'A shop raises the price of a jacket from $40 to $50. What is the increase?'
check('two prices are not a maths span', flat(plain) === plain)
check('and it is not treated as maths', !hasMath(plain))

const prose = 'Explain how monetary policy affects aggregate demand.'
check('ordinary prose is untouched', flat(prose) === prose && !hasMath(prose))

check('an unknown command survives', flat('$\\weird{x}$').includes('\\weird'))
check('an unclosed brace does not eat the string', flat('x^{2').includes('2'))
check('empty and null are safe', flat('') === '' && flat(null) === '' && flat(undefined) === '')

// Units, which look like maths but are not.
check('units with a caret still work', flat('12 m s^-1') === '12 m s⁻¹')

console.log(failed ? `\n${failed} failing` : '\nformulas render and everything else is left alone')
process.exit(failed ? 1 : 0)
