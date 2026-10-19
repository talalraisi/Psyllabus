'use client'

/**
 * Getting a file ready to send to Syllabi, in the browser.
 *
 * Photos are shrunk to at most 1568 pixels on the long side (the most the
 * model looks at anyway) and re-saved as JPEG, so a 4 MB phone photo goes up
 * as a few hundred KB. PDFs and text go as they are, within limits the
 * server checks again (lib/attachments.js).
 */

export const MAX_FILES = 3
const MAX_SIDE = 1568
const PDF_BYTES = 3 * 1024 * 1024
const TEXT_BYTES = 200 * 1024
export const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf,.txt,.md,.csv,text/plain'

export class FileProblem extends Error {}

const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = () => reject(new FileProblem('That file could not be read.'))
    r.readAsDataURL(blob)
  })

async function shrink(file) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new FileProblem(`${file.name} is an image this browser cannot open. Try a JPG or PNG.`)
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
  if (!blob) throw new FileProblem(`${file.name} could not be prepared.`)
  return blob
}

/** A File, ready to attach: { id, name, kind, data, size, preview }. */
export async function prepare(file) {
  const id = `${file.name}-${file.size}-${file.lastModified}`
  if (file.type.startsWith('image/')) {
    const blob = await shrink(file)
    return { id, name: file.name.replace(/\.\w+$/, '.jpg'), kind: 'image', data: await toBase64(blob), size: blob.size, preview: URL.createObjectURL(blob) }
  }
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (file.size > PDF_BYTES) throw new FileProblem(`${file.name} is over 3 MB. Send just the pages you need.`)
    return { id, name: file.name, kind: 'pdf', data: await toBase64(file), size: file.size }
  }
  if (file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name)) {
    if (file.size > TEXT_BYTES) throw new FileProblem(`${file.name} is too long. Paste the part you need.`)
    return { id, name: file.name, kind: 'text', data: await toBase64(file), size: file.size }
  }
  throw new FileProblem(`${file.name} is not something Syllabi can read. Photos, PDFs and text files work.`)
}

/** The https links in what is being typed, as the server will see them. */
export function linksIn(text, max = 2) {
  const found = String(text || '').match(/https:\/\/[^\s<>"'`]+/gi) || []
  return [...new Set(found.map((u) => u.replace(/[).,;:!?\]]+$/, '')))].slice(0, max)
}

export const host = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
