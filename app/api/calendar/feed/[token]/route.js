import { buildFeed } from '@/lib/ics-write'

/**
 * The calendar a student subscribes to from Google, Apple or Outlook.
 *
 * Calendar apps fetch anonymously, so the private token in the link is the
 * key — the same arrangement as Google's own private iCal addresses. It goes
 * to calendar_feed(), which returns that student's upcoming study blocks and
 * dated events and nothing else (migration 061). An unknown token gets a 404
 * and no hint as to why.
 *
 * Cached for fifteen minutes at most. Google refreshes subscriptions on its
 * own schedule — anywhere up to a day — whatever this says; Apple and
 * Outlook come back roughly hourly.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function localDate(tz) {
  let zone = 'Asia/Muscat'
  try {
    if (tz) {
      new Intl.DateTimeFormat('en-CA', { timeZone: tz })
      zone = tz
    }
  } catch {
    /* an unknown zone falls back to the pilot's */
  }
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
  return (iso) => fmt.format(new Date(iso)).replace(/-/g, '')
}

export async function GET(_request, { params }) {
  const { token } = await params
  const id = String(token || '').replace(/\.ics$/i, '')
  if (!UUID.test(id)) return new Response('Not found', { status: 404 })

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/calendar_feed`, {
    method: 'POST',
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_token: id }),
    cache: 'no-store',
  })
  if (!res.ok) return new Response('Calendar unavailable', { status: 502 })
  const data = await res.json()
  if (!data) return new Response('Not found', { status: 404 })

  return new Response(buildFeed(data, { allDayAt: localDate(data.tz) }), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="project-syllabus.ics"',
      'cache-control': 'private, max-age=900',
      // A private calendar has no business in a search index.
      'x-robots-tag': 'noindex, nofollow',
    },
  })
}
