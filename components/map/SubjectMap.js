'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapCanvas from '@/components/map/MapCanvas'
import Inspector from '@/components/map/Inspector'
import Outline from '@/components/map/Outline'
import SearchPalette from '@/components/map/SearchPalette'
import Select from '@/components/Select'
import ThemeToggle from '@/components/ThemeToggle'
import { radialLayout, fitView } from '@/lib/map-layout'
import { pathTo, recommended, related, leavesOf, statusLabel } from '@/lib/subject-graph'
import { STATUS_VAR } from '@/components/map/MapCanvas'

/**
 * The subject map: one level at a time, entered like zooming into it.
 *
 *   Click          select, and read about it on the right
 *   Arrow / dbl    open that topic's own map
 *   + / −          fan a topic's contents out in place, or fold them away
 *   Breadcrumbs    straight back to any level above
 *   ⌘K or /        search the whole subject
 *   Esc            deselect, then up a level
 *
 * Every level remembers how it was left (where you had panned, how far you
 * had zoomed, what was selected and fanned out) and comes back that way.
 * Preferences (which panels are open, connections, the strip) are kept on
 * this device only.
 */

const PREFS = 'psyllabus:map'
const readPrefs = () => {
  try {
    return { outline: true, inspector: true, connections: false, strip: true, ...JSON.parse(localStorage.getItem(PREFS) || '{}') }
  } catch {
    return { outline: true, inspector: true, connections: false, strip: true }
  }
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function IconButton({ label, onClick, active, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-sunken)] ${className}`}
      style={{ color: active ? 'var(--brand)' : 'var(--text-muted)', background: active ? 'var(--brand-tint)' : undefined }}
    >
      {children}
    </button>
  )
}

const svg = (d, size = 16) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
)

export default function SubjectMap({ graph, subjects = [], onSubject, initialAt = null, syllabi = false }) {
  // Where a deep link lands: a branch opens its own level; a subtopic opens
  // its parent's, with it selected.
  const start = useMemo(() => {
    const n = initialAt && graph.nodes.get(initialAt)
    if (!n) return { focus: graph.rootId, select: null }
    if (n.kind === 'subtopic') return { focus: n.parentId, select: n.id }
    return { focus: n.id, select: null }
  }, [graph, initialAt])

  const [focusId, setFocusId] = useState(start.focus)
  const [selectedId, setSelectedId] = useState(start.select)
  const [expandedId, setExpandedId] = useState(null)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [animating, setAnimating] = useState(false)
  const [fade, setFade] = useState(1)
  const [weakOnly, setWeakOnly] = useState(false)
  const [searching, setSearching] = useState(false)
  const [prefs, setPrefs] = useState(readPrefs)
  const [outlineMobile, setOutlineMobile] = useState(false)
  const size = useRef({ w: 0, h: 0 })
  const framed = useRef(false)
  const saved = useRef(new Map())
  const busy = useRef(false)

  const setPref = (k, v) =>
    setPrefs((p) => {
      const next = { ...p, [k]: v }
      try {
        localStorage.setItem(PREFS, JSON.stringify(next))
      } catch {
        // Not remembered, still applied.
      }
      return next
    })

  const layout = useMemo(() => radialLayout(graph, focusId, expandedId), [graph, focusId, expandedId])

  const fitFor = useCallback(
    (focus, expanded = null) => fitView(radialLayout(graph, focus, expanded).bounds, size.current.w || 800, size.current.h || 600),
    [graph]
  )

  const onSize = useCallback(
    (s) => {
      size.current = s
      if (!framed.current && s.w > 0) {
        framed.current = true
        setView(fitFor(start.focus))
      }
    },
    [fitFor, start.focus]
  )

  // The address follows the map, so a level can be bookmarked or shared.
  useEffect(() => {
    const url = new URL(window.location.href)
    const at = selectedId && graph.nodes.get(selectedId)?.kind === 'subtopic' ? selectedId : focusId
    if (at === graph.rootId) url.searchParams.delete('at')
    else url.searchParams.set('at', at)
    window.history.replaceState(window.history.state, '', url)
  }, [focusId, selectedId, graph])

  /**
   * Move to another level. Into a child: the map zooms toward it and the new
   * level grows out of it. Up: the map falls back and the parent level
   * settles in round it. Anywhere else: a short cross-fade.
   */
  const travel = useCallback(
    (next, { select = null, restore = true } = {}) => {
      if (busy.current) return
      if (next === focusId) {
        setSelectedId(select)
        return
      }
      saved.current.set(focusId, { view, selectedId, expandedId })
      const memory = restore ? saved.current.get(next) : null
      const target = memory?.view || fitFor(next)
      const nextSelect = select ?? memory?.selectedId ?? null
      const nextExpanded = memory?.expandedId ?? null

      const into = pathTo(graph, next).some((n) => n.id === focusId)
      const outOf = pathTo(graph, focusId).some((n) => n.id === next)
      const { w, h } = size.current
      const around = (v, f) => ({ k: v.k * f, x: w / 2 - (w / 2 - v.x) * f, y: h / 2 - (h / 2 - v.y) * f })

      const land = () => {
        setFocusId(next)
        setSelectedId(nextSelect)
        setExpandedId(nextExpanded)
      }

      if (reduced() || !w) {
        land()
        setView(target)
        return
      }

      busy.current = true
      setAnimating(true)
      setFade(0)
      const there = layout.nodes.find((p) => p.id === next)
      if (into && there) {
        const k = view.k * 2.2
        setView({ k, x: w / 2 - there.x * k, y: h / 2 - there.y * k })
      } else if (outOf) {
        setView(around(view, 0.55))
      }

      setTimeout(() => {
        setAnimating(false)
        land()
        setView(into ? around(target, 0.62) : outOf ? around(target, 1.5) : target)
        // A timer rather than animation frames: frames pause in a background
        // tab, and a paused frame here would leave the map refusing to move.
        setTimeout(() => {
          setAnimating(true)
          setView(target)
          setFade(1)
          setTimeout(() => {
            setAnimating(false)
            busy.current = false
          }, 440)
        }, 30)
      }, 240)
    },
    [focusId, view, selectedId, expandedId, fitFor, graph, layout]
  )

  /** Go to any node: its own level if it has one beneath it, else its parent's. */
  const goTo = useCallback(
    (id) => {
      const n = graph.nodes.get(id)
      if (!n) return
      if (n.kind === 'subject') return travel(graph.rootId, { restore: true })
      travel(n.parentId, { select: id, restore: false })
      setOutlineMobile(false)
    },
    [graph, travel]
  )

  const enter = useCallback((id) => travel(id, { restore: true }), [travel])

  const toggleExpand = useCallback(
    (id) => {
      const next = expandedId === id ? null : id
      setExpandedId(next)
      // Keep the whole level in frame as it grows or shrinks.
      if (!reduced()) setAnimating(true)
      setView(fitFor(focusId, next))
      setTimeout(() => setAnimating(false), 440)
    },
    [expandedId, fitFor, focusId]
  )

  const zoom = (f) => {
    const { w, h } = size.current
    setAnimating(!reduced())
    setView((v) => {
      const k = Math.max(0.3, Math.min(2.4, v.k * f))
      return { k, x: w / 2 - ((w / 2 - v.x) / v.k) * k, y: h / 2 - ((h / 2 - v.y) / v.k) * k }
    })
    setTimeout(() => setAnimating(false), 440)
  }
  const fit = () => {
    setAnimating(!reduced())
    setView(fitFor(focusId, expandedId))
    setTimeout(() => setAnimating(false), 440)
  }

  // Keyboard, while nothing else has the focus of a text field.
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearching(true)
        return
      }
      if (typing || searching) return
      if (e.key === '/') {
        e.preventDefault()
        setSearching(true)
      } else if (e.key === 'Escape') {
        if (selectedId) setSelectedId(null)
        else if (focusId !== graph.rootId) travel(graph.nodes.get(focusId).parentId)
      } else if (e.key === '+' || e.key === '=') zoom(1.25)
      else if (e.key === '-') zoom(0.8)
      else if (e.key === '0') fit()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const relations = useMemo(() => {
    if (!prefs.connections) return null
    const m = new Map()
    for (const leaf of leavesOf(graph, graph.rootId)) {
      const r = related(graph, leaf.id, 4)
      if (r.length) m.set(leaf.id, r.map((x) => x.node.id))
    }
    return m
  }, [graph, prefs.connections])

  const crumbs = pathTo(graph, focusId)
  const focus = graph.nodes.get(focusId)
  const selected = selectedId ? graph.nodes.get(selectedId) : null
  const inspected = selected || null
  const next = recommended(graph, focusId, 4)
  const backHref = typeof window === 'undefined' ? '/dashboard/map' : `/dashboard/map${window.location.search}`

  const inspector = (
    <Inspector
      graph={graph}
      node={inspected}
      subject={graph.subject}
      onGo={goTo}
      onEnter={enter}
      onClose={() => setSelectedId(null)}
      backHref={backHref}
      syllabi={syllabi}
    />
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar */}
      <div className="flex h-14 shrink-0 items-center gap-1.5 border-b px-3 sm:px-4" style={{ borderColor: 'var(--border)' }}>
        <IconButton label={prefs.outline ? 'Hide the outline' : 'Show the outline'} active={prefs.outline} onClick={() => setPref('outline', !prefs.outline)} className="hidden 2xl:flex">
          {svg(<><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M9 4.5v15" /></>)}
        </IconButton>
        <IconButton label="Outline" onClick={() => setOutlineMobile(true)} className="2xl:hidden">
          {svg(<path d="M4 6h16M4 12h16M4 18h10" />)}
        </IconButton>

        {subjects.length > 1 && (
          <Select
            value={graph.subject}
            onChange={(e) => onSubject?.(e.target.value)}
            aria-label="Subject"
            className="h-9 max-w-[11rem] rounded-full border pl-3.5 pr-1.5 text-[13px] font-semibold sm:max-w-[15rem]"
            style={{ borderColor: 'var(--border-strong)' }}
          >
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        )}

        <nav aria-label="Where you are" className="ml-1 hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1
            return (
              <span key={c.id} className="flex min-w-0 items-center gap-1">
                {i > 0 && (
                  <span aria-hidden="true" style={{ color: 'var(--text-faint)' }}>
                    ›
                  </span>
                )}
                {last ? (
                  <span aria-current="page" className="truncate rounded-full px-2 py-1 text-[12.5px] font-semibold" style={{ color: 'var(--text)', maxWidth: 260 }}>
                    {i === 0 ? 'Overview' : c.title}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => travel(c.id)}
                    className="truncate rounded-full px-2 py-1 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-sunken)]"
                    style={{ color: 'var(--text-muted)', maxWidth: 200 }}
                  >
                    {i === 0 ? 'Overview' : c.title}
                  </button>
                )}
              </span>
            )
          })}
        </nav>
        <div className="flex-1 md:hidden" />

        <button
          type="button"
          onClick={() => setSearching(true)}
          className="flex h-9 items-center gap-2 rounded-full border px-3 text-[12.5px] transition-colors hover:bg-[var(--surface-sunken)]"
          style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}
          aria-label="Search the subject"
        >
          {svg(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>, 14)}
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded-[5px] border px-1 text-[10px] sm:inline" style={{ borderColor: 'var(--border-strong)' }}>
            ⌘K
          </kbd>
        </button>
        <IconButton label={prefs.connections ? 'Hide connections' : 'Show connections'} active={prefs.connections} onClick={() => setPref('connections', !prefs.connections)}>
          {svg(<><circle cx="6" cy="7" r="2.5" /><circle cx="18" cy="17" r="2.5" /><path d="M8.2 8.6c3 1.4 5.2 3.6 7.6 6.8" strokeDasharray="2 2.5" /></>)}
        </IconButton>
        <IconButton label={weakOnly ? 'Show everything' : 'Weak areas only'} active={weakOnly} onClick={() => setWeakOnly((v) => !v)}>
          {svg(<><path d="M12 4 3 20h18Z" /><path d="M12 10v4M12 17h.01" /></>)}
        </IconButton>
        <span className="hidden sm:flex">
          <ThemeToggle />
        </span>
        <IconButton label={prefs.inspector ? 'Hide details' : 'Show details'} active={prefs.inspector} onClick={() => setPref('inspector', !prefs.inspector)} className="hidden lg:flex">
          {svg(<><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M15 4.5v15" /></>)}
        </IconButton>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Outline */}
        {prefs.outline && (
          <aside className="hidden w-[272px] shrink-0 border-r 2xl:block" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <Outline graph={graph} focusId={focusId} selectedId={selectedId} weakOnly={weakOnly} onWeakOnly={setWeakOnly} onGo={goTo} />
          </aside>
        )}
        <div className={`fixed inset-0 z-50 2xl:hidden ${outlineMobile ? '' : 'pointer-events-none'}`} aria-hidden={!outlineMobile} inert={!outlineMobile || undefined}>
          <div className="absolute inset-0 bg-black/30 transition-opacity duration-200" style={{ opacity: outlineMobile ? 1 : 0 }} onClick={() => setOutlineMobile(false)} />
          <aside
            className="absolute inset-y-0 left-0 w-[300px] max-w-[85vw] shadow-2xl transition-transform duration-300"
            style={{ background: 'var(--surface)', transform: outlineMobile ? 'none' : 'translateX(-105%)', transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}
          >
            <Outline graph={graph} focusId={focusId} selectedId={selectedId} weakOnly={weakOnly} onWeakOnly={setWeakOnly} onGo={goTo} />
          </aside>
        </div>

        {/* Canvas */}
        <section className="relative min-w-0 flex-1" aria-label={`Map of ${focus.title}`} style={{ background: 'var(--bg)' }}>
          <MapCanvas
            graph={graph}
            focusId={focusId}
            selectedId={selectedId}
            expandedId={expandedId}
            view={view}
            onView={setView}
            animating={animating}
            fade={fade}
            weakOnly={weakOnly}
            showConnections={prefs.connections}
            relations={relations}
            onSelect={setSelectedId}
            onEnter={enter}
            onExpand={toggleExpand}
            onSize={onSize}
            onBackground={() => {
              setSelectedId(null)
            }}
            controls={
              <div className="absolute bottom-4 right-4 flex flex-col overflow-hidden rounded-[12px] border" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
                {[
                  ['Zoom in', 1.25, <path key="a" d="M12 5v14M5 12h14" />],
                  ['Zoom out', 0.8, <path key="b" d="M5 12h14" />],
                  ['Fit to screen', 0, <path key="c" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />],
                ].map(([label, f, d]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => (f ? zoom(f) : fit())}
                    aria-label={label}
                    title={label}
                    className="flex h-9 w-9 items-center justify-center border-b transition-colors last:border-b-0 hover:bg-[var(--surface-sunken)]"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                  >
                    {svg(d, 15)}
                  </button>
                ))}
              </div>
            }
          />

          {focusId !== graph.rootId && (
            <button
              type="button"
              onClick={() => travel(focus.parentId)}
              className="absolute left-4 top-4 flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-medium shadow-sm transition-colors hover:bg-[var(--surface-sunken)]"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-body)' }}
            >
              {svg(<path d="M15 6l-6 6 6 6" />, 14)}
              <span className="max-w-[12rem] truncate">{crumbs.length > 2 ? crumbs.at(-2).title : 'Overview'}</span>
            </button>
          )}

          {/* What to do next, from this level down. */}
          {next.length > 0 &&
            (prefs.strip ? (
              <div
                className="absolute bottom-4 left-1/2 flex max-w-[calc(100%-120px)] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-full border py-1.5 pl-3 pr-1.5 shadow-lg md:max-w-[calc(100%-360px)]"
                style={{ borderColor: 'var(--border-strong)', background: 'color-mix(in oklab, var(--surface) 94%, transparent)', backdropFilter: 'blur(8px)' }}
              >
                <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-faint)' }}>
                  Next
                </span>
                {next.map((n, i) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => goTo(n.id)}
                    title={`${n.title} · ${statusLabel(n.status)}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors hover:bg-[var(--surface-sunken)]"
                    style={{ background: i === 0 ? 'var(--brand-tint)' : undefined, color: 'var(--text-body)' }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_VAR[n.status] }} />
                    <span className="max-w-[11rem] truncate">{n.title}</span>
                  </button>
                ))}
                <button type="button" onClick={() => setPref('strip', false)} aria-label="Hide what is next" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-[var(--surface-sunken)]" style={{ color: 'var(--text-faint)' }}>
                  {svg(<path d="m7 7 10 10M17 7 7 17" />, 12)}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPref('strip', true)}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border px-3.5 py-1.5 text-[12px] font-medium shadow-lg md:left-[calc(50%)]"
                style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-muted)' }}
              >
                What next?
              </button>
            ))}
        </section>

        {/* Details */}
        {prefs.inspector && (
          <aside className="hidden w-[340px] shrink-0 border-l lg:block" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            {inspector}
          </aside>
        )}
        {selected && (
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[62vh] overflow-hidden rounded-t-[20px] border-t shadow-2xl lg:hidden" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)', animation: 'sheet-up 280ms cubic-bezier(0.16,1,0.3,1)' }}>
            <div className="mx-auto mt-2 h-1 w-10 rounded-full" style={{ background: 'var(--border-strong)' }} aria-hidden="true" />
            <div className="h-[calc(62vh-12px)]">{inspector}</div>
          </div>
        )}
      </div>

      <SearchPalette graph={graph} open={searching} onClose={() => setSearching(false)} onGo={goTo} />
    </div>
  )
}
