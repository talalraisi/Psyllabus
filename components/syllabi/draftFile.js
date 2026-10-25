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

    lines.forEach((l, i) => {
      const prev = lines[i - 1]
      const brokeHere =
        i === 0
          ? !open
          : prev.y - l.y > usual * 1.45 || (prev.x1 < left + (right - left) * 0.8 && ENDS_SENTENCE.test(prev.text)) || /^[•▪◦-]\s/.test(l.text)
      if (brokeHere || !paragraphs.length) paragraphs.push(l.text)
      else {
        const last = paragraphs.length - 1
        // A word split at the end of a line ("santan-da" / "ves") joins up.
        paragraphs[last] += paragraphs[last].endsWith('-') ? l.text : ` ${l.text}`
      }
    })
    const last = lines.at(-1)
    open = !ENDS_SENTENCE.test(last.text) && last.x1 > left + (right - left) * 0.8
  }
  return paragraphs.join('\n\n')
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
  if (/\.(txt|md)$/.test(name) || file.type.startsWith('text/')) return (await file.text()).trim()
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    let text = ''
    try {
      text = await pdfText(file)
    } catch {
      throw new DraftFileProblem('That PDF could not be opened. Try saving it again, or paste the text in.')
    }
    if (text.replace(/\s/g, '').length < 40) throw new DraftFileProblem('That PDF has no text in it, only pictures of pages (a scan or a photo). Paste the text in, or type it.')
    return text
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
