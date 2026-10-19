/**
 * Reading a web page a student linked in Syllabi. Server only.
 *
 * Same guard as calendar links (lib/calendar-fetch.js): https only, the
 * address checked at the moment of connecting so a link cannot be pointed at
 * our own network, redirects followed by hand and checked each time. Smaller
 * limits, because this runs while a student waits: eight seconds, two
 * megabytes, and only the readable text of the page is kept.
 */

import https from 'node:https'
import dns from 'node:dns'
import net from 'node:net'
import { isBlockedAddress } from '@/lib/calendar-fetch'

const TIMEOUT_MS = 8000
const MAX_BYTES = 2 * 1024 * 1024
const MAX_REDIRECTS = 3
const MAX_TEXT = 12000

export class LinkError extends Error {}

/** The https links in a message, at most `max`, without trailing punctuation. */
export function linksIn(text, max = 2) {
  const found = String(text || '').match(/https:\/\/[^\s<>"'`]+/gi) || []
  return [...new Set(found.map((u) => u.replace(/[).,;:!?\]]+$/, '')))].slice(0, max)
}

function check(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new LinkError('not a link')
  }
  if (url.protocol !== 'https:') throw new LinkError('only https links can be opened')
  if (url.username || url.password || (url.port && url.port !== '443')) throw new LinkError('that link cannot be opened')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (net.isIP(host) && isBlockedAddress(host)) throw new LinkError('that link points somewhere private')
  return url
}

function lookup(hostname, options, callback) {
  dns.lookup(hostname, { family: options?.family || 0, all: false }, (err, address, family) => {
    if (err) return callback(err)
    if (isBlockedAddress(address)) return callback(new LinkError('that link points somewhere private'))
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
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; ProjectSyllabus/1.0; +https://psyllabus.app)',
          accept: 'text/html, text/plain;q=0.9',
        },
      },
      (res) => {
        const status = res.statusCode || 0
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume()
          return resolve({ redirect: res.headers.location })
        }
        if (status !== 200) {
          res.resume()
          return reject(new LinkError(`the site answered ${status}`))
        }
        const type = String(res.headers['content-type'] || '')
        if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) {
          res.resume()
          return reject(new LinkError(/pdf/i.test(type) ? 'it is a PDF, so attach the file instead' : 'it is not a web page'))
        }
        const chunks = []
        let size = 0
        res.on('data', (chunk) => {
          size += chunk.length
          if (size > MAX_BYTES) {
            req.destroy()
            reject(new LinkError('the page is too large'))
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8'), html: /html/i.test(type) }))
        res.on('error', reject)
      }
    )
    req.on('timeout', () => req.destroy(new LinkError('the site took too long')))
    req.on('error', (e) => reject(e instanceof LinkError ? e : new LinkError('the site could not be reached')))
  })
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' }

/** A page's title and readable text: no scripts, menus or markup. */
export function readable(html) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim()
  const main = html.match(/<(article|main)[\s\S]*?<\/\1>/i)?.[0] || html
  const text = main
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|iframe|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
        return Number.isFinite(code) ? String.fromCodePoint(code) : ' '
      }
      return ENTITIES[e.toLowerCase()] ?? ' '
    })
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n\s*\n\s*/g, '\n\n')
    .trim()
  return { title: title.replace(/\s+/g, ' ').slice(0, 200), text: text.slice(0, MAX_TEXT) }
}

/** The readable text behind a link, or a LinkError saying why not. */
export async function fetchPage(raw) {
  let url = check(raw)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await get(url)
    if (res.body !== undefined) {
      const page = res.html ? readable(res.body) : { title: '', text: res.body.slice(0, MAX_TEXT) }
      if (page.text.length < 40) throw new LinkError('there was no readable text on it')
      return { url: url.toString(), ...page }
    }
    url = check(new URL(res.redirect, url).toString())
  }
  throw new LinkError('it redirects too many times')
}
