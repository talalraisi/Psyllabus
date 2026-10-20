/**
 * The real syllabus for one subject, for the map preview. Development only:
 * production answers 404, and the rows never go into a shipped bundle.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  if (process.env.NODE_ENV === 'production') return new Response('Not found', { status: 404 })
  const subject = new URL(request.url).searchParams.get('subject') || 'Economics HL'
  const { connect } = await import('../../../../scripts/db.mjs')
  const c = await connect({ quiet: true })
  try {
    const { rows } = await c.query('select subject, topic, unit, code, subtopic, position, hl_only, hl_extension from syllabus_content where subject = $1 order by position', [subject])
    const { rows: subjects } = await c.query('select distinct subject from syllabus_content order by subject')
    return Response.json({ rows, subjects: subjects.map((s) => s.subject) })
  } finally {
    await c.end()
  }
}
