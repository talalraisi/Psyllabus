'use client'

/**
 * Every dashboard page arrives the same way.
 *
 * A template re-renders on each navigation within the segment, which is
 * exactly what an entrance needs: the class is applied fresh on every route
 * change, so moving from the dashboard to the study plan is a short rise
 * rather than a hard cut.
 *
 * It is 220ms and 6px, the same as everything else. The point is to make the
 * change legible — you moved, here is the new page — not to perform.
 */
export default function DashboardTemplate({ children }) {
  return <div className="app-enter">{children}</div>
}
