import { NextResponse } from 'next/server'
import { supabaseFor, fromOurOwnSite } from '@/lib/request-supabase'
import { fetchCalendar, normaliseLink, CalendarLinkError } from '@/lib/calendar-fetch'
import { readCalendar, WINDOW_DAYS } from '@/lib/ics'

/**
 * Reading students' own calendars into the app.
 *
 * POST { url, label }  connect a calendar by its private iCal link. The link
 *                      is fetched and read first, and only saved if it really
 *                      is a calendar, so a wrong paste fails with a reason
 *                      instead of sitting there broken.
 * POST { force }       refresh every connected calendar. Called when the
 *                      study plan or the calendar opens, so the six weeks
 *                      ahead stay current without anything running in the
 *                      background. At most once every two minutes per
 *                      calendar unless forced, so a page left reloading
 *                      cannot hammer someone's calendar server.
 *
 * Everything runs as the signed-in student under their own row-level
 * security: this route can read and write nothing they could not.
 * Busy times and titles are kept; locations, descriptions and guests are
 * never read out of the file (lib/ics.js).
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MIN_GAP_MS = 2 * 60 * 1000

function windowFrom(now = new Date()) {
  return { from: new Date(now.getTime() - 86400000), to: new Date(now.getTime() + WINDOW_DAYS * 86400000) }
}

async function readLink(url) {
  try {
    return readCalendar(await fetchCalendar(url), windowFrom())
  } catch (e) {
    throw new CalendarLinkError(e instanceof CalendarLinkError ? e.message : 'That link did not return a calendar. Make sure it is the private iCal address.')
  }
}

/** Replace a connection's six weeks of events with a fresh read. */
async function store(supabase, connectionId, events) {
  const { error: del } = await supabase.from('calendar_busy').delete().eq('connection_id', connectionId)
  if (del) throw new Error('Could not clear the old copy.')
  for (let i = 0; i < events.length; i += 500) {
    const { error } = await supabase
      .from('calendar_busy')
      .insert(events.slice(i, i + 500).map((e) => ({ ...e, connection_id: connectionId })))
    if (error) throw new Error('Could not save the calendar.')
  }
}

export async function POST(request) {
  if (!fromOurOwnSite(request)) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
  const supabase = supabaseFor(request)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const body = await request.json().catch(() => ({}))

  // Connect.
  if (body?.url) {
    let url
    let events
    try {
      url = normaliseLink(body.url).href
      events = await readLink(url)
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const label = String(body.label || '').trim().slice(0, 80) || 'My calendar'
    const { data: conn, error } = await supabase.from('calendar_connections').insert({ url, label }).select('id').single()
    if (error) {
      const full = /limit/i.test(error.message)
      return NextResponse.json({ error: full ? 'You can connect up to five calendars.' : 'That calendar could not be saved.' }, { status: 400 })
    }
    try {
      await store(supabase, conn.id, events)
      await supabase
        .from('calendar_connections')
        .update({ last_synced_at: new Date().toISOString(), last_error: null, event_count: events.length })
        .eq('id', conn.id)
    } catch (e) {
      await supabase.from('calendar_connections').delete().eq('id', conn.id)
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
    return NextResponse.json({ connected: { id: conn.id, label, events: events.length } })
  }

  // Refresh.
  const { data: connections } = await supabase.from('calendar_connections').select('id, url, last_synced_at')
  const now = Date.now()
  const results = []
  for (const c of connections || []) {
    if (!body?.force && c.last_synced_at && now - new Date(c.last_synced_at).getTime() < MIN_GAP_MS) {
      results.push({ id: c.id, skipped: true })
      continue
    }
    try {
      const events = await readLink(c.url)
      await store(supabase, c.id, events)
      await supabase
        .from('calendar_connections')
        .update({ last_synced_at: new Date().toISOString(), last_error: null, event_count: events.length })
        .eq('id', c.id)
      results.push({ id: c.id, events: events.length })
    } catch (e) {
      // The last good copy stays: a calendar that fails to refresh should not
      // empty itself and let the plan book time that is really taken.
      await supabase.from('calendar_connections').update({ last_error: e.message.slice(0, 300) }).eq('id', c.id)
      results.push({ id: c.id, error: e.message })
    }
  }
  return NextResponse.json({ results })
}
