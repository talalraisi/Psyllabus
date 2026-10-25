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

/** A PDF's text, with lines joined into paragraphs where the gap says so. */
async function pdfText(file) {
  const pdfjs = await import('pdfjs-dist')
  // Served from /public so no bundler has to know how to ship a worker.
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages = []
  for (let n = 1; n <= Math.min(doc.numPages, 40); n++) {
    const page = await doc.getPage(n)
    const { items } = await page.getTextContent()
    let out = ''
    let lastY = null
    let lastH = 12
    for (const it of items) {
      if (!('str' in it)) continue
      const y = it.transform?.[5]
      if (lastY != null && y != null && Math.abs(lastY - y) > 1) {
        // A gap of more than about a line and a half is a new paragraph;
        // anything less is the same paragraph wrapping onto the next line.
        out += Math.abs(lastY - y) > lastH * 1.7 ? '\n\n' : out.endsWith('-') ? '' : ' '
      }
      out += it.str
      if (y != null) lastY = y
      if (it.height) lastH = it.height
    }
    pages.push(out.replace(/[ \t]+/g, ' ').trim())
  }
  return pages.filter(Boolean).join('\n\n')
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
