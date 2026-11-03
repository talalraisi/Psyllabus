/**
 * Writes supabase/email-templates/*.html, the emails Supabase sends.
 *
 *   node scripts/email-templates.mjs
 *
 * One layout for all four, so they stay alike. Each email follows the
 * reader's light or dark mode (Apple Mail, iOS Mail, Outlook; Gmail's apps
 * darken it themselves), in the app's own colours.
 *
 * The buttons go to /auth/confirm with a one-time token, which the server
 * checks, so they work in any browser: the mail app's own, or another phone.
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const DIR = fileURLToPath(new URL('../supabase/email-templates/', import.meta.url))

// The app's colours (app/globals.css), light and dark.
const LIGHT = { page: '#f7f4ec', card: '#fdfbf3', border: '#eae5da', text: '#1d1a13', body: '#443f33', muted: '#635c4a', link: '#2d6a4f' }
const DARK = { page: '#141414', card: '#191919', border: '#2b2b2b', text: '#f0f0f0', body: '#c9c9c9', muted: '#a1a1a1', link: '#7cc0a0' }
const BUTTON = '#2d6a4f'
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif"

const link = (type, next) => `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}&amp;next=${next}`

const EMAILS = [
  {
    file: 'confirm-signup.html',
    subject: 'Confirm your email for Psyllabus',
    preheader: 'One tap and your account is ready.',
    title: 'Confirm your email',
    body: 'Welcome to Psyllabus. Confirm this is your email address and your account is ready: your subjects, your plan and everything you prove from here on.',
    button: 'Confirm my email',
    href: link('email', '/onboarding'),
    note: 'If you did not sign up for Psyllabus, ignore this email and nothing happens.',
  },
  {
    file: 'reset-password.html',
    subject: 'Reset your Psyllabus password',
    preheader: 'Choose a new password.',
    title: 'Reset your password',
    body: 'Someone asked to reset the password for the Psyllabus account at {{ .Email }}. If it was you, choose a new one. The link works once and for an hour.',
    button: 'Choose a new password',
    href: link('recovery', '/reset-password'),
    note: 'If you did not ask for this, ignore this email. Your password stays as it is.',
  },
  {
    file: 'change-email.html',
    subject: 'Confirm your new email for Psyllabus',
    preheader: 'Confirm the change of email address.',
    title: 'Confirm your new email',
    body: 'Your Psyllabus account is moving from {{ .Email }} to {{ .NewEmail }}. Confirm to finish the change.',
    button: 'Confirm new email',
    href: link('email_change', '/dashboard/profile'),
    note: 'If you did not ask to change your email, ignore this and nothing changes.',
  },
  {
    file: 'magic-link.html',
    subject: 'Your Psyllabus sign-in link',
    preheader: 'Your link to sign in.',
    title: 'Sign in to Psyllabus',
    body: 'Here is your link to sign in. It works once and for an hour.',
    button: 'Sign in',
    href: link('email', '/dashboard'),
    note: 'If you did not ask to sign in, ignore this email.',
  },
]

// Dark mode by class, since the colours are inline. [data-ogsc] is Outlook.com.
const darkRules = (prefix) =>
  [
    `${prefix}.e-page{background:${DARK.page}!important}`,
    `${prefix}.e-card{background:${DARK.card}!important;border-color:${DARK.border}!important}`,
    `${prefix}.e-text{color:${DARK.text}!important}`,
    `${prefix}.e-body{color:${DARK.body}!important}`,
    `${prefix}.e-muted{color:${DARK.muted}!important}`,
    `${prefix}.e-link{color:${DARK.link}!important}`,
  ].join('\n      ')

const page = (e) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${e.title}</title>
    <style>
      :root { color-scheme: light dark; supported-color-schemes: light dark; }
      @media (prefers-color-scheme: dark) {
      ${darkRules('')}
      }
      ${darkRules('[data-ogsc] ')}
    </style>
  </head>
  <body class="e-page" style="margin:0;padding:0;background:${LIGHT.page};">
    <!-- Made by scripts/email-templates.mjs. Supabase → Authentication → Emails → Templates. Subject: ${e.subject} -->
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${e.preheader}</span>
    <table role="presentation" class="e-page" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT.page};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" class="e-card" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${LIGHT.card};border-radius:16px;border:1px solid ${LIGHT.border};">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <img src="https://www.psyllabus.app/icon-192.png" width="44" height="44" alt="Psyllabus" style="display:block;border-radius:10px;" />
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 0 32px;font-family:${FONT};">
                <h1 class="e-text" style="margin:0;font-size:22px;line-height:1.25;font-weight:600;color:${LIGHT.text};letter-spacing:-0.01em;">${e.title}</h1>
                <p class="e-body" style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:${LIGHT.body};">${e.body}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px 32px;">
                <a href="${e.href}" style="display:inline-block;background:${BUTTON};color:#ffffff;text-decoration:none;font-family:${FONT};font-size:15px;font-weight:600;padding:13px 22px;border-radius:999px;">${e.button}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 32px 32px;font-family:${FONT};">
                <p class="e-muted" style="margin:0;font-size:13px;line-height:1.6;color:${LIGHT.muted};">${e.note}</p>
                <p class="e-muted" style="margin:14px 0 0 0;font-size:12px;line-height:1.6;color:${LIGHT.muted};word-break:break-all;">If the button does not work, open this link:<br /><a class="e-link" href="${e.href}" style="color:${LIGHT.link};">${e.href}</a></p>
              </td>
            </tr>
          </table>
          <p class="e-muted" style="margin:18px 0 0 0;font-family:${FONT};font-size:12px;color:${LIGHT.muted};">Project Syllabus · psyllabus.app · Muscat, Oman</p>
        </td>
      </tr>
    </table>
  </body>
</html>
`

for (const e of EMAILS) {
  writeFileSync(DIR + e.file, page(e))
  console.log(`${e.file}  —  ${e.subject}`)
}
