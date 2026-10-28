import { ImageResponse } from 'next/og'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'

/**
 * The picture a link to the site unfurls with (search, messages, socials):
 * the P-and-S mark on the brand green, the name and what it does. Flat, no
 * gradients, the same green as the app icon.
 */

export const alt = 'Project Syllabus: IB Diploma revision that knows where you stand'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const GREEN = '#2e664f'
const mark = `data:image/svg+xml;base64,${await readFile(join(process.cwd(), 'public/brand/mark-white.svg'), 'base64')}`

/** Inter, the site's own face, at the weights the picture uses. Without it the
 *  renderer has one light face and every heading comes out thin; if Google
 *  Fonts cannot be reached the picture still renders, in that face. */
async function inter(weight) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Inter:wght@${weight}`)).text()
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1]
    return url ? { name: 'Inter', data: await (await fetch(url)).arrayBuffer(), weight, style: 'normal' } : null
  } catch {
    return null
  }
}
const fonts = (await Promise.all([400, 600, 700].map(inter))).filter(Boolean)

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', background: GREEN, padding: '0 96px', fontFamily: fonts.length ? 'Inter' : 'system-ui, sans-serif' }}>
        <img src={mark} width={246} height={292} alt="" style={{ marginRight: 72 }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 30, fontWeight: 600, color: 'rgba(255,255,255,0.72)', letterSpacing: 6, textTransform: 'uppercase' }}>Project Syllabus</div>
          <div style={{ fontSize: 66, fontWeight: 700, color: '#ffffff', lineHeight: 1.08, letterSpacing: -1.5, marginTop: 18, maxWidth: 700 }}>
            Know exactly what to study next.
          </div>
          <div style={{ fontSize: 27, color: 'rgba(255,255,255,0.78)', marginTop: 26, maxWidth: 680, lineHeight: 1.35 }}>
            IB Diploma revision mapped to your syllabus, proved by testing, with an AI tutor that knows your course.
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#ffffff', marginTop: 34 }}>psyllabus.app</div>
        </div>
      </div>
    ),
    { ...size, fonts }
  )
}
