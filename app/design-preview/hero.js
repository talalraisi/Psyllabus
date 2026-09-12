'use client'

import { useInView } from './scroll'

/**
 * The hero panel.
 *
 * A grid of many colours was the wrong opening. Randomly coloured squares read
 * as decoration rather than information, and decoration is the thing that makes
 * an interface look generated — nobody arriving at the page knows what any of
 * those colours mean yet, so all it communicates is "there is a graphic here".
 *
 * A workspace opens with a list. Rows, alignment, one accent, mostly greys: it
 * looks like something you would work in, which is the actual claim. The
 * status colour appears exactly four times, so each one means something when
 * you reach it instead of being one square among ninety-six.
 */
export function HeroPanel() {
  const [ref, seen] = useInView({ threshold: 0.3 })

  const rows = [
    { name: 'Circular motion and gravitation', pct: 22, tone: 'weak', level: 'Weak' },
    { name: 'Wave characteristics', pct: 58, tone: 'fading', level: 'Fading' },
    { name: 'Momentum and impulse', pct: 71, tone: 'developing', level: 'Developing' },
    { name: 'Work, energy and power', pct: 94, tone: 'mastered', level: 'Mastered' },
    { name: 'Thermal concepts', pct: 0, tone: 'untested', level: 'Not tested' },
    { name: 'Simple harmonic motion', pct: 0, tone: 'untested', level: 'Not tested' },
  ]

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-[12px] border"
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
    >
      {/* A quiet header bar, the way a real panel has one. */}
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <p className="text-[12.5px] font-semibold">Physics SL</p>
        <p className="text-[11px] tabular-nums" style={{ color: 'var(--faint)' }}>
          4 of 31 proved
        </p>
      </div>

      <ul>
        {rows.map((r, i) => (
          <li
            key={r.name}
            className="flex items-center gap-4 border-b px-4 py-[13px] last:border-b-0"
            style={{
              borderColor: 'var(--border)',
              opacity: seen ? 1 : 0,
              transform: seen ? 'none' : 'translateY(6px)',
              transition: `all 460ms cubic-bezier(0.16,1,0.3,1) ${140 + i * 70}ms`,
            }}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: `var(--${r.tone})` }}
            />
            <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: 'var(--body)' }}>
              {r.name}
            </span>
            <span
              className="hidden w-[74px] shrink-0 text-right text-[10.5px] font-medium sm:block"
              style={{ color: r.tone === 'untested' ? 'var(--faint)' : `var(--${r.tone})` }}
            >
              {r.level}
            </span>
            <span
              className="h-[3px] w-16 shrink-0 overflow-hidden rounded-full"
              style={{ background: 'var(--border)' }}
            >
              <span
                className="block h-full rounded-full"
                style={{
                  width: seen ? `${r.pct}%` : 0,
                  background: r.tone === 'untested' ? 'transparent' : `var(--${r.tone})`,
                  transition: `width 760ms cubic-bezier(0.16,1,0.3,1) ${320 + i * 70}ms`,
                }}
              />
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
        <p className="text-[11px]" style={{ color: 'var(--faint)' }}>
          Every level set by a quiz. Grey means untested, not weak.
        </p>
      </div>
    </div>
  )
}
