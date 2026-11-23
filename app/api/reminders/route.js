import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { pickReminder, reminderEmail, SITE } from '@/lib/reminders'
import { unsubscribeToken } from '@/lib/reminder-token'

/**
 * The daily reminders job. Vercel's cron calls it at 14:00 UTC, 18:00 in
 * Muscat (vercel.json), with CRON_SECRET as a bearer token.
 *
 * Nothing goes out unless REMINDERS_LIVE is 1. Until then, and with ?dry=1
 * at any time, it answers with what it would have sent: counts only, no
 * names or addresses.
 *
 * Needs, in Vercel's environment:
 *   CRON_SECRET                 any long random string
 *   SUPABASE_SERVICE_ROLE_KEY   to read every student's due cards
 *   RESEND_API_KEY              email, through Resend, from psyllabus.app
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   push
 *   REMINDERS_LIVE=1            when it is time to send for real
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FROM = process.env.REMINDERS_FROM || 'Psyllabus <reminders@psyllabus.app>'

async function sendEmail(to, { subject, html, text }, unsubscribeUrl) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject,
      html,
      text,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  })
  if (!res.ok) throw new Error(`email ${res.status}`)
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Not found', { status: 404 })
  }
  const url = new URL(request.url)
  const live = process.env.REMINDERS_LIVE === '1' && url.searchParams.get('dry') !== '1'
  const pushReady = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
  const emailReady = Boolean(process.env.RESEND_API_KEY)
  if (pushReady) webpush.setVapidDetails('mailto:hello@psyllabus.app', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)

  const db = supabaseAdmin()
  const { data: people, error } = await db.rpc('reminder_candidates')
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const now = new Date()
  const summary = { live, emailReady, pushReady, students: people.length, nudges: {}, emails: 0, pushes: 0, failed: 0 }
  const log = []

  for (const c of people) {
    const r = pickReminder(c, now)
    if (!r || (!r.email && !r.push)) continue
    summary.nudges[r.kind] = (summary.nudges[r.kind] || 0) + 1
    if (!live) {
      if (r.email && emailReady) summary.emails++
      if (r.push && pushReady) summary.pushes++
      continue
    }

    if (r.email && emailReady) {
      const unsubscribeUrl = `${SITE}/api/reminders/unsubscribe?u=${c.user_id}&t=${unsubscribeToken(c.user_id)}`
      try {
        await sendEmail(c.email, reminderEmail(r, { unsubscribeUrl }), unsubscribeUrl)
        summary.emails++
        log.push({ user_id: c.user_id, channel: 'email', kind: r.kind })
      } catch {
        summary.failed++
      }
    }

    if (r.push && pushReady) {
      let sent = false
      for (const sub of c.push_subs) {
        try {
          await webpush.sendNotification(sub, JSON.stringify({ title: r.title, body: r.body, url: r.url, tag: r.kind }), { TTL: 6 * 3600 })
          sent = true
        } catch (e) {
          // The browser threw the subscription away: so do we.
          if (e?.statusCode === 404 || e?.statusCode === 410) await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          else summary.failed++
        }
      }
      if (sent) {
        summary.pushes++
        log.push({ user_id: c.user_id, channel: 'push', kind: r.kind })
      }
    }
  }

  if (log.length) await db.from('reminder_log').insert(log)
  return Response.json(summary)
}
