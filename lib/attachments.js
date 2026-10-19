/**
 * Files a student attaches to a Syllabi message: photos, PDFs and plain text.
 *
 * Each one is checked by what it actually is (its first bytes), not by what
 * its name or the browser claims, then held to size limits that keep both
 * the request under the host's body limit and the cost of one message small.
 * The browser shrinks photos before sending; these limits are what holds if
 * it did not.
 */

export const LIMITS = {
  files: 3, // per message
  imageBytes: 1.5 * 1024 * 1024,
  pdfBytes: 3 * 1024 * 1024,
  pdfPages: 20, // across every PDF in the message
  textBytes: 200 * 1024,
  textChars: 30000,
  totalBytes: 4 * 1024 * 1024, // the host refuses bodies over 4.5MB
}

export class AttachmentError extends Error {}

const kib = (n) => `${Math.round(n / 1024)} KB`

/** What the bytes are, from their signature. */
function sniff(buf) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 6 && buf.toString('ascii', 0, 4) === 'GIF8') return 'image/gif'
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  if (buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf'
  return null
}

/** Roughly how many pages a PDF has: page objects, not the page tree. */
export function pdfPages(buf) {
  const s = buf.toString('latin1')
  return (s.match(/\/Type\s*\/Page(?![s\w])/g) || []).length
}

/** Plain text, if these bytes are readable UTF-8 with no binary in them. */
function asText(buf) {
  const text = buf.toString('utf8')
  if (text.includes('�') || /[\x00-\x08\x0E-\x1F]/.test(text.slice(0, 4000))) return null
  return text
}

/**
 * Check the attachments and turn them into content blocks for the model.
 * Throws AttachmentError with a sentence for the student.
 */
export function toBlocks(raw) {
  if (raw == null) return { blocks: [], names: [] }
  if (!Array.isArray(raw)) throw new AttachmentError('Those files could not be read.')
  if (raw.length > LIMITS.files) throw new AttachmentError(`Up to ${LIMITS.files} files per message.`)

  const blocks = []
  const names = []
  let total = 0
  let pages = 0
  for (const a of raw) {
    const name = String(a?.name || 'file').replace(/[^\w .()-]/g, '').slice(0, 80) || 'file'
    if (typeof a?.data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(a.data.slice(0, 200))) throw new AttachmentError(`${name} could not be read.`)
    const buf = Buffer.from(a.data, 'base64')
    total += buf.length
    if (total > LIMITS.totalBytes) throw new AttachmentError('Those files are too big together. Send fewer, or smaller ones.')

    const type = sniff(buf)
    if (type?.startsWith('image/')) {
      if (buf.length > LIMITS.imageBytes) throw new AttachmentError(`${name} is too big (${kib(buf.length)}). Try a smaller photo.`)
      blocks.push({ type: 'image', source: { type: 'base64', media_type: type, data: a.data } })
    } else if (type === 'application/pdf') {
      if (buf.length > LIMITS.pdfBytes) throw new AttachmentError(`${name} is over 3 MB. Send the pages you need.`)
      pages += Math.max(1, pdfPages(buf))
      if (pages > LIMITS.pdfPages) throw new AttachmentError(`Up to ${LIMITS.pdfPages} PDF pages per message. Send just the part you need.`)
      blocks.push({ type: 'document', title: name, source: { type: 'base64', media_type: 'application/pdf', data: a.data } })
    } else {
      if (buf.length > LIMITS.textBytes) throw new AttachmentError(`${name} is too long. Paste the part you need.`)
      const text = asText(buf)
      if (text === null) throw new AttachmentError(`${name} is not a file Syllabi can read. Photos, PDFs and text files work.`)
      blocks.push({ type: 'document', title: name, source: { type: 'text', media_type: 'text/plain', data: text.slice(0, LIMITS.textChars) } })
    }
    names.push(name)
  }
  return { blocks, names }
}
