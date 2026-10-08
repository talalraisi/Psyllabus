import PageShell, { PageHead, Band } from '@/components/marketing/PageShell'
import { FEATURE_DETAIL } from '@/components/marketing/content'
import { FeatureGraphic } from '@/components/marketing/features'
import Link from 'next/link'
import { IconArrowRight, IconCheck } from '@/components/Icons'

export const metadata = {
  title: 'Features',
  description:
    'Eight things Project Syllabus does, shown rather than listed: a heatmap set by testing, topics that fade, a mistake bank that schedules itself, timed papers, and a plan built for the time you actually have tonight.',
}

export default function FeaturesPage() {
  return (
    <PageShell>
      <PageHead
        eyebrow="Features"
        title="All eight, in detail"
        intro="The front page shows these one at a time, which is the right amount to decide whether to keep reading and the wrong amount to decide whether to sign up. This is how each one actually works, and where it stops."
      />

      {/* Nothing here is on the front page and nothing on the front page is
          here. The slideshow, the three steps and the six reasons live there;
          the mechanism lives on this page. A visitor who followed a link
          through should find something new at the end of it. */}
      <Band>
        <div className="flex flex-col gap-5">
          {FEATURE_DETAIL.map((f, i) => (
            <article
              key={f.label}
              className="elev rounded-[16px] border p-6 md:p-8"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
            >
              <div className="grid gap-6 md:grid-cols-[minmax(0,22rem)_1fr] md:gap-12">
                <div>
                  <p
                    className="text-[11px] font-semibold tabular-nums tracking-[0.16em]"
                    style={{ color: 'var(--brand)' }}
                  >
                    {String(i + 1).padStart(2, '0')} · {f.label.toUpperCase()}
                  </p>
                  <h2 className="mt-3 text-[19px] font-semibold leading-snug tracking-[-0.022em]">
                    {f.title}
                  </h2>
                  <p className="mt-2.5 text-[14px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {f.lede}
                  </p>

                  {/* The drawing of the thing being explained.

                      Eight screens of prose about mechanisms that are easier
                      to draw than to describe is the wrong way round, and
                      these already exist. They are the same illustrations the
                      front page cycles through — an illustration sitting
                      beside its own explanation is not the page repeating
                      itself, it is the page finally showing its work. */}
                  <div className="mt-6">
                    <FeatureGraphic label={f.label} />
                  </div>
                </div>

                <div>
                  {/* Three facts, not three paragraphs.
                      These were 685 words across the eight features, one of
                      them 46 words long, and a page somebody opened to find
                      out what the product does should not be read like a
                      contract. Short enough to take in at a glance, laid out
                      as tiles so the eye counts them rather than reading
                      them. */}
                  <ul className="grid gap-2.5 sm:grid-cols-3">
                    {f.how.map((line, n) => (
                      <li
                        key={line}
                        className="rounded-[12px] border p-3.5"
                        style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}
                      >
                        <span className="flex items-center gap-2">
                          <IconCheck
                            width={13}
                            height={13}
                            className="shrink-0"
                            style={{ color: 'var(--status-proficient)' }}
                          />
                          <span
                            className="text-[10px] font-semibold tabular-nums tracking-[0.14em]"
                            style={{ color: 'var(--text-faint)' }}
                          >
                            {String(n + 1).padStart(2, '0')}
                          </span>
                        </span>
                        <p className="mt-2 text-[13px] leading-[1.5]" style={{ color: 'var(--text-body)' }}>
                          {line}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p
                    className="mt-5 border-t pt-4 text-[13px] leading-relaxed"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                  >
                    <span className="font-medium" style={{ color: 'var(--text-body)' }}>
                      Where it stops.{' '}
                    </span>
                    {f.limit}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Band>

      <Band tint>
        <div className="flex flex-wrap items-center justify-between gap-6">
          <p className="max-w-lg text-[15px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            One subject is free for as long as you want it, and a school code opens the rest.
          </p>
          <Link href="/signup" className="btn btn-solid control-lg">
            Start free with one subject
            <IconArrowRight width={16} height={16} />
          </Link>
        </div>
      </Band>
    </PageShell>
  )
}
