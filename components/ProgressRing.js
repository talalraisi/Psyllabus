'use client'

export default function ProgressRing({ progress = 0, size = 64, strokeWidth = 6 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const clamped = Math.min(100, Math.max(0, progress))
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#2D6A4F"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[#1a2e1e]"
        aria-label={`${clamped}% complete`}
      >
        {clamped}%
      </span>
    </div>
  )
}
