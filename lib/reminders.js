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

const SESSION_NAME = (c) => {
  const s = /^([MN])(\d\d)$/.exec(c.exam_session || '')
  return s ? `${s[1] === 'N' ? 'November' : 'May'} 20${s[2]}` : c.grad_year ? `${c.grad_year}` : ''
}

/**
 * The nudge for one student today, or null. Returns
 *   { kind, eyebrow, title, body, stats: [{ value, label }], button, note,
 *     url, push: { title, body }, email: bool, sendPush: bool }
 * The email shows all of it; a notification only push.title and push.body.
 */
export function pickReminder(c, now = new Date()) {
  const sinceActive = days(c.last_active, now)
  const sinceSignup = days(c.created_at, now)
  const canEmail = Boolean(c.email_reminders && c.email && days(c.last_email_at, now) >= 1.8)
  const canPush = Boolean(c.push_reminders && Array.isArray(c.push_subs) && c.push_subs.length > 0 && days(c.last_push_at, now) >= 0.8)
  const exam = examDate(c, now)
  const toExam = exam ? Math.ceil(days(now, exam)) : null
  const examStat = toExam ? { value: toExam, label: `days to ${SESSION_NAME(c)} exams` } : null
  const hi = c.first_name ? `Hi ${c.first_name},` : 'Hi,'

  // Sunday: the week in numbers, when there are some.
  if (now.getUTCDay() === 0 && ((c.week_minutes || 0) > 0 || (c.week_questions || 0) > 0) && c.email_reminders && c.email) {
    const mins = c.week_minutes || 0
    const prev = c.prev_week_minutes || 0
    const qs = c.week_questions || 0
    const up = mins > prev
    return {
      kind: 'weekly',
      hi,
      eyebrow: 'Your week',
      title: up && prev > 0 ? 'A better week than the last' : up ? 'A good start to your revision' : 'Here is your week',
      stats: [
        { value: mins, label: 'minutes studied' },
        { value: qs, label: qs === 1 ? 'question answered' : 'questions answered' },
        prev > 0 && mins !== prev ? { value: `${up ? '+' : '−'}${Math.abs(mins - prev)}`, label: up ? 'more minutes than last week' : 'fewer minutes than last week' } : examStat,
      ].filter(Boolean),
      body: [
        up ? 'Keep the same rhythm and it adds up fast.' : prev > 0 ? `Last week was ${prev} minutes. This week can beat it.` : '',
        c.weak_subtopic ? `Worth a look this week: ${c.weak_subtopic}, your weakest topic right now.` : '',
      ]
        .filter(Boolean)
        .join(' '),
      button: 'Plan my week',
      note: 'Your plan fits around your free time',
      url: '/dashboard/study-plan',
      push: { title: `Your week: ${mins} min`, body: `${plural(qs, 'question')} answered. See your plan for next week.` },
      email: true,
      sendPush: false,
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
      hi,
      eyebrow: 'Get started',
      title: day === 1 ? `See where you stand in ${subject}` : day === 3 ? 'Five minutes to find your weak spots' : 'Ten questions is all it takes',
      stats: [
        { value: 10, label: 'questions' },
        { value: 5, label: 'minutes' },
        examStat,
      ].filter(Boolean),
      body: `Answer ten ${subject} questions and Psyllabus shows which topics you already know and which need work. Your study plan builds itself from the result.`,
      button: 'Start the 10 questions',
      note: 'No timer, no pressure',
      url: quizHref({ subject }),
      push: { title: `See where you stand in ${subject}`, body: 'Ten questions, five minutes. Your plan builds itself from the result.' },
      email: canEmail,
      sendPush: canPush,
    }
  }

  // Cards or mistakes due.
  const cardsDue = c.cards_due || 0
  const mistakesDue = c.mistakes_due || 0
  if (cardsDue + mistakesDue >= 3) {
    const cards = cardsDue >= mistakesDue
    const mins = cards ? Math.max(5, Math.round(cardsDue / 4)) : Math.max(5, Math.round(mistakesDue * 1.5))
    return {
      kind: 'due',
      hi,
      eyebrow: 'Due today',
      title: cards ? 'Your flashcards are ready' : 'Time to fix a few mistakes',
      stats: [
        cards ? { value: cardsDue, label: cardsDue === 1 ? 'flashcard due' : 'flashcards due' } : { value: mistakesDue, label: mistakesDue === 1 ? 'mistake to redo' : 'mistakes to redo' },
        { value: mins, label: 'minutes' },
        examStat,
      ].filter(Boolean),
      body: cards
        ? 'Reviewing them today, just before you would forget them, is what makes them stick for the exam.'
        : 'These are questions you got wrong before. Getting them right this time is what moves your mastery.',
      button: cards ? 'Review my flashcards' : 'Redo my mistakes',
      note: `About ${mins} minutes`,
      url: cards ? '/dashboard/flashcards' : '/dashboard/quiz?mode=mistakes&back=/dashboard',
      push: cards
        ? { title: `${plural(cardsDue, 'flashcard')} due`, body: `About ${mins} minutes. Review them before they slip.` }
        : { title: `${plural(mistakesDue, 'mistake')} to redo`, body: `About ${mins} minutes. Get them right this time.` },
      // Push is enough for a daily thing; email only every few days for it.
      email: canEmail && (!canPush || days(c.last_email_at, now) >= 4),
      sendPush: canPush,
    }
  }

  // Quiet for three days or more.
  if (sinceActive >= 3) {
    const weak = c.weak_subtopic ? { subject: c.weak_subject, topic: c.weak_topic, subtopic: c.weak_subtopic } : null
    const quiet = Math.floor(sinceActive)
    return {
      kind: 'comeback',
      hi,
      eyebrow: 'Pick up again',
      title: weak ? `Get back in with ${weak.subtopic}` : 'Ten minutes keeps it fresh',
      stats: [examStat, { value: quiet, label: 'days since you studied' }].filter(Boolean),
      body: weak
        ? `It is your weakest topic right now, so it is where a few questions do the most. Five is a good way back in.`
        : 'What you learned fades a little each day you leave it. A short session today brings it back.',
      button: weak ? `Practise ${weak.subtopic}` : 'Open today’s plan',
      note: 'About 10 minutes',
      url: weak ? quizHref(weak) : '/dashboard',
      push: toExam
        ? { title: `${plural(toExam, 'day')} to your exams`, body: weak ? `Five questions on ${weak.subtopic} is a good way back in.` : 'Ten minutes today keeps it all fresh.' }
        : { title: 'Pick up where you left off', body: weak ? `Five questions on ${weak.subtopic}.` : 'Ten minutes today keeps it all fresh.' },
      email: canEmail,
      sendPush: canPush,
    }
  }

  return null
}

/* ---- Email ---- */

const LIGHT = { page: '#f7f4ec', card: '#fdfbf3', border: '#eae5da', text: '#1d1a13', body: '#443f33', muted: '#635c4a', link: '#2d6a4f', brand: '#2d6a4f', tint: '#ecf1e8' }
const DARK = { page: '#141414', card: '#191919', border: '#2b2b2b', text: '#f0f0f0', body: '#c9c9c9', muted: '#a1a1a1', link: '#7cc0a0', brand: '#7cc0a0', tint: '#1f2a23' }
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
    `${prefix}.e-brand{color:${DARK.brand}!important}`,
    `${prefix}.e-tint{background:${DARK.tint}!important}`,
    `${prefix}.e-rule{border-color:${DARK.border}!important}`,
  ].join('\n')

function statsRow(stats) {
  if (!stats?.length) return ''
  const w = Math.floor(100 / stats.length)
  const cells = stats
    .map(
      (st, i) => `<td class="e-tint" width="${w}%" valign="top" style="background:${LIGHT.tint};border-radius:12px;padding:14px 14px 12px 14px;">
<div class="e-brand" style="font-family:${FONT};font-size:28px;line-height:1;font-weight:700;letter-spacing:-0.02em;color:${LIGHT.brand};">${esc(st.value)}</div>
<div class="e-muted" style="font-family:${FONT};font-size:12px;line-height:1.35;margin-top:6px;color:${LIGHT.muted};">${esc(st.label)}</div>
</td>${i < stats.length - 1 ? '<td width="8" style="font-size:0;line-height:0;">&nbsp;</td>' : ''}`,
    )
    .join('')
  return `<tr><td class="e-pad" style="padding:20px 32px 0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table></td></tr>`
}

/** The email for a reminder, in the same colours as the app and the sign-in emails. */
export function reminderEmail(r, { unsubscribeUrl }) {
  const href = SITE + r.url
  const preheader = r.push?.body || r.body
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
@media (max-width: 480px) { .e-pad { padding-left: 22px !important; padding-right: 22px !important; } }
</style>
</head>
<body class="e-page" style="margin:0;padding:0;background:${LIGHT.page};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</span>
<table role="presentation" class="e-page" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT.page};padding:28px 12px;">
<tr><td align="center">
<table role="presentation" class="e-card" width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;background:${LIGHT.card};border-radius:18px;border:1px solid ${LIGHT.border};">
<tr><td class="e-pad" style="padding:26px 32px 0 32px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="middle"><img src="${SITE}/icon-192.png" width="30" height="30" alt="" style="display:block;border-radius:8px;" /></td>
<td valign="middle" class="e-text" style="padding-left:10px;font-family:${FONT};font-size:15px;font-weight:650;letter-spacing:-0.01em;color:${LIGHT.text};">Psyllabus</td>
</tr></table>
</td></tr>
<tr><td class="e-pad" style="padding:26px 32px 0 32px;font-family:${FONT};">
<p class="e-brand" style="margin:0;font-size:11.5px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${LIGHT.brand};">${esc(r.eyebrow)}</p>
<h1 class="e-text" style="margin:8px 0 0 0;font-size:25px;line-height:1.2;font-weight:700;color:${LIGHT.text};letter-spacing:-0.02em;">${esc(r.title)}</h1>
</td></tr>
${statsRow(r.stats)}
<tr><td class="e-pad" style="padding:20px 32px 0 32px;font-family:${FONT};">
<p class="e-body" style="margin:0;font-size:15px;line-height:1.6;color:${LIGHT.body};">${esc(r.hi)}</p>
<p class="e-body" style="margin:8px 0 0 0;font-size:15px;line-height:1.6;color:${LIGHT.body};">${esc(r.body)}</p>
</td></tr>
<tr><td class="e-pad" style="padding:24px 32px 30px 32px;font-family:${FONT};">
<a href="${esc(href)}" style="display:inline-block;background:${BUTTON};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 24px;border-radius:999px;">${esc(r.button)} &rarr;</a>
${r.note ? `<p class="e-muted" style="margin:10px 0 0 4px;font-size:12.5px;color:${LIGHT.muted};">${esc(r.note)}</p>` : ''}
</td></tr>
</table>
<p class="e-muted" style="margin:18px 0 0 0;max-width:460px;font-family:${FONT};font-size:12px;line-height:1.6;color:${LIGHT.muted};">
You get these because you revise with Psyllabus. At most one every couple of days.<br />
<a class="e-link" href="${esc(unsubscribeUrl)}" style="color:${LIGHT.link};">Stop reminder emails</a> &nbsp;·&nbsp; <a class="e-link" href="${SITE}/dashboard/profile" style="color:${LIGHT.link};">Reminder settings</a><br />
Project Syllabus · psyllabus.app · Muscat, Oman</p>
</td></tr>
</table>
</body>
</html>
`
  const stats = (r.stats || []).map((st) => `${st.value} ${st.label}`).join(' · ')
  const text = `${r.eyebrow.toUpperCase()}\n${r.title}\n${stats ? `\n${stats}\n` : ''}\n${r.hi}\n${r.body}\n\n${r.button}: ${href}\n${r.note || ''}\n\nStop reminder emails: ${unsubscribeUrl}\n`
  // The subject is the notification's title: short, and it leads with the number.
  return { subject: r.push.title, html, text }
}
