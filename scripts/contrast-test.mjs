/**
 * Every colour pair the eye actually has to read, checked against WCAG AA.
 *
 * The token comments in globals.css carry specific promises — "5.1:1 on
 * white", "#6b7280 sat at 4.48" — which means somebody measured these once
 * and then had to trust that nobody moved them. Repainting the whole palette
 * is exactly the change that quietly breaks them.
 *
 *   node scripts/contrast-test.mjs
 */

import fs from 'node:fs'
import path from 'node:path'

const css = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8')

/** The declarations inside one selector's first block. */
function block(selector) {
  const i = css.indexOf(selector)
  if (i === -1) throw new Error(`no ${selector}`)
  const open = css.indexOf('{', i)
  let depth = 0
  let end = open
  for (let j = open; j < css.length; j++) {
    if (css[j] === '{') depth++
    else if (css[j] === '}') {
      depth--
      if (depth === 0) {
        end = j
        break
      }
    }
  }
  const out = {}
  for (const m of css.slice(open, end).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out[m[1]] = m[2].trim()
  }
  return out
}

const srgb = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)

function parse(value, vars, onto = null) {
  let v = String(value).trim()
  // One level of var() indirection is all these tokens use.
  const ref = v.match(/^var\((--[a-z0-9-]+)\)$/i)
  if (ref) v = vars[ref[1]]
  if (!v) return null

  let rgb = null
  let alpha = 1
  let m = v.match(/^#([0-9a-f]{6})$/i)
  if (m) {
    const n = parseInt(m[1], 16)
    rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  m = v.match(/^#([0-9a-f]{3})$/i)
  if (m) rgb = [...m[1]].map((c) => parseInt(c + c, 16))
  m = v.match(/^rgba?\(([^)]+)\)$/i)
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number)
    rgb = p.slice(0, 3)
    if (p.length > 3) alpha = p[3]
  }
  m = v.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i)
  if (m) rgb = oklchToRgb(+m[1], +m[2], +m[3])
  if (!rgb) return null

  // A translucent colour is only readable against what is behind it.
  if (alpha < 1 && onto) rgb = rgb.map((c, i) => c * alpha + onto[i] * (1 - alpha))
  return rgb
}

function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return lin.map((c) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
    return Math.max(0, Math.min(255, Math.round(v * 255)))
  })
}

const lum = ([r, g, b]) =>
  0.2126 * srgb(r / 255) + 0.7152 * srgb(g / 255) + 0.0722 * srgb(b / 255)

const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** fg on bg, and the floor it has to clear. Large text is allowed 3:1. */
const PAIRS = [
  ['--text', '--bg', 4.5],
  ['--text', '--surface', 4.5],
  ['--text-body', '--surface', 4.5],
  ['--text-body', '--bg', 4.5],
  ['--text-muted', '--surface', 4.5],
  ['--text-muted', '--bg', 4.5],
  ['--text-muted', '--surface-sunken', 4.5],
  ['--text-faint', '--surface', 4.5],
  ['--text-faint', '--bg', 4.5],
  ['--text-faint', '--surface-sunken', 4.5],
  ['--brand', '--surface', 4.5],
  ['--brand', '--bg', 4.5],
  ['--danger', '--surface', 4.5],
  // Status colours label their own rows, and carry meaning by hue as well.
  ['--status-weak', '--surface', 3],
  ['--status-developing', '--surface', 3],
  ['--status-proficient', '--surface', 3],
  ['--status-mastered', '--surface', 3],
  ['--status-fading', '--surface', 3],
]

let failed = 0
for (const [label, selector] of [
  ['LIGHT', ':root {'],
  ['DARK', "[data-theme='dark'] {"],
]) {
  const vars = { ...block(':root {'), ...block(selector) }
  console.log(`\n== ${label}`)

  for (const [fg, bg, floor] of PAIRS) {
    const bgRgb = parse(vars[bg], vars)
    const fgRgb = parse(vars[fg], vars, bgRgb)
    if (!fgRgb || !bgRgb) {
      console.log(`  SKIP  ${fg} on ${bg}`)
      continue
    }
    const r = ratio(fgRgb, bgRgb)
    const ok = r >= floor
    if (!ok) failed++
    console.log(
      `  ${ok ? 'PASS' : 'FAIL'}  ${r.toFixed(2)}:1  (needs ${floor})  ${fg} on ${bg}`
    )
  }

  // White on a solid brand button is its own question.
  const solid = parse(vars['--brand-solid'], vars)
  if (solid) {
    const r = ratio([255, 255, 255], solid)
    const ok = r >= 4.5
    if (!ok) failed++
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${r.toFixed(2)}:1  (needs 4.5)  white on --brand-solid`)
  }
}

console.log(failed ? `\n${failed} pair(s) below the floor` : '\nevery pair clears AA')
process.exit(failed ? 1 : 0)
