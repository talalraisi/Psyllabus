import { ImageResponse } from 'next/og'

export const alt = 'PSyllabus: syllabus-mapped progress tracking for IB, A-Level, and AP'
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
          background: '#f8f6f1',
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
          <div style={{ fontSize: 28, fontWeight: 600, color: '#1a2e1e' }}>PSyllabus</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              color: '#1a2e1e',
              lineHeight: 1.1,
              letterSpacing: -1.5,
              maxWidth: 900,
            }}
          >
            Know exactly what to study next.
          </div>
          <div style={{ fontSize: 30, color: '#6b7280', marginTop: 24, maxWidth: 860 }}>
            Syllabus-mapped progress for IB, A-Level, and AP. Verified by testing, not
            self-rating.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {[
            ['#2d6a4f', 'Mastered'],
            ['#f59e0b', 'Decaying'],
            ['#ef4444', 'Weak'],
            ['#e5e7eb', 'Untested'],
          ].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 14, height: 14, borderRadius: 7, background: color }} />
              <div style={{ fontSize: 22, color: '#6b7280' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size
  )
}
