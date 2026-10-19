// node scripts/calc-test.mjs
import { evaluate, formatResult } from '../lib/calc.js'

const cases = [
  ['2 + 3 × 4', 14],
  ['-3^2', -9],
  ['(-3)^2', 9],
  ['2(3 + 1)', 8],
  ['200 × 15%', 30],
  ['50%', 0.5],
  ['3 × 10^8', 3e8],
  ['6.63 × 10^-34', 6.63e-34],
  ['5!', 120],
  ['sqrt(16) + cbrt(27)', 7],
  ['10^(2)', 100],
  ['exp(1)', Math.E],
  ['ans × 2', 14, { ans: 7 }],
  ['ans−1', 6, { ans: 7 }],
  ['sin(30)', 0.5, { degrees: true }],
  ['asin(0.5)', 30, { degrees: true }],
  ['acos(0)', Math.PI / 2],
  ['2x + 1', 7, { x: 3 }],
  ['12 ÷ 4', 3],
  ['sin⁻¹(0.5)', 30, { degrees: true }],
  ['√(16', 4],
  ['2 × (3 + (1', 8],
  ['∛(27)', 3],
  ['x²', 9, { x: 3 }],
  ['x²3', 27, { x: 3 }],
  ['2³', 8],
]

let failed = 0
for (const [expr, want, opts] of cases) {
  let got
  try {
    got = evaluate(expr, opts)
  } catch (e) {
    got = `error: ${e.message}`
  }
  const ok = typeof got === 'number' && Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want))
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${expr} = ${got}${ok ? '' : ` (want ${want})`}`)
}

const f = formatResult(evaluate('6.63 × 10^-34'))
console.log(`${f === '6.63e-34' ? 'ok  ' : 'FAIL'} format ${f}`)
if (f !== '6.63e-34') failed++

console.log(failed ? `\n${failed} failed` : '\nall passed')
process.exit(failed ? 1 : 0)
