/**
 * The text of a draft, from the file a student opens or drops.
 *
 * The draft studio marks up the essay itself (every comment sits on a span of
 * its words), so a file has to become text in the editor, not an attachment.
 * Text files are read as they are; a PDF's text is pulled out with pdf.js and
 * a Word file's with mammoth, both in the browser and loaded only when a file
 * of that kind arrives. A scanned PDF has no text to pull, and says so rather
 * than opening empty.
 */

export class DraftFileProblem extends Error {}

export const DRAFT_ACCEPT = '.txt,.md,text/plain,.pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const MAX_BYTES = 15 * 1024 * 1024

const PAGE_NUMBER = /^(page\s*)?\d{1,3}(\s*(of|\/)\s*\d{1,3})?$/i

/**
 * True when text has been copied out of a PDF and still has the PDF's line
 * breaks in it: most lines end mid-sentence at about the same length, often
 * with a blank line after every one.
 */
export function looksWrapped(text) {
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 6) return false
  const long = lines.filter((l) => l.length > 40)
  const midSentence = long.filter((l) => !ENDS_SENTENCE.test(l)).length
  return long.length >= lines.length * 0.5 && midSentence >= long.length * 0.5
}

/* A bibliography is a list, not prose: each entry is its own line. */
const BIB_HEADING = /^(bibliography|references|works cited|sources|reference list)\s*:?$/i
/** Where an entry starts: "Surname, A." or a name or title with its year in brackets close by ("MEAM. (2020", "1NB. (2020"). */
const ENTRY_START = (l) => /^[A-Z][A-Za-z'’-]+, (?:[A-Z][a-z]*\.?|&)/.test(l) || (/^[A-Z0-9]/.test(l) && !/^\d+[/,]/.test(l) && /^.{0,80}?\((?:\d{4}|n\.d\.)/.test(l))
/** How a line continues the one before: no space inside a URL broken across lines, or a word split with a hyphen. */
function joinLine(prev, next) {
  const lastWord = prev.split(' ').at(-1)
  if (/^https?:\/\//.test(lastWord) && !/\s/.test(next)) return prev + next
  return prev.endsWith('-') ? prev + next : `${prev} ${next}`
}

/**
 * Hard-wrapped text (copied out of a PDF) back into paragraphs.
 *
 * Copying from a PDF keeps a line break at the end of every line, and from a
 * double-spaced essay a blank line after every one, so the draft arrived as a
 * column of one-line paragraphs with the page numbers in between. Without the
 * page's geometry, the text itself has to say where paragraphs end: a line
 * that stops well short of the usual length after a full stop ends one; a
 * short line with no full stop before a capital is a heading on its own; a
 * number alone on a line is a page number and goes; everything else joins.
 */
export function reflow(text) {
  const lines = String(text)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l && !PAGE_NUMBER.test(l))
  if (!lines.length) return ''
  const lengths = lines.map((l) => l.length).filter((n) => n > 40).sort((a, b) => a - b)
  const usual = lengths.length ? lengths[Math.floor(lengths.length * 0.6)] : 70
  const short = (l) => l.length < usual * 0.78
  const heading = (l, next) => short(l) && !ENDS_SENTENCE.test(l) && !/[,;]$/.test(l) && (!next || /^[A-Z0-9“"(]/.test(next))

  const out = []
  let bib = false // past the Bibliography heading: one entry per paragraph
  lines.forEach((l, i) => {
    const prev = lines[i - 1]
    const startsNew = bib
      ? ENTRY_START(l)
      : i === 0 ||
        (short(prev) && ENDS_SENTENCE.test(prev)) ||
        heading(prev, l) ||
        heading(l, lines[i + 1]) ||
        BIB_HEADING.test(l) ||
        /^[•▪◦]\s|^-\s|^\d+[.)]\s/.test(l)
    if (startsNew || !out.length) out.push(l)
    else out[out.length - 1] = joinLine(out[out.length - 1], l)
    if (BIB_HEADING.test(l)) {
      bib = true
      out.push('') // the heading stands alone; the first entry starts afresh
    }
  })
  return out.filter(Boolean).join('\n\n')
}

/** The lines of one page, top to bottom: { text, y, x0, x1 }. */
function linesOf(items) {
  const lines = []
  for (const it of items) {
    if (!('str' in it) || !it.str) continue
    const x = it.transform[4]
    const y = it.transform[5]
    const w = it.width || 0
    let line = lines.find((l) => Math.abs(l.y - y) < 2.5)
    if (!line) lines.push((line = { y, parts: [] }))
    line.parts.push({ x, w, s: it.str })
  }
  return lines
    .map((l) => {
      l.parts.sort((a, b) => a.x - b.x)
      let text = ''
      let end = null
      for (const p of l.parts) {
        // A space where the words do not touch and none was written.
        if (end != null && p.x - end > 1.5 && !/\s$/.test(text) && !/^\s/.test(p.s)) text += ' '
        text += p.s
        end = p.x + p.w
      }
      return { text: text.replace(/\s+/g, ' ').trim(), y: l.y, x0: l.parts[0].x, x1: end }
    })
    .filter((l) => l.text)
    .sort((a, b) => b.y - a.y)
}

const ENDS_SENTENCE = /[.!?:;"”’)\]]$/

/**
 * A PDF's text as paragraphs.
 *
 * A PDF holds lines, not paragraphs. An IB essay is double-spaced, so the gap
 * between every pair of lines looked like a paragraph break and each line came
 * out on its own. Here each page's ordinary line spacing is measured first; a
 * new paragraph starts only at a gap clearly bigger than that, or where a line
 * stops well short of the margin after a full stop. Page numbers standing
 * alone at the top or bottom of a page are left out, and a paragraph that runs
 * over a page break is joined back up.
 */
async function pdfText(file) {
  const pdfjs = await import('pdfjs-dist')
  // Served from /public so no bundler has to know how to ship a worker.
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const paragraphs = []
  let open = false // the last paragraph may carry on onto this page
  let bib = false // past the Bibliography heading: one entry per paragraph
  for (let n = 1; n <= Math.min(doc.numPages, 60); n++) {
    const page = await doc.getPage(n)
    let lines = linesOf((await page.getTextContent()).items)
    const pageNumber = (l) => /^(page\s*)?\d{1,3}(\s*(of|\/)\s*\d{1,3})?$/i.test(l.text)
    if (lines.length && pageNumber(lines[0])) lines = lines.slice(1)
    if (lines.length && pageNumber(lines.at(-1))) lines = lines.slice(0, -1)
    if (!lines.length) continue

    const gaps = lines.slice(1).map((l, i) => lines[i].y - l.y).filter((g) => g > 0).sort((a, b) => a - b)
    const usual = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 14
    const right = Math.max(...lines.map((l) => l.x1))
    const left = Math.min(...lines.map((l) => l.x0))

    // In a bibliography, entries with a hanging indent start at the margin
    // and carry on indented; without one, the entry's own shape says where it starts.
    const hanging = lines.some((l) => l.x0 > left + 12)
    lines.forEach((l, i) => {
      const prev = lines[i - 1]
      const brokeHere = bib
        ? hanging
          ? l.x0 < left + 6
          : ENTRY_START(l.text)
        : i === 0
          ? !open
          : prev.y - l.y > usual * 1.45 || (prev.x1 < left + (right - left) * 0.8 && ENDS_SENTENCE.test(prev.text)) || BIB_HEADING.test(l.text) || /^[•▪◦-]\s/.test(l.text)
      if (brokeHere || !paragraphs.length || paragraphs.at(-1) === null) {
        if (paragraphs.at(-1) === null) paragraphs.pop()
        paragraphs.push(l.text)
      } else {
        const last = paragraphs.length - 1
        // A word split at the end of a line ("santan-da" / "ves") or a URL joins up.
        paragraphs[last] = joinLine(paragraphs[last], l.text)
      }
      if (BIB_HEADING.test(l.text)) {
        bib = true
        paragraphs.push(null) // the heading stands alone
      }
    })
    const last = lines.at(-1)
    open = !ENDS_SENTENCE.test(last.text) && last.x1 > left + (right - left) * 0.8
  }
  return paragraphs.filter(Boolean).join('\n\n')
}

/** True when a PDF has pictures as well as text: quoted lyrics or diagrams that were pasted in as images. */
export async function pdfHasImages(file) {
  try {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    for (let n = 1; n <= Math.min(doc.numPages, 60); n++) {
      const ops = await (await doc.getPage(n)).getOperatorList()
      if (ops.fnArray.some((f) => f === pdfjs.OPS.paintImageXObject || f === pdfjs.OPS.paintInlineImageXObject || f === pdfjs.OPS.paintJpegXObject)) return true
    }
  } catch {
    return false
  }
  return false
}

async function docxText(file) {
  const mammoth = (await import('mammoth/mammoth.browser.js')).default
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  return value.replace(/\n{3,}/g, '\n\n').trim()
}

export async function readDraft(file) {
  const name = file.name.toLowerCase()
  if (file.size > MAX_BYTES) throw new DraftFileProblem('That file is over 15 MB. Open just the essay.')
  if (/\.(txt|md)$/.test(name) || file.type.startsWith('text/')) {
    const text = (await file.text()).trim()
    return looksWrapped(text) ? reflow(text) : text
  }
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    let text = ''
    try {
      text = await pdfText(file)
    } catch {
      throw new DraftFileProblem('That PDF could not be opened. Try saving it again, or paste the text in.')
    }
    if (text.replace(/\s/g, '').length < 40) throw new DraftFileProblem('That PDF has no text in it, only pictures of pages (a scan or a photo). Paste the text in, or type it.')
    // If the page layout gave no clue to the paragraphs, the text itself can.
    return looksWrapped(text) ? reflow(text) : text
  }
  if (name.endsWith('.docx')) {
    try {
      return await docxText(file)
    } catch {
      throw new DraftFileProblem('That Word file could not be opened. Try saving it again, or paste the text in.')
    }
  }
  if (name.endsWith('.doc')) throw new DraftFileProblem('Old .doc files cannot be opened here. Save it as .docx or PDF, or paste the text in.')
  throw new DraftFileProblem('Open a PDF, a Word file (.docx) or a text file, or paste your draft in.')
}
