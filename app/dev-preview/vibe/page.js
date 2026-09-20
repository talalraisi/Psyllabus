'use client'

/**
 * Two directions for the same product, on the same two screens.
 *
 * Arguing about a vibe in prose is how you end up building neither. These are
 * the dashboard and the end of a quiz — the screen you open on and the screen
 * that is supposed to make the work feel worth it — drawn twice.
 *
 * A: rings led. The ring is the hero, colour is reserved for what you earned,
 *    numbers are large and the moment of levelling up is the point.
 * B: instrument led. Structure first, warmer and lighter than today, cards
 *    with real depth, rings present but as an accent rather than the subject.
 *
 * Both fix what is wrong with the current one either way: a flat near-black
 * with no elevation, colour spent on decoration, and type that is all one
 * size. Not reachable in production.
 */

import { useState } from 'react'
import { notFound } from 'next/navigation'

const ENABLED = process.env.NODE_ENV !== 'production'

const SUBJECTS = [
  ['Economics HL', 62, 'proficient'],
  ['Math Analysis & Approaches HL', 41, 'developing'],
  ['English A: Literature SL', 28, 'weak'],
  ['Physics SL', 12, 'weak'],
]

/** A progress ring. Size and weight are what separates the two directions. */
function Ring({ value, size, stroke, children, track = 'var(--v-track)' }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--v-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Dashboard({ variant }) {
  const ringSize = variant === 'a' ? 168 : 92
  const ringStroke = variant === 'a' ? 14 : 9
  return (
    <section className="v-card v-hero">
      <div className="v-hero-row">
        <Ring value={43} size={ringSize} stroke={ringStroke}>
          <div>
            <div className={variant === 'a' ? 'v-figure-xl' : 'v-figure-md'}>43%</div>
            {variant === 'a' && <div className="v-label">mastered</div>}
          </div>
        </Ring>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="v-eyebrow">Wednesday evening</p>
          <h2 className={variant === 'a' ? 'v-title-xl' : 'v-title-md'}>
            {variant === 'a' ? 'Four to clear tonight.' : 'Good evening, Talal'}
          </h2>
          <p className="v-body">
            {variant === 'a'
              ? 'Nothing here is guessed. Sit one quiz and the ring moves.'
              : 'Four subtopics are due, and Economics is the one furthest behind.'}
          </p>
          <button className="v-btn v-btn-solid">Start with Costs of production →</button>
        </div>
      </div>

      <div className="v-divider" />

      <ul className="v-list">
        {SUBJECTS.map(([name, pct, tone]) => (
          <li key={name} className="v-row">
            {variant === 'b' && (
              <Ring value={pct} size={34} stroke={4}>
                <span className="v-figure-xs">{pct}</span>
              </Ring>
            )}
            <span className="v-row-name">{name}</span>
            <span className="v-bar">
              <span className={`v-bar-fill v-${tone}`} style={{ width: `${pct}%` }} />
            </span>
            {variant === 'a' && <span className="v-figure-xs">{pct}%</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Result({ variant }) {
  return (
    <section className="v-card v-result">
      {variant === 'a' ? (
        <>
          <div className="v-result-ring">
            <Ring value={100} size={132} stroke={12}>
              <div>
                <div className="v-figure-lg">5/5</div>
                <div className="v-label">+4.25</div>
              </div>
            </Ring>
          </div>
          <h2 className="v-title-lg">Aggregate demand just went Developing.</h2>
          <p className="v-body">Five for five. The next one up is worth 2.5 points.</p>
        </>
      ) : (
        <>
          <p className="v-eyebrow">Result</p>
          <h2 className="v-title-md">Strong paper. Push the difficulty up next time.</h2>
          <div className="v-tiles">
            {[
              ['Score', '5/5'],
              ['Accuracy', '100%'],
              ['Points', '+4.25'],
            ].map(([k, v]) => (
              <div key={k} className="v-tile">
                <p className="v-label">{k}</p>
                <p className="v-figure-md">{v}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="v-mastery">
        <div className="v-mastery-head">
          <span className="v-row-name">Aggregate demand and its components</span>
          <span className="v-label">Weak → Developing</span>
        </div>
        <span className="v-bar v-bar-tall">
          <span className="v-bar-fill v-developing" style={{ width: '38%' }} />
        </span>
      </div>

      <div className="v-actions">
        <button className="v-btn v-btn-solid">Done</button>
        <button className="v-btn v-btn-ghost">Redemption</button>
      </div>
    </section>
  )
}

export default function VibePreview() {
  const [variant, setVariant] = useState('a')
  const [theme, setTheme] = useState('system')
  if (!ENABLED) notFound()

  /**
   * A theme switch on the page itself.
   *
   * The real app follows the operating system, which is right for the app and
   * useless for judging two designs side by side — nobody should have to open
   * System Settings twice per comparison.
   */
  const pick = (next) => {
    setTheme(next)
    const resolved =
      next === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : next
    document.documentElement.setAttribute('data-theme', resolved)
    document.documentElement.style.colorScheme = resolved
  }

  return (
    <div className={`vibe vibe-${variant}`}>
      <style>{CSS}</style>

      <header className="v-switch">
        <div>
          <h1 className="v-title-md">Two directions</h1>
          <p className="v-body">
            Same screens, same content. Switch the theme here rather than in System Settings.
          </p>
        </div>
        <div className="v-controls">
          <div className="v-seg">
            <button onClick={() => setVariant('a')} className={variant === 'a' ? 'v-seg-on' : ''}>
              A · Rings led
            </button>
            <button onClick={() => setVariant('b')} className={variant === 'b' ? 'v-seg-on' : ''}>
              B · Instrument led
            </button>
          </div>
          <div className="v-seg">
            {['light', 'dark', 'system'].map((t) => (
              <button key={t} onClick={() => pick(t)} className={theme === t ? 'v-seg-on' : ''}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <p className="v-note">
        {variant === 'a'
          ? 'Rings led, in the instrument palette. The ring is the subject of the screen and the only green on it — no wash behind the card, no glow behind the ring. Warm neutral greys rather than green-tinted ones, and the card lifts by elevation instead of by colour.'
          : 'Yours. Structure carries it — hairlines, a real grid, generous spacing. Warmer and lighter than today so it is not bland. Cards have weight, and the rings are an accent on each row rather than the headline.'}
      </p>

      <div className="v-stack">
        <Dashboard variant={variant} />
        <Result variant={variant} />
      </div>
    </div>
  )
}

const CSS = `
.vibe {
  min-height: 100vh;
  padding: 40px 24px 80px;
  background: var(--v-bg);
  color: var(--v-text);
  font-feature-settings: 'tnum' 1;
}
.v-stack { max-width: 860px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px; }
.v-switch {
  max-width: 860px; margin: 0 auto 18px; display: flex; flex-wrap: wrap;
  align-items: end; justify-content: space-between; gap: 16px;
}
.v-note { max-width: 860px; margin: 0 auto 28px; font-size: 13.5px; line-height: 1.65; color: var(--v-muted); }
.v-controls { display: flex; flex-wrap: wrap; gap: 10px; }
.v-seg { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: var(--v-sunken); }
.v-seg button {
  border: 0; background: transparent; color: var(--v-muted); cursor: pointer;
  padding: 8px 16px; border-radius: 999px; font-size: 13px; font-weight: 600;
  transition: background 180ms ease, color 180ms ease;
}
.v-seg .v-seg-on { background: var(--v-surface); color: var(--v-text); box-shadow: var(--v-shadow-sm); }

/* ---------- shared pieces, differentiated by the token blocks below ------- */
.v-card {
  background: var(--v-surface);
  border: 1px solid var(--v-border);
  border-radius: var(--v-radius);
  padding: var(--v-pad);
  box-shadow: var(--v-shadow);
}
.v-hero-row { display: flex; align-items: center; gap: var(--v-gap); flex-wrap: wrap; }
.v-divider { height: 1px; background: var(--v-border); margin: var(--v-gap) 0; }
.v-list { display: flex; flex-direction: column; gap: 14px; }
.v-row { display: flex; align-items: center; gap: 14px; }
.v-row-name { font-size: 13.5px; font-weight: 500; flex: 1; min-width: 0; }
.v-bar { flex: 1.4; height: 4px; border-radius: 999px; background: var(--v-track); overflow: hidden; }
.v-bar-tall { height: 6px; display: block; flex: none; }
.v-bar-fill { display: block; height: 100%; border-radius: 999px; }
.v-weak { background: var(--status-weak); }
.v-developing { background: var(--status-developing); }
.v-proficient { background: var(--status-proficient); }

.v-eyebrow {
  font-size: 10.5px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.16em; color: var(--v-faint); margin-bottom: 10px;
}
.v-label { font-size: 11px; font-weight: 500; color: var(--v-faint); letter-spacing: 0.02em; }
.v-body { font-size: 14px; line-height: 1.6; color: var(--v-muted); margin: 8px 0 18px; }
.v-figure-xs { font-size: 12px; font-weight: 600; color: var(--v-muted); }
.v-figure-md { font-size: 26px; font-weight: 600; letter-spacing: -0.03em; }
.v-figure-lg { font-size: 34px; font-weight: 640; letter-spacing: -0.035em; }
.v-figure-xl { font-size: 40px; font-weight: 660; letter-spacing: -0.04em; }
.v-title-md { font-size: 21px; font-weight: 600; letter-spacing: -0.024em; }
.v-title-lg { font-size: 27px; font-weight: 640; letter-spacing: -0.03em; line-height: 1.15; }
.v-title-xl { font-size: 32px; font-weight: 660; letter-spacing: -0.035em; line-height: 1.1; }

.v-btn {
  border-radius: var(--v-btn-radius); padding: 11px 20px; font-size: 13.5px;
  font-weight: 600; cursor: pointer; border: 1px solid transparent;
  transition: transform 140ms cubic-bezier(0.16,1,0.3,1), filter 140ms ease;
}
.v-btn:active { transform: scale(0.975); }
.v-btn-solid { background: var(--v-accent); color: var(--v-on-accent); box-shadow: var(--v-shadow-sm); }
.v-btn-solid:hover { filter: brightness(1.08); }
.v-btn-ghost { background: transparent; color: var(--v-muted); border-color: var(--v-border-strong); }
.v-actions { display: flex; gap: 10px; margin-top: 22px; }
.v-tiles { display: flex; gap: 40px; margin: 22px 0 6px; }
.v-mastery { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--v-border); }
.v-mastery-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.v-result-ring { display: flex; justify-content: center; margin-bottom: 22px; }
.v-result { text-align: var(--v-result-align); }
.v-result .v-actions { justify-content: var(--v-result-justify); }
.v-result .v-mastery-head { text-align: left; }

/* ========================= A · rings led ================================= */
/* Dark first, but lifted off pure black and layered, so the card reads as a
   surface rather than a slightly different flat. Colour is only ever the
   accent, and the accent only ever means "earned". */
.vibe-a {
  /* The warmer, more neutral charcoal from the instrument direction. The
     green-tinted greys made the whole frame feel washed in brand colour,
     which is the opposite of restraint — the accent should be the only
     green on the screen. */
  --v-bg: #141614;
  --v-surface: #1b1e1c;
  --v-sunken: #191c1a;
  --v-border: #2a2f2c;
  --v-border-strong: #3a423d;
  --v-track: #2b302d;
  --v-text: #f0f1ee;
  --v-muted: #a8aea9;
  --v-faint: #868d88;
  --v-accent: #57a97f;
  --v-on-accent: #0b110e;
  --v-lift: rgba(255,255,255,0.028);
  --v-radius: 22px;
  --v-btn-radius: 999px;
  --v-pad: 34px;
  --v-gap: 26px;
  --v-shadow: 0 1px 0 rgba(255,255,255,0.03) inset, 0 18px 40px -24px rgba(0,0,0,0.9);
  --v-shadow-sm: 0 6px 16px -10px rgba(0,0,0,0.8);
  --v-result-align: center;
  --v-result-justify: center;
}
/* No green wash behind the hero and no disc behind the ring.
   A brand-coloured glow sitting in the corner of a card reads as a smudge
   rather than as light, and on a light background it goes distinctly murky.
   The card lifts by elevation instead — a plain top highlight and a real
   shadow — and the only green on the screen is the ring itself, which is
   the whole point of this direction. */
.vibe-a .v-hero {
  background:
    linear-gradient(180deg, var(--v-lift), transparent 140px),
    var(--v-surface);
}
/* Light mode was the weak half: a white card on an almost-white page with a
   hairline and a whisper of shadow, which reads as a form rather than as
   something in front of something. The page is dropped a long way below the
   card so white actually lifts, the border is nearly gone because the shadow
   should do that work, and the shadow is three layers — contact, lift and a
   wide soft pool — which is what separates an expensive-looking card from a
   box. The green is deeper and more saturated: the dark mode ring glows
   against near-black and gets its drama free, while on white a pale green
   ring is just a line. */
:root:not([data-theme='dark']) .vibe-a {
  /* Warm, not beige. A cool grey-green page reads clinical — the wrong kind
     of serious for something opened at eleven at night — but a cream one
     reads like a recipe site. This is a neutral with just enough warmth to
     stop it feeling like a medical form. */
  --v-bg: #eeebe5;
  --v-surface: #ffffff;
  --v-sunken: #e6e2da;
  --v-border: rgba(23,26,23,0.055);
  --v-border-strong: rgba(23,26,23,0.12);
  --v-track: #e9e5dd;
  --v-text: #171a17;
  --v-muted: #575d58;
  --v-faint: #7b827c;
  --v-accent: #2d6a4f;
  --v-on-accent: #ffffff;
  --v-lift: rgba(23,26,23,0.012);
  /* The muted status hues were tuned against near-black. On white the clay
     and ochre lose their chroma and go brown, so they are lifted here. */
  --status-weak: oklch(0.58 0.16 32);
  --status-developing: oklch(0.66 0.14 78);
  --status-proficient: oklch(0.56 0.13 158);
  --v-shadow:
    0 1px 2px rgba(16,25,21,0.05),
    0 14px 30px -14px rgba(16,25,21,0.16),
    0 44px 80px -46px rgba(16,25,21,0.28);
  --v-shadow-sm: 0 2px 8px -3px rgba(16,25,21,0.22);
}

/* ========================= B · instrument led ============================ */
/* Warmer and a step lighter than today, because the complaint about the
   current app is that it is dark and bland. Squarer, denser, more structural;
   the card has real weight (vault) and the spacing is generous (atelier). */
.vibe-b {
  --v-bg: #141614;
  --v-surface: #1b1e1c;
  --v-sunken: #191c1a;
  --v-border: #2a2f2c;
  --v-border-strong: #3a423d;
  --v-track: #2b302d;
  --v-text: #f0f1ee;
  --v-muted: #a8aea9;
  --v-faint: #868d88;
  --v-accent: #57a97f;
  --v-on-accent: #0b110e;
  --v-radius: 14px;
  --v-btn-radius: 10px;
  --v-pad: 38px;
  --v-gap: 30px;
  --v-shadow: 0 1px 0 rgba(255,255,255,0.045) inset, 0 26px 50px -30px rgba(0,0,0,0.95);
  --v-shadow-sm: 0 4px 12px -6px rgba(0,0,0,0.6);
  --v-result-align: left;
  --v-result-justify: flex-start;
}
.vibe-b .v-card {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.028), transparent 120px),
    var(--v-surface);
}
:root:not([data-theme='dark']) .vibe-b {
  --v-bg: #f7f5f1;
  --v-surface: #ffffff;
  --v-sunken: #f1efe9;
  --v-border: #e8e4dc;
  --v-border-strong: #d8d2c7;
  --v-track: #ece8e0;
  --v-text: #171a17;
  --v-muted: #5c625d;
  --v-faint: #838a84;
  --v-accent: #2d6a4f;
  --v-on-accent: #ffffff;
  --v-shadow: 0 24px 50px -34px rgba(23,26,23,0.4);
  --v-shadow-sm: 0 4px 12px -6px rgba(23,26,23,0.22);
}

@media (max-width: 640px) {
  .vibe { padding: 24px 16px 60px; }
  .v-card { padding: 24px; }
  .v-tiles { gap: 24px; }
}
`
