import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { hasSyllabi } from '@/lib/access'
import { MODELS, claim, settle } from '@/lib/ai-cost'
import { pdfPages } from '@/lib/attachments'
import { fromOurOwnSite, supabaseFor } from '@/lib/request-supabase'

/**
 * Read a draft's PDF, as the model sees it, into text for the draft studio.
 *
 * Pulling the text out of a PDF in the browser loses whatever is not text:
 * equations come out as scattered symbols, a quotation pasted in as a
 * picture vanishes, a graph is nothing. The model reads the pages as they
 * look, so it can write the maths in LaTeX, type out a pictured quotation
 * where it stands and describe a figure in a line. What comes back is plain
 * text, because the studio marks up the student's own words.
 *
 * Same gates as every Syllabi call: our own site, a signed-in Premium
 * student, and the day's allowance claimed before a token is spent
 * (084-read-pdf-limit.sql). Haiku reads: this is transcription, not judgement.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** A request body on the host tops out at about 4.5 MB, so the PDF at 3 MB before base64. */
const MAX_BYTES = 3 * 1024 * 1024
const MAX_PAGES = 40

const INSTRUCTIONS = `You transcribe a student's draft from a PDF into plain text so it can be marked. Write out exactly what the student wrote: never correct, improve, summarise or comment on it.

- Paragraphs as they are, separated by one blank line. Join lines that only wrap; keep headings on their own line.
- Leave out the cover or title page, any table of contents, page numbers, running headers and footers.
- Every mathematical expression, however short, in LaTeX between single dollar signs: "The model is $f(x) = 3x^2 - 5x + 2$", "$x = \\frac{2}{3}$". A displayed equation goes on its own line, still between single dollar signs.
- Text that appears in a picture (a quotation, song lyrics, a screenshot of a source) is part of the draft: type it out word for word where it appears.
- A graph, diagram or photo: one line in square brackets saying what it shows, e.g. [Figure: graph of v against t, a straight line through the origin].
- A table: one row per line, cells separated by " | ".
- A bibliography or reference list: one entry per line.
- Output only the transcription, nothing before or after it.`

export async function POST(request) {
  if (!fromOurOwnSite(request)) return NextResponse.json({ error: 'Not allowed from there.' }, { status: 403 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Syllabi is not switched on yet.', code: 'not_configured' }, { status: 503 })

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })
  }
  const data = typeof body?.pdf === 'string' ? body.pdf.replace(/^data:application\/pdf;base64,/, '') : ''
  const buf = data ? Buffer.from(data, 'base64') : null
  if (!buf || buf.toString('ascii', 0, 5) !== '%PDF-') return NextResponse.json({ error: 'That is not a PDF.' }, { status: 400 })
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: 'That PDF is over 3 MB.', code: 'too_big' }, { status: 413 })
  if (pdfPages(buf) > MAX_PAGES) return NextResponse.json({ error: `That PDF is over ${MAX_PAGES} pages.`, code: 'too_big' }, { status: 413 })

  const supabase = supabaseFor(request)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('plan, is_admin, access_expires_at, subjects').eq('id', user.id).maybeSingle()
  if (!hasSyllabi(profile)) return NextResponse.json({ error: 'Syllabi is part of Premium.', code: 'upgrade_required' }, { status: 402 })

  const claimed = await claim(supabase, 'read_pdf', '')
  if (!claimed.ok) return NextResponse.json({ error: claimed.error, code: claimed.code }, { status: claimed.status })

  const model = MODELS.tutor
  let response
  try {
    response = await new Anthropic().messages
      .stream(
        {
          model,
          max_tokens: 16000,
          system: INSTRUCTIONS,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data }, title: 'Draft' },
                { type: 'text', text: 'Transcribe this draft.' },
              ],
            },
          ],
        },
        { signal: request.signal }
      )
      .finalMessage()
  } catch (e) {
    console.error('syllabi read:', e?.message || e)
    await settle(supabase, claimed.id, model, request.signal.aborted ? undefined : null).catch(() => {})
    return NextResponse.json({ error: 'Syllabi could not read that PDF just now.' }, { status: 502 })
  }
  await settle(supabase, claimed.id, model, response.usage).catch(() => {})

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (response.stop_reason === 'refusal' || text.length < 40) return NextResponse.json({ error: 'Syllabi could not read that PDF.' }, { status: 502 })
  return NextResponse.json({ text, cut: response.stop_reason === 'max_tokens', remaining: claimed.remaining })
}
