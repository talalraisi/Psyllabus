import PageShell, { PageHead, Band } from '@/components/marketing/PageShell'
import { FEATURE_DETAIL } from '@/components/marketing/content'
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
        intro="The front page shows these one at a time, which is the right amount to decide whether to keep reading and the wrong amount to decide whether to sign up. This is how each one actually works — and where it stops."
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
              <div className="grid gap-6 md:grid-cols-[minmax(0,17rem)_1fr] md:gap-12">
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
                </div>

                <div>
                  <ul className="flex flex-col gap-3.5">
                    {f.how.map((line) => (
                      <li key={line} className="flex gap-3">
                        <IconCheck
                          width={15}
                          height={15}
                          className="mt-[3px] shrink-0"
                          style={{ color: 'var(--status-proficient)' }}
                        />
                        <p className="text-[14px] leading-[1.65]" style={{ color: 'var(--text-body)' }}>
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
