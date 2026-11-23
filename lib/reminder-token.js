import crypto from 'node:crypto'

/**
 * The token in a reminder email's "Stop reminder emails" link: an HMAC of the
 * student's id, so the link works without signing in and nobody can stop
 * someone else's. Server only.
 */
const secret = () => process.env.REMINDERS_SECRET || process.env.CRON_SECRET || ''

export function unsubscribeToken(userId) {
  return crypto.createHmac('sha256', secret()).update(`unsubscribe:${userId}`).digest('base64url').slice(0, 32)
}

export function checkUnsubscribeToken(userId, token) {
  if (!secret() || !userId || typeof token !== 'string') return false
  const want = Buffer.from(unsubscribeToken(userId))
  const got = Buffer.from(token)
  return want.length === got.length && crypto.timingSafeEqual(want, got)
}
