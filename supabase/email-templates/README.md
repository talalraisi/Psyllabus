# Email from psyllabus.app

The app's sign-up, password and email-change emails, sent from
`hello@psyllabus.app` through Resend, with these templates. And a
`hello@psyllabus.app` address you can read and send from in Gmail.

Supabase's built-in sender is for testing only: it allows a few emails an
hour and sends from Supabase's address. A class signing up at once would
hit the limit and most would never get their confirmation email.

## 1. Resend (sends the emails)

1. Sign up at resend.com.
2. **Domains → Add domain →** `psyllabus.app`, region nearest you.
3. Resend shows DNS records (a DKIM `TXT` at `resend._domainkey`, and an
   `MX` and a `TXT` on the `send` subdomain). Add each one at Namecheap:
   **Domain List → psyllabus.app → Manage → Advanced DNS → Add new record.**
   Use the Host exactly as Resend shows it, without `.psyllabus.app` on the
   end. These sit on `send.` and `resend._domainkey`, so the existing email
   forwarding records are untouched.
4. Back in Resend press **Verify**. It can take a few minutes, sometimes an hour.
5. **API Keys → Create API key**, permission *Sending access*. Copy it; you
   will paste it into Supabase and Gmail only, never anywhere else.

## 2. Supabase (uses Resend)

1. **Authentication → Emails → SMTP Settings → Enable custom SMTP:**
   - Sender email: `hello@psyllabus.app`
   - Sender name: `Psyllabus`
   - Host: `smtp.resend.com`  Port: `465`
   - Username: `resend`  Password: the Resend API key
2. **Authentication → Rate Limits →** emails sent per hour: `100`.
3. **Authentication → URL Configuration:** Site URL
   `https://www.psyllabus.app`, and under Redirect URLs
   `https://www.psyllabus.app/**` and `https://psyllabus.app/**`.
4. **Authentication → Emails → Templates:** for each one below, paste the
   subject and the whole file into the template's box.

| Supabase template | Subject | File |
|---|---|---|
| Confirm signup | Confirm your email for Psyllabus | `confirm-signup.html` |
| Reset password | Reset your Psyllabus password | `reset-password.html` |
| Change email address | Confirm your new email for Psyllabus | `change-email.html` |
| Magic link | Your Psyllabus sign-in link | `magic-link.html` |

5. Sign up with a spare email to check it arrives from `hello@psyllabus.app`
   and the button lands you in onboarding.

## 3. Your own hello@psyllabus.app

**Receiving (free, Namecheap):** Domain List → psyllabus.app → Manage →
**Redirect Email → Add forwarder:** alias `hello`, forward to your Gmail.
Add any others you want the same way (`support`, `talal`, …).

**Sending from Gmail (free, through Resend):** Gmail → Settings → See all
settings → **Accounts and Import → Send mail as → Add another email
address:** name `Psyllabus`, email `hello@psyllabus.app`, untick *Treat as
an alias*. Then SMTP server `smtp.resend.com`, port `465`, username
`resend`, password the Resend API key, *Secured connection using SSL*.
Gmail emails a code to `hello@psyllabus.app`, which forwards back to you:
enter it. When writing, choose `hello@psyllabus.app` in the From line.

A full inbox of its own (a separate login, not your Gmail) is Google
Workspace (about $7 a month) or Zoho Mail's free plan; either replaces the
Namecheap forwarding MX records, and leaves the Resend ones as they are.
