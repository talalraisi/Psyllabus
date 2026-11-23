import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkUnsubscribeToken } from '@/lib/reminder-token'

/**
 * "Stop reminder emails", from the foot of every reminder. Works without
 * signing in: the token is an HMAC of the student's id (lib/reminder-token.js).
 * GET from the link, POST from a mail app's own unsubscribe button
 * (List-Unsubscribe-Post). Push is switched off on the device itself, or in
 * Profile.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function stop(request) {
  const url = new URL(request.url)
  const u = url.searchParams.get('u') || ''
  const t = url.searchParams.get('t') || ''
  if (!UUID.test(u) || !checkUnsubscribeToken(u, t)) return false
  const { error } = await supabaseAdmin().from('profiles').update({ email_reminders: false }).eq('id', u)
  return !error
}

const page = (ok) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Reminder emails</title>
<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;background:#f7f4ec;color:#1d1a13;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}
main{max-width:420px;background:#fdfbf3;border:1px solid #eae5da;border-radius:16px;padding:28px}h1{font-size:20px;margin:0 0 8px}p{color:#443f33;line-height:1.6;font-size:15px;margin:0 0 16px}a{color:#2d6a4f;font-weight:600}
@media (prefers-color-scheme:dark){body{background:#141414;color:#f0f0f0}main{background:#191919;border-color:#2b2b2b}p{color:#c9c9c9}a{color:#7cc0a0}}</style></head>
<body><main>${
  ok
    ? '<h1>No more reminder emails</h1><p>You will not get study reminders by email. Emails about your account, like password resets, still come.</p><p>Changed your mind? Turn them back on in <a href="/dashboard/profile">Profile</a>.</p>'
    : '<h1>That link did not work</h1><p>Turn reminder emails off in <a href="/dashboard/profile">Profile</a> instead.</p>'
}</main></body></html>`

export async function GET(request) {
  const ok = await stop(request)
  return new Response(page(ok), { status: ok ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } })
}

export async function POST(request) {
  const ok = await stop(request)
  return new Response(null, { status: ok ? 200 : 400 })
}
