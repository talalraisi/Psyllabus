'use client'

/**
 * The to-do list, shared across the whole dashboard.
 *
 * Every list used to load and keep its own copy, so a task added on the study
 * plan did not appear in the list under it on the home page until a reload,
 * and nothing else (the sidebar, the calendar) could see the list at all. Now
 * there is one copy per signed-in student, loaded once and kept current, and
 * anything can subscribe to it.
 *
 * Every change is applied on screen first and rolled back if the database
 * refuses. A delete waits a few seconds before it reaches the database, so it
 * can be undone.
 */

import { useEffect, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { dayKey } from '@/lib/todo-parse'

const UNDO_MS = 5000

const state = { userId: null, todos: [], loaded: false, error: '', removed: null }
const listeners = new Set()
let loading = null
let removeTimer = null

// A new object on every change and the same one otherwise, which is what
// useSyncExternalStore needs to know when to re-render.
let snapshot = { ...state }
const EMPTY = { ...state }

function emit() {
  snapshot = { ...state, todos: [...state.todos] }
  for (const fn of listeners) fn(snapshot)
}

function set(next) {
  Object.assign(state, next)
  emit()
}

function sort(list) {
  return [...list].sort((a, b) => a.position - b.position || String(b.created_at || '').localeCompare(String(a.created_at || '')))
}

/**
 * Development previews only: a list held in memory with nothing sent
 * anywhere, so the to-do screens can be looked at without signing in.
 */
const PREVIEW = 'preview'
export function previewTodos(list) {
  if (process.env.NODE_ENV === 'production') return
  set({ userId: PREVIEW, todos: sort(list), loaded: true, error: '' })
}
const offline = () => state.userId === PREVIEW
const db = () => (offline() ? null : createClient().from('todos'))

/** Load once; later callers share the same read. */
export function loadTodos({ force = false } = {}) {
  if (loading && !force) return loading
  if ((state.loaded && !force) || offline()) return Promise.resolve(state)
  const supabase = createClient()
  loading = (async () => {
    const user = await getCurrentUser(supabase)
    if (!user) {
      set({ userId: null, todos: [], loaded: true })
      return state
    }
    const { data, error } = await supabase.from('todos').select('*').eq('user_id', user.id)
    set({ userId: user.id, todos: error ? state.todos : sort(data || []), loaded: true, error: error ? error.message : '' })
    return state
  })().finally(() => {
    loading = null
  })
  return loading
}

/** Subscribe to the list. */
export function subscribeTodos(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Load, or reload if a different student is now signed in on this tab: the
 * list is kept in memory, and it must never show one account's tasks to the
 * next.
 */
async function ensureFresh() {
  if (offline()) return
  if (!state.loaded) return loadTodos()
  const user = await getCurrentUser(createClient())
  if ((user?.id || null) !== state.userId) return loadTodos({ force: true })
}

/** The shared list in a component: { todos, loaded, userId, error, removed }. */
export function useTodos() {
  const value = useSyncExternalStore(subscribeTodos, () => snapshot, () => EMPTY)
  useEffect(() => {
    ensureFresh()
  }, [])
  return value
}

export async function addTodo({ title, due_on = null, subject = null, note = null }) {
  if (!state.userId) await loadTodos()
  const userId = state.userId
  const clean = String(title || '').trim().slice(0, 200)
  if (!clean || !userId) return false
  const position = state.todos.length ? Math.min(...state.todos.map((t) => t.position)) - 1 : 0
  const provisional = { id: `pending-${crypto.randomUUID()}`, user_id: userId, title: clean, done: false, due_on, subject, note, position, pending: true, created_at: new Date().toISOString() }
  set({ todos: sort([provisional, ...state.todos]), error: '' })
  if (offline()) {
    set({ todos: state.todos.map((t) => (t.id === provisional.id ? { ...t, id: crypto.randomUUID(), pending: false } : t)) })
    return true
  }
  const { data, error } = await db()
    .insert({ user_id: userId, title: clean, due_on, subject, note, position })
    .select()
    .single()
  if (error) {
    set({ todos: state.todos.filter((t) => t.id !== provisional.id), error: error.message })
    return false
  }
  set({ todos: sort(state.todos.map((t) => (t.id === provisional.id ? data : t))) })
  return true
}

export async function patchTodo(todo, changes) {
  if (String(todo.id).startsWith('pending-')) return
  const before = state.todos.find((t) => t.id === todo.id) || todo
  set({ todos: sort(state.todos.map((t) => (t.id === todo.id ? { ...t, ...changes } : t))), error: '' })
  if (offline()) return
  const { error } = await db().update(changes).eq('id', todo.id)
  if (error) set({ todos: sort(state.todos.map((t) => (t.id === todo.id ? before : t))), error: error.message })
}

export function toggleTodo(todo) {
  // done_at is stamped by the database's trigger.
  return patchTodo(todo, { done: !todo.done })
}

/** Several at once, e.g. every overdue task moved to today. */
export async function patchTodos(list, changes) {
  const ids = list.map((t) => t.id).filter((id) => !String(id).startsWith('pending-'))
  if (!ids.length) return
  const before = state.todos
  set({ todos: sort(state.todos.map((t) => (ids.includes(t.id) ? { ...t, ...changes } : t))), error: '' })
  if (offline()) return
  const { error } = await db().update(changes).in('id', ids)
  if (error) set({ todos: before, error: error.message })
}

/** Commit a delete that has been waiting for its undo window. */
async function commitRemove() {
  clearTimeout(removeTimer)
  removeTimer = null
  const pending = state.removed
  if (!pending) return
  set({ removed: null })
  if (offline()) return
  const { error } = await db().delete().eq('id', pending.todo.id)
  if (error) set({ todos: sort([...state.todos, pending.todo]), error: error.message })
}

/** Off the list now, deleted in a few seconds unless undone. */
export function removeTodo(todo) {
  if (state.removed) commitRemove()
  set({ todos: state.todos.filter((t) => t.id !== todo.id), removed: { todo, at: Date.now() } })
  removeTimer = setTimeout(commitRemove, UNDO_MS)
  // Leaving the page should not lose the delete.
  if (typeof window !== 'undefined') window.addEventListener('pagehide', commitRemove, { once: true })
}

export function undoRemove() {
  const pending = state.removed
  if (!pending) return
  clearTimeout(removeTimer)
  removeTimer = null
  set({ todos: sort([...state.todos, pending.todo]), removed: null })
}

export function clearTodoError() {
  set({ error: '' })
}

/** Open and due today or earlier: what the sidebar counts. */
export function dueNowCount(todos, today = dayKey(new Date())) {
  return todos.filter((t) => !t.done && t.due_on && t.due_on <= today).length
}

/** Open to-dos by day, for the calendar. */
export function todosByDay(todos) {
  const map = new Map()
  for (const t of todos) {
    if (!t.due_on || t.done) continue
    if (!map.has(t.due_on)) map.set(t.due_on, [])
    map.get(t.due_on).push(t)
  }
  return map
}
