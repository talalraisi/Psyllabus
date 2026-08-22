# PSyllabus setup

Everything you need to run, fill, and ship the app. Follow in order.

---

## 1. Database (required — nothing works without this)

The app reads from Supabase. One command applies every migration and seed.

**Get your connection string once:**

1. Supabase dashboard → your project → **Project Settings** → **Database**
2. Scroll to **Connection string** → **URI** tab → copy it
3. Replace `[YOUR-PASSWORD]` with your database password (same section, "Reset database password" if you never set one)
4. Add it as a new line in `.env.local`:

```
DATABASE_URL=postgresql://postgres.xxxx:YOURPASSWORD@aws-0-region.pooler.supabase.com:5432/postgres
```

`.env.local` is gitignored, so this never leaves your machine.

**Then run:**

```bash
npm run setup-db
```

This applies migrations 001 and 003–008 in order, records what it applied, and is safe to
re-run. It prints how many subtopics, questions, and schools you ended up with.

**Give yourself staff access** so the School dashboard opens (sign up in the app first):

```bash
npm run make-staff -- your@email.com
```

---

## 2. Free question generation (Ollama)

Generates unlimited original questions locally at zero cost.

**One-time setup:**

1. Download and install Ollama from <https://ollama.com>
2. Pull a model (about 9 GB, one download):

```bash
ollama pull qwen2.5:14b
```

If your Mac has 8 GB RAM or less, use the smaller model instead and pass it as a flag:

```bash
ollama pull qwen2.5:7b
```

**Generate questions:**

```bash
# Start small to check quality (3 subtopics, 10 questions each)
npm run generate-questions -- --subject "Math Analysis & Approaches HL" --per-subtopic 10 --limit-subtopics 3

# Then go wide
npm run generate-questions -- --subject "Math Analysis & Approaches HL" --per-subtopic 100
```

Useful flags:

| Flag | Meaning |
|---|---|
| `--subject "..."` | Which subject to fill |
| `--per-subtopic 100` | Target questions per subtopic |
| `--limit-subtopics 3` | Only do the first N subtopics (for testing) |
| `--ollama-model qwen2.5:7b` | Use a smaller/faster model |
| `--provider claude` | Use Claude instead (higher quality, costs API credits) |

Every batch is generated, then independently verified in a second pass, and only questions
that survive verification are inserted. Duplicates are rejected by the database.

Generation is slow on a laptop — roughly 1–3 minutes per batch of 8. Leave it running.

---

## 3. Mobile apps

### Works today: install as an app (PWA)

No app store, no developer account, no cost. Already live:

- **iPhone/iPad:** open `psyllabus.app` in Safari → Share → **Add to Home Screen**
- **Android:** open in Chrome → menu → **Install app**

It gets its own icon, launches full screen with no browser bars, and updates automatically
whenever you deploy. **This is what to demo and what to tell students to do.**

### Later: App Store and Play Store

Capacitor is configured (`capacitor.config.json`) to wrap the live site in a native shell.
When you have developer accounts:

```bash
npx cap add ios       # requires macOS + Xcode
npx cap add android   # requires Android Studio
npx cap open ios
```

**What you need first, and the honest blockers:**

| Requirement | Cost | Blocker |
|---|---|---|
| Apple Developer Program | $99/year | Individual accounts require 18+. Needs a parent/guardian or a registered company. |
| Google Play Developer | $25 once | Also requires 18+. |
| App review | free | Apple rejects apps that are only a website wrapper unless they add real native value (offline use, notifications). |

Do not block your school launch on this. The PWA covers iPhone and Android today.

---

## 4. Deploy

Pushing to `main` deploys automatically via Vercel.

```bash
git push
```

Environment variables needed in Vercel (Settings → Environment Variables):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
`DATABASE_URL` is local-only and must **not** be added to Vercel.

---

## 5. Supabase auth settings

**Authentication → URL Configuration:**

- Site URL: `https://www.psyllabus.app`
- Redirect URLs: `https://www.psyllabus.app/**`, `https://psyllabus.app/**`, `http://localhost:3000/**`

**Google sign-in branding** (to stop the consent screen showing the raw Supabase domain):
Google Cloud Console → **Google Auth Platform** → **Branding** → set App name to `PSyllabus`,
add the logo, set the privacy policy URL to `https://www.psyllabus.app/privacy`, and add
`psyllabus.app` under Authorized domains.
