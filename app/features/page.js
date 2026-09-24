import PageShell, { PageHead, Band } from '@/components/marketing/PageShell'
import { FeatureModules } from '@/components/marketing/features'
import { HOW_IT_WORKS, WHY } from '@/components/marketing/content'
import Link from 'next/link'
import { IconArrowRight } from '@/components/Icons'

export const metadata = {
  title: 'What it does',
  description:
    'Eight things Project Syllabus does, shown rather than listed: a heatmap set by testing, topics that fade, a mistake bank that schedules itself, timed papers, and a plan built for the time you actually have tonight.',
}

export default function FeaturesPage() {
  return (
    <PageShell>
      <PageHead
        eyebrow="What it does"
        title="Eight things, and what each one is for"
        intro="Shown rather than described, because a list of feature names tells you nothing about whether any of it is any good."
      />

      <Band>
        <FeatureModules />
      </Band>

      <Band tint>
        <h2 className="max-w-2xl text-[clamp(1.6rem,3vw,2.1rem)] font-semibold leading-tight tracking-[-0.03em]">
          Three steps, and the second one is the point
        </h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {HOW_IT_WORKS.map(({ step, title, body }) => (
            <li
              key={step}
              className="elev rounded-[14px] border p-6"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
            >
              <p className="text-[11px] font-semibold tabular-nums tracking-[0.16em]" style={{ color: 'var(--brand)' }}>
                {step}
              </p>
              <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.015em]">{title}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {body}
              </p>
            </li>
          ))}
        </ol>
      </Band>

      <Band>
        <h2 className="max-w-2xl text-[clamp(1.6rem,3vw,2.1rem)] font-semibold leading-tight tracking-[-0.03em]">
          Why it is built this way
        </h2>
        <div className="mt-10 grid gap-x-12 gap-y-9 md:grid-cols-2">
          {WHY.map(({ title, body }, i) => (
            <div key={title} className="flex gap-4">
              <span
                className="shrink-0 pt-0.5 text-[11px] font-semibold tabular-nums tracking-[0.14em]"
                style={{ color: 'var(--text-faint)' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="text-[15.5px] font-semibold tracking-[-0.015em]">{title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <Link href="/signup" className="btn btn-solid control-lg mt-12">
          Start free with one subject
          <IconArrowRight width={16} height={16} />
        </Link>
      </Band>
    </PageShell>
  )
}
