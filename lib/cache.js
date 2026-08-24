/**
 * Client-side cache for the two things every dashboard page needs.
 *
 * Before this, opening any page cost three sequential round trips to Supabase
 * before a pixel of real content appeared: verify the user, read the profile,
 * then read the data. From Oman to the Singapore region that is most of a
 * second of pure waiting, repeated on every single navigation.
 *
 * Two rules make it fast:
 *
 *   Syllabus content is reference data. It is identical for every student and
 *   changes only when a migration runs, so it is cached for a day.
 *
 *   The profile is per-student and does change, so it is served instantly from
 *   cache and revalidated in the background. A stale name for one second is a
 *   fair trade for a page that opens immediately.
 *
 * Everything lives in sessionStorage, so it dies with the tab and never leaks
 * between accounts on a shared computer. Signing out clears it outright.
 */

const MEMORY = new Map()

const TTL = {
  profile: 60_000, // one minute, plus background revalidation
  syllabus: 86_400_000, // one day; only a migration changes it
}

function read(key) {
  const hit = MEMORY.get(key)
  if (hit) return hit
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    MEMORY.set(key, parsed)
    return parsed
  } catch {
    return null
  }
}

function write(key, value) {
  const entry = { at: Date.now(), value }
  MEMORY.set(key, entry)
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // Quota or private mode. The in-memory copy still helps within the page.
  }
}

function fresh(entry, ttl) {
  return entry && Date.now() - entry.at < ttl
}

/** Wipe everything. Call on sign-out so the next account starts clean. */
export function clearCache() {
  MEMORY.clear()
  if (typeof window === 'undefined') return
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('psy:')) sessionStorage.removeItem(key)
    }
  } catch {
    /* nothing to clear */
  }
}

/**
 * The student's profile.
 *
 * Returns the cached copy immediately when there is one and refreshes it in
 * the background, calling `onFresh` only if the data actually changed. The
 * caller renders once from cache and at most once more from the server.
 */
export async function getProfile(supabase, userId, { onFresh } = {}) {
  const key = `psy:profile:${userId}`
  const entry = read(key)

  const fetchFresh = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) return null
    write(key, data)
    return data
  }

  if (fresh(entry, TTL.profile)) return entry.value

  if (entry) {
    // Serve stale, revalidate behind it.
    fetchFresh().then((data) => {
      if (data && onFresh && JSON.stringify(data) !== JSON.stringify(entry.value)) {
        onFresh(data)
      }
    })
    return entry.value
  }

  return fetchFresh()
}

/** Drop the cached profile so the next read hits the server. */
export function invalidateProfile(userId) {
  const key = `psy:profile:${userId}`
  MEMORY.delete(key)
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* nothing to remove */
  }
}

/**
 * Syllabus rows for a set of subjects.
 *
 * Cached per subject, so adding a seventh subject fetches only that one rather
 * than re-downloading the six already held.
 */
export async function getSyllabus(supabase, subjects = []) {
  if (!subjects.length) return []

  const held = []
  const missing = []
  for (const subject of subjects) {
    const entry = read(`psy:syllabus:${subject}`)
    if (fresh(entry, TTL.syllabus)) held.push(...entry.value)
    else missing.push(subject)
  }

  if (!missing.length) return held

  const { data, error } = await supabase
    .from('syllabus_content')
    .select('id, subject, topic, subtopic, hl_only')
    .in('subject', missing)
  if (error) return held

  const bySubject = new Map(missing.map((s) => [s, []]))
  for (const row of data || []) bySubject.get(row.subject)?.push(row)
  for (const [subject, rows] of bySubject) write(`psy:syllabus:${subject}`, rows)

  return [...held, ...(data || [])]
}
