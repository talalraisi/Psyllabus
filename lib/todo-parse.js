/**
 * "bibliography friday #ee" is one thing to type, not three fields to fill.
 *
 * A to-do list with a title box, a date picker and a subject dropdown is a
 * form, and people stop using forms at eleven at night. So the day and the
 * subject are read out of what was typed and removed from the title.
 *
 * It takes the words with it: "monday meeting notes" becomes "meeting notes"
 * due Monday. That is the right trade for a box people type dates into, and
 * the date is visible on the row afterwards, so a wrong guess is obvious and
 * one click from fixed.
 *
 * Deliberately narrow: today, tomorrow, tonight, a weekday, "in 3 days", and a
 * plain date. No "the friday after next", because a parser that guesses is
 * worse than one that leaves the words where you put them.
 */

const WEEKDAYS = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
}

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
}

export function dayKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const addDays = (date, days) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Pull a day and a subject out of typed text.
 *
 * Returns the cleaned title plus whatever was found. `subjects` is the list
 * the student actually takes, so "#physics" matches "Physics SL" and "#chem"
 * matches nothing when they do not take chemistry — better than inventing a
 * subject nobody can filter by.
 */
export function parseTodoInput(input, { today = new Date(), subjects = [] } = {}) {
  let text = ` ${String(input).trim()} `
  let due = null
  let subject = null

  const take = (pattern, handler) => {
    if (due && handler !== setSubject) return
    const match = text.match(pattern)
    if (!match) return
    const value = handler(match)
    if (value === false) return
    text = text.replace(match[0], ' ')
  }

  function setSubject(match) {
    const typed = match[1].toLowerCase()
    const hit = subjects.find((s) => s.toLowerCase().replace(/[^a-z]/g, '').startsWith(typed.replace(/[^a-z]/g, '')))
    if (!hit) return false
    subject = hit
    return true
  }

  // Subject first: "#physics" cannot be mistaken for a day.
  take(/\s[#@]([a-z][a-z0-9&: -]{1,28}?)(?=\s)/i, setSubject)

  take(/\s(today|tonight)(?=\s)/i, () => {
    due = dayKey(today)
    return true
  })

  take(/\s(tomorrow|tmr|tmrw)(?=\s)/i, () => {
    due = dayKey(addDays(today, 1))
    return true
  })

  take(/\sin (\d{1,2}) ?(?:days?|d)(?=\s)/i, (m) => {
    due = dayKey(addDays(today, parseInt(m[1], 10)))
    return true
  })

  // A weekday means the next one, and "next friday" means the one after that
  // when today is already Friday.
  take(new RegExp(`\\s(?:(next) )?(${Object.keys(WEEKDAYS).join('|')})(?=\\s)`, 'i'), (m) => {
    const target = WEEKDAYS[m[2].toLowerCase()]
    const current = today.getDay()
    let delta = (target - current + 7) % 7
    if (delta === 0) delta = 7
    if (m[1]) delta += 7
    due = dayKey(addDays(today, delta))
    return true
  })

  // 12 Oct, Oct 12, 12/10 (day first, which is what the IB world writes).
  take(new RegExp(`\\s(\\d{1,2})(?:st|nd|rd|th)? (${Object.keys(MONTHS).join('|')})(?=\\s)`, 'i'), (m) => {
    due = dayKey(dateFromParts(today, parseInt(m[1], 10), MONTHS[m[2].toLowerCase()]))
    return true
  })

  take(new RegExp(`\\s(${Object.keys(MONTHS).join('|')}) (\\d{1,2})(?:st|nd|rd|th)?(?=\\s)`, 'i'), (m) => {
    due = dayKey(dateFromParts(today, parseInt(m[2], 10), MONTHS[m[1].toLowerCase()]))
    return true
  })

  take(/\s(\d{1,2})\/(\d{1,2})(?=\s)/, (m) => {
    const day = parseInt(m[1], 10)
    const month = parseInt(m[2], 10) - 1
    if (day > 31 || month > 11) return false
    due = dayKey(dateFromParts(today, day, month))
    return true
  })

  const title = text.replace(/\s+/g, ' ').trim()
  return { title, due_on: due, subject }
}

/** A day and month, in the next twelve months rather than in the past. */
function dateFromParts(today, day, month) {
  const candidate = new Date(today.getFullYear(), month, day)
  if (candidate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    candidate.setFullYear(candidate.getFullYear() + 1)
  }
  return candidate
}

/** Which heading a to-do belongs under. */
export function bucketFor(dueOn, todayKey) {
  if (!dueOn) return 'someday'
  if (dueOn < todayKey) return 'overdue'
  if (dueOn === todayKey) return 'today'
  const days = Math.round(
    (new Date(`${dueOn}T00:00`).getTime() - new Date(`${todayKey}T00:00`).getTime()) / 86400000
  )
  return days <= 7 ? 'week' : 'later'
}

export const BUCKET_LABELS = {
  overdue: 'Overdue',
  today: 'Today',
  week: 'This week',
  later: 'Later',
  someday: 'No date',
}

export const BUCKET_ORDER = ['overdue', 'today', 'week', 'later', 'someday']
