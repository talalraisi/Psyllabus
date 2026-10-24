import { Fragment, memo } from 'react'
import MathText from '@/components/MathText'

/**
 * Question text that may hold code: Computer Science stems and contexts.
 *
 * Code arrived as ordinary prose: its indentation collapsed, set in the body
 * font, and run through the maths renderer, which turned an identifier like
 * max_val into "max" with a subscript. Here, in a Computer Science question,
 * each paragraph that reads as code (Java, Python or IB pseudocode) is set as
 * a code block, monospaced, indented as written and coloured by kind:
 * keywords, strings, numbers, comments and calls. Paragraphs of prose around
 * it ("Note: in Java …") stay prose. Every other subject is plain MathText.
 */

const KEYWORDS = new Set(
  (
    // Java
    'abstract boolean break case catch char class continue default do double else extends final finally float for if implements import int interface long new null private protected public return short static super switch this throw throws try void while true false String ' +
    // Python
    'and as def del elif except from global in is lambda None not or pass print range raise True False with yield len ' +
    // IB pseudocode
    'IF THEN ELSE ENDIF END LOOP WHILE UNTIL FROM TO FOR EACH NOT AND OR mod div output input return method class new RETURN OUTPUT INPUT'
  ).split(/\s+/)
)

const CODE_LINE =
  /[{};]\s*$|^\s{2,}\S|^\s*(IF|ELSE|ELSEIF|END|ENDIF|LOOP|WHILE|FOR|def |return\b|output\b|input\b|print\(|public |private |static |class |int |double |String |boolean |for\s*\(|while\s*\(|if\s*\(|else\b|}\s*$)|^\s*[A-Za-z_][\w.[\]]*\s*(=|\+=|-=|\*=|\/=|←|<-)\s*\S/

/** True when most lines of a paragraph look like code rather than sentences. */
export function looksLikeCode(paragraph) {
  const lines = paragraph.split('\n').filter((l) => l.trim())
  if (!lines.length) return false
  // A sentence ends in a full stop and has ordinary words; code rarely does both.
  const prose = lines.filter((l) => /[a-z]{3,}\s+[a-z]{3,}\s+[a-z]{3,}.*[.?!]\s*$/.test(l) && !/[{};]\s*$/.test(l)).length
  const code = lines.filter((l) => CODE_LINE.test(l)).length
  return code / lines.length >= 0.5 && prose / lines.length < 0.5
}

const TOKEN = /(\/\/.*$|#.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)(?=\s*\()|([A-Za-z_]\w*)|(\s+)|([^\sA-Za-z0-9_])/g

function highlight(line) {
  const out = []
  let m
  TOKEN.lastIndex = 0
  while ((m = TOKEN.exec(line))) {
    const [all, comment, str, num, call, word, space] = m
    const cls = comment ? 'code-com' : str ? 'code-str' : num ? 'code-num' : call ? (KEYWORDS.has(call) ? 'code-kw' : 'code-fn') : word ? (KEYWORDS.has(word) ? 'code-kw' : null) : space ? null : 'code-op'
    out.push(cls ? (
      <span key={out.length} className={cls}>
        {all}
      </span>
    ) : (
      <Fragment key={out.length}>{all}</Fragment>
    ))
  }
  return out
}

export const CodeBlock = memo(function CodeBlock({ code }) {
  const lines = code.replace(/\s+$/, '').split('\n')
  // Drop the indentation every line shares, keep the rest.
  const common = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length))
  return (
    <pre className="code-block my-3 overflow-x-auto rounded-[12px] border px-4 py-3 text-[13.5px] leading-[1.65]" style={{ borderColor: 'var(--border-strong)' }}>
      <code>
        {lines.map((l, i) => (
          <span key={i} className="block min-h-[1em] whitespace-pre">
            {highlight(l.slice(common))}
          </span>
        ))}
      </code>
    </pre>
  )
})

/**
 * Prose in a Computer Science question: names like max_val and calls like
 * max_val([3, 9, 4]) are code, not maths (the maths renderer would put "val"
 * in a subscript), so they are set inline as code; the rest is MathText.
 */
const INLINE = /\b[A-Za-z_]\w*_\w*(?:\([^()\n]*\))?|\b[A-Za-z_]\w*\([^()\n]*\)/g

function Prose({ text }) {
  const out = []
  let last = 0
  let m
  const re = new RegExp(INLINE.source, 'g')
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<MathText key={out.length}>{text.slice(last, m.index)}</MathText>)
    out.push(
      <code key={out.length} className="code-inline">
        {m[0]}
      </code>
    )
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(<MathText key={out.length}>{text.slice(last)}</MathText>)
  return out
}

/** Text that may contain code; `subject` decides whether to look for it. */
export default function CodeText({ text, subject = '' }) {
  const src = String(text ?? '')
  if (!/^Computer Science/.test(subject)) return <MathText>{src}</MathText>
  const paragraphs = src.split(/\n\s*\n/)
  if (!paragraphs.some(looksLikeCode)) return <Prose text={src} />
  return (
    <>
      {paragraphs.map((p, i) =>
        looksLikeCode(p) ? (
          <CodeBlock key={i} code={p} />
        ) : (
          <span key={i} className="block [&:not(:first-child)]:mt-3">
            <Prose text={p.trim()} />
          </span>
        )
      )}
    </>
  )
}
