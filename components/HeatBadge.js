import { heatOf, HEAT_TEXT_COLORS, HEAT_BG_COLORS, HEAT_LEVELS } from '@/lib/progress'

/**
 * How hard a question is, shown as filled bars rather than a word alone.
 *
 * Bars because five named tiers are hard to rank from the name: "Hot" and
 * "Extremely hot" are only ordered if you already know the scale, while four
 * bars filled out of five is ordered on sight. The word is still there, so the
 * scale is learnable, and the whole thing carries a title for anyone who wants
 * to know what the tier actually means.
 */
export default function HeatBadge({ difficulty, showLabel = true, showPoints = false, className = '' }) {
  const heat = heatOf(difficulty)
  const index = HEAT_LEVELS.findIndex((h) => h.key === heat.key)

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={`${heat.label}. ${heat.description}${showPoints ? '' : ` Worth ${heat.points} mastery points.`}`}
    >
      <span className="flex items-end gap-[2px]" aria-hidden="true">
        {HEAT_LEVELS.map((level, i) => (
          <span
            key={level.key}
            className={`w-[3px] rounded-[1px] ${
              i <= index ? HEAT_BG_COLORS[heat.key] : 'bg-[var(--border-strong)]'
            }`}
            style={{ height: `${5 + i * 2}px` }}
          />
        ))}
      </span>
      {showLabel && (
        <span className={`text-[11px] font-medium ${HEAT_TEXT_COLORS[heat.key]}`}>
          {heat.label}
        </span>
      )}
      {showPoints && (
        <span className="text-[11px] text-[var(--text-faint)]">
          {heat.points} pt{heat.points === 1 ? '' : 's'}
        </span>
      )}
      <span className="sr-only">Difficulty: {heat.label}</span>
    </span>
  )
}

/** The whole scale, for a legend. */
export function HeatLegend() {
  return (
    <ul className="flex flex-col gap-2">
      {HEAT_LEVELS.map((level) => (
        <li key={level.key} className="flex items-baseline gap-3">
          <HeatBadge difficulty={level.max === Infinity ? 0.9 : level.max} showPoints />
          <span className="t-caption">{level.description}</span>
        </li>
      ))}
    </ul>
  )
}
