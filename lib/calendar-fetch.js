/**
 * Fetching a calendar from a link a student pasted. Server only.
 *
 * A server that fetches any URL it is handed can be pointed at things it can
 * reach and the student cannot: its own network, the cloud provider's
 * metadata address, localhost. So the link has to be https, and the address
 * it resolves to is checked at the moment of connecting — inside the socket's
 * own DNS lookup — rather than looked up once beforehand, which a hostname
 * that resolves differently the second time would get past. Redirects are
 * followed by hand, at most three, each one checked the same way. Ten seconds
 * and five megabytes, then it gives up.
 *
 * Errors are written for the student: what to do, not what failed.
 */

import https from 'node:https'
import dns from 'node:dns'
import net from 'node:net'

const TIMEOUT_MS = 10000
const MAX_BYTES = 5 * 1024 * 1024
const MAX_REDIRECTS = 3

export class CalendarLinkError extends Error {}

/** Addresses a public calendar link has no business resolving to. */
export function isBlockedAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) ||
      (a === 198 && (b === 18 || b === 19))
    )
  }
  if (net.isIPv6(address)) {
    const v = address.toLowerCase()
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isBlockedAddress(mapped[1])
    return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || /^fe[89ab]/.test(v) || v.startsWith('ff')
  }
  return true
}

/** The link as something we will fetch, or a reason we will not. */
export function normaliseLink(raw) {
  let text = String(raw || '').trim()
  if (/^webcals?:\/\//i.test(text)) text = text.replace(/^webcals?:/i, 'https:')
  let url
  try {
    url = new URL(text)
  } catch {
    throw new CalendarLinkError('That does not look like a link. Copy the whole address, starting with https:// or webcal://.')
  }
  if (url.protocol !== 'https:') throw new CalendarLinkError('Only secure (https) calendar links can be used.')
  if (url.username || url.password) throw new CalendarLinkError('That link has a password in it. Use the private iCal address instead.')
  if (url.port && url.port !== '443') throw new CalendarLinkError('That link uses an unusual port and cannot be used.')
  if (net.isIP(url.hostname.replace(/^\[|\]$/g, '')) && isBlockedAddress(url.hostname.replace(/^\[|\]$/g, ''))) {
    throw new CalendarLinkError('That link points somewhere private and cannot be used.')
  }
  return url
}

function lookup(hostname, options, callback) {
  dns.lookup(hostname, { family: options?.family || 0, all: false }, (err, address, family) => {
    if (err) return callback(err)
    if (isBlockedAddress(address)) return callback(new CalendarLinkError('That link points somewhere private and cannot be used.'))
    if (options?.all) return callback(null, [{ address, family }])
    callback(null, address, family)
  })
}

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        lookup,
        timeout: TIMEOUT_MS,
        headers: { 'user-agent': 'ProjectSyllabus-Calendar/1.0', accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5' },
      },
      (res) => {
        const status = res.statusCode || 0
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume()
          return resolve({ redirect: res.headers.location })
        }
        if (status === 401 || status === 403 || status === 404) {
          res.resume()
          return reject(new CalendarLinkError('That calendar could not be opened. The link may have been reset, or it is not the private iCal address — get a fresh one and paste it again.'))
        }
        if (status !== 200) {
          res.resume()
          return reject(new CalendarLinkError(`The calendar server answered with an error (${status}). Try again in a little while.`))
        }
        const chunks = []
        let size = 0
        res.on('data', (chunk) => {
          size += chunk.length
          if (size > MAX_BYTES) {
            req.destroy()
            reject(new CalendarLinkError('That calendar is too large to read. Link a calendar with just your own events.'))
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8') }))
        res.on('error', reject)
      }
    )
    req.on('timeout', () => req.destroy(new CalendarLinkError('That calendar took too long to answer. Try again in a little while.')))
    req.on('error', (e) =>
      reject(e instanceof CalendarLinkError ? e : new CalendarLinkError('That calendar could not be reached. Check the link and your connection.'))
    )
  })
}

/** The calendar text behind a link. Throws CalendarLinkError with a message for the student. */
export async function fetchCalendar(raw) {
  let url = normaliseLink(raw)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await get(url)
    if (res.body !== undefined) return res.body
    url = normaliseLink(new URL(res.redirect, url).toString())
  }
  throw new CalendarLinkError('That link redirects too many times to follow.')
}
