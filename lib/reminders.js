/**
 * Reminders: which nudge, if any, a student gets today, and the email for it.
 *
 * One job runs once a day (app/api/reminders/route.js, 18:00 in Muscat) over
 * reminder_candidates() (scripts/107-reminders.sql). Each student gets at most
 * one nudge, and it is the most useful one going:
 *
 *   start     set up but never studied: their first ten questions (days 1, 3, 7)
 *   due       flashcards or mistakes due and not studied today
 *   comeback  studied before, quiet for three days or more
 *   weekly    Sundays, email only, for anyone with study time or questions this week
 *
 * Nobody is pestered: three nudge days in a row with no study in between and
 * it goes quiet until they come back. Email at most every other day; push at
 * most once a day (the job only runs once anyway).
 *
 * Plain JavaScript with no app imports, so scripts/reminders-preview.mjs can
 * run the same rules locally.
 */

const DAY = 864e5
export const SITE = 'https://www.psyllabus.app'
export const QUIET_AFTER = 3

const days = (a, b) => (a && b ? (new Date(b) - new Date(a)) / DAY : Infinity)
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function examDate(c, now) {
  const s = /^([MN])(\d\d)$/.exec(c.exam_session || '')
  const year = s ? 2000 + Number(s[2]) : parseInt(c.grad_year, 10)
  if (!year) return null
  const d = new Date(Date.UTC(year, s?.[1] === 'N' ? 10 : 4, 1))
  return d > now ? d : null
}

function quizHref({ subject, topic, subtopic }) {
  const p = new URLSearchParams({ subject })
  if (subtopic) {
    p.set('topic', topic || '')
    p.set('subtopic', subtopic)
  } else {
    p.set('mode', 'custom')
    p.set('count', '10')
  }
  p.set('back', '/dashboard')
  return `/dashboard/quiz?${p}`
}

/** The subject to start with: the free one, or the first on the list. */
function firstSubject(c) {
  if (c.free_subject) return c.free_subject
  const list = Array.isArray(c.subjects) ? c.subjects : []
  return list.find((s) => !/Theory of Knowledge|Extended Essay/i.test(s)) || list[0] || null
}

/**
 * The nudge for one student today, or null.
 * Returns { kind, title, body, button, url, email: bool, push: bool }.
 */
export function pickReminder(c, now = new Date()) {
  const sinceActive = days(c.last_active, now)
  const sinceSignup = days(c.created_at, now)
  const canEmail = c.email_reminders && c.email && days(c.last_email_at, now) >= 1.8
  const canPush = c.push_reminders && Array.isArray(c.push_subs) && c.push_subs.length > 0 && days(c.last_push_at, now) >= 0.8
  const exam = examDate(c, now)
  const toExam = exam ? Math.ceil(days(now, exam)) : null
  const name = c.first_name ? `${c.first_name}, ` : ''

  // Sunday: the week in numbers, when there are some.
  if (now.getUTCDay() === 0 && ((c.week_minutes || 0) > 0 || (c.week_questions || 0) > 0) && c.email_reminders && c.email) {
    const mins = c.week_minutes || 0
    const prev = c.prev_week_minutes || 0
    const qs = c.week_questions || 0
    const trend =
      mins > prev ? `That is ${mins - prev} minutes more than the week before.` : prev > 0 && mins < prev ? `The week before was ${prev} minutes. This one can beat it.` : ''
    return {
      kind: 'weekly',
      title: `Your week: ${mins} min, ${plural(qs, 'question')}`,
      body: [
        `${name}you studied ${mins} minutes and answered ${plural(qs, 'question')} this week.`,
        trend,
        toExam ? `${plural(toExam, 'day')} to your exams.` : '',
        c.weak_subtopic ? `Your weakest topic right now is ${c.weak_subtopic}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
      button: 'Plan this week',
      url: '/dashboard/study-plan',
      email: true,
      push: false,
    }
  }

  // Studied today already, or ignored three in a row: leave them be.
  if (sinceActive < 0.75) return null
  if ((c.nudges_since_active || 0) >= QUIET_AFTER) return null
  if (!canEmail && !canPush) return null

  // Never studied: the first ten questions, on days 1, 3 and 7 after sign-up.
  if (!c.ever_studied) {
    const day = Math.floor(sinceSignup)
    const subject = firstSubject(c)
    if (![1, 3, 7].includes(day) || !subject) return null
    return {
      kind: 'start',
      title: day === 1 ? `Your first 10 ${subject} questions` : day === 3 ? 'Five minutes to see where you stand' : 'Still there? Ten questions, five minutes',
      body: `${name}answer ten ${subject} questions and Psyllabus shows which topics you already know and which need work. Your study plan builds itself from that.`,
      button: 'Start the 10 questions',
      url: quizHref({ subject }),
      email: canEmail,
      push: canPush,
    }
  }

  // Cards or mistakes due.
  const cardsDue = c.cards_due || 0
  const mistakesDue = c.mistakes_due || 0
  if (cardsDue + mistakesDue >= 3) {
    const cards = cardsDue >= mistakesDue
    return {
      kind: 'due',
      title: cards ? `${plural(cardsDue, 'flashcard')} due today` : `${plural(mistakesDue, 'mistake')} to try again`,
      body: cards
        ? `${name}reviewing them today, just before you would forget them, is what makes them stick. About ${Math.max(5, Math.round(cardsDue / 4))} minutes.`
        : `${name}questions you got wrong are due another go. Getting them right this time is what moves your mastery.`,
      button: cards ? 'Review flashcards' : 'Redo my mistakes',
      url: cards ? '/dashboard/flashcards' : '/dashboard/quiz?mode=mistakes&back=/dashboard',
      // Push is enough for a daily thing; email only every few days for it.
      email: canEmail && (!canPush || days(c.last_email_at, now) >= 4),
      push: canPush,
    }
  }

  // Quiet for three days or more.
  if (sinceActive >= 3) {
    const weak = c.weak_subtopic ? { subject: c.weak_subject, topic: c.weak_topic, subtopic: c.weak_subtopic } : null
    return {
      kind: 'comeback',
      title: toExam ? `${plural(toExam, 'day')} to your exams` : 'Pick up where you left off',
      body: weak
        ? `${name}your weakest topic right now is ${weak.subtopic}. Five questions on it is a good way back in.`
        : `${name}it has been ${plural(Math.floor(sinceActive), 'day')}. Ten minutes today keeps everything you have learned from fading.`,
      button: weak ? `Practise ${weak.subtopic}` : 'Open my plan for today',
      url: weak ? quizHref(weak) : '/dashboard',
      email: canEmail,
      push: canPush,
    }
  }

  return null
}

/* ---- Email ---- */

const LIGHT = { page: '#f7f4ec', card: '#fdfbf3', border: '#eae5da', text: '#1d1a13', body: '#443f33', muted: '#635c4a', link: '#2d6a4f' }
const DARK = { page: '#141414', card: '#191919', border: '#2b2b2b', text: '#f0f0f0', body: '#c9c9c9', muted: '#a1a1a1', link: '#7cc0a0' }
const BUTTON = '#2d6a4f'
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif"

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])

const darkRules = (prefix) =>
  [
    `${prefix}.e-page{background:${DARK.page}!important}`,
    `${prefix}.e-card{background:${DARK.card}!important;border-color:${DARK.border}!important}`,
    `${prefix}.e-text{color:${DARK.text}!important}`,
    `${prefix}.e-body{color:${DARK.body}!important}`,
    `${prefix}.e-muted{color:${DARK.muted}!important}`,
    `${prefix}.e-link{color:${DARK.link}!important}`,
  ].join('\n')

/** The email for a reminder, in the same look as the sign-in emails. */
export function reminderEmail(r, { unsubscribeUrl }) {
  const href = SITE + r.url
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${esc(r.title)}</title>
<style>
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
${darkRules('')}
}
${darkRules('[data-ogsc] ')}
</style>
</head>
<body class="e-page" style="margin:0;padding:0;background:${LIGHT.page};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(r.body.slice(0, 110))}</span>
<table role="presentation" class="e-page" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT.page};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" class="e-card" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${LIGHT.card};border-radius:16px;border:1px solid ${LIGHT.border};">
<tr><td style="padding:32px 32px 8px 32px;"><img src="${SITE}/icon-192.png" width="44" height="44" alt="Psyllabus" style="display:block;border-radius:10px;" /></td></tr>
<tr><td style="padding:16px 32px 0 32px;font-family:${FONT};">
<h1 class="e-text" style="margin:0;font-size:22px;line-height:1.25;font-weight:600;color:${LIGHT.text};letter-spacing:-0.01em;">${esc(r.title)}</h1>
<p class="e-body" style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:${LIGHT.body};">${esc(r.body)}</p>
</td></tr>
<tr><td style="padding:24px 32px 32px 32px;">
<a href="${esc(href)}" style="display:inline-block;background:${BUTTON};color:#ffffff;text-decoration:none;font-family:${FONT};font-size:15px;font-weight:600;padding:13px 22px;border-radius:999px;">${esc(r.button)}</a>
</td></tr>
</table>
<p class="e-muted" style="margin:18px 0 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${LIGHT.muted};">
You get these because you study with Psyllabus. <a class="e-link" href="${esc(unsubscribeUrl)}" style="color:${LIGHT.link};">Stop reminder emails</a><br />
Project Syllabus · psyllabus.app · Muscat, Oman</p>
</td></tr>
</table>
</body>
</html>
`
  const text = `${r.title}\n\n${r.body}\n\n${r.button}: ${href}\n\nStop reminder emails: ${unsubscribeUrl}\n`
  return { subject: r.title, html, text }
}
