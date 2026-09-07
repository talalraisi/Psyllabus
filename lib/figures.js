/**
 * What counts as a drawable figure.
 *
 * Lives apart from the component that draws it because the generator needs the
 * same answer and cannot import JSX. Both sides asking one function is what
 * stops a figure being written that the app then renders as an empty box under
 * a stem that says "the graph shows".
 */

export const FIGURE_KINDS = ['plot', 'scatter', 'bar', 'table']

export function figureIsUsable(figure) {
  if (!figure?.kind || !FIGURE_KINDS.includes(figure.kind)) return false
  if (figure.kind === 'table') return figure.columns?.length > 0 && figure.rows?.length > 0
  if (figure.kind === 'bar') return figure.bars?.length >= 2
  const points = figure.points?.length ? figure.points : figure.series?.[0]?.points
  return (
    points?.length >= 2 &&
    points.every((p) => typeof p.x === 'number' && typeof p.y === 'number')
  )
}
