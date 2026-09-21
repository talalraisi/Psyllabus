import { ImageResponse } from 'next/og'

export const alt = 'Project Syllabus: syllabus tracking for IB, A-Level and AP'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#fdfbf3',
          padding: 80,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#2d6a4f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            P
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#1d1a13' }}>Project Syllabus</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              color: '#1d1a13',
              lineHeight: 1.1,
              letterSpacing: -1.5,
              maxWidth: 900,
            }}
          >
            Know exactly what to study next.
          </div>
          <div style={{ fontSize: 30, color: '#635c4a', marginTop: 24, maxWidth: 860 }}>
            Syllabus-mapped progress for IB, A-Level, and AP. Verified by testing, not
            self-rating.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {[
            // The status colours, as the app actually renders them. These
            // were Tailwind defaults and had drifted a long way from the
            //five-level scale the product uses.
            ['#7b5cd6', 'Mastered'],
            ['#5a7fb8', 'Fading'],
            ['#b5553a', 'Weak'],
            ['#e8e0cb', 'Untested'],
          ].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 14, height: 14, borderRadius: 7, background: color }} />
              <div style={{ fontSize: 22, color: '#635c4a' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size
  )
}
