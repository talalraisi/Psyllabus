/**
 * How much the page is zoomed: 1 on most screens, more on a large one
 * (globals.css scales the whole site up past 1,800 px wide).
 *
 * Measurements taken from the page (getBoundingClientRect, innerWidth) come
 * in screen pixels, but a position written back into a style is zoomed again,
 * so anything placed from a measurement divides by this first.
 */
export function pageZoom() {
  if (typeof document === 'undefined') return 1
  return parseFloat(getComputedStyle(document.documentElement).zoom) || 1
}
