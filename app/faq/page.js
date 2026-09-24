import PageShell, { PageHead, Band } from '@/components/marketing/PageShell'
import { Faq } from '@/components/marketing/interactive'
import { FAQ, ANSWERS } from '@/components/marketing/content'
import { IconCheck, IconClose, IconArrowRight } from '@/components/Icons'
import Link from 'next/link'

export const metadata = {
  title: 'Questions',
  description:
    'What Project Syllabus is, how the tracking and the study plan work, which subjects are covered, how school codes work, and what happens to your data.',
}

export default function FaqPage() {
  return (
    <PageShell>
      <PageHead
        eyebrow="Questions"
        title="The ones people ask before signing up"
        intro="If yours is not here, the About page has an address on it and it reaches a person."
      />

      <Band>
        <Faq items={FAQ} />
      </Band>

      <Band tint>
        <h2 className="max-w-2xl text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-tight tracking-[-0.03em]">
          What students say goes wrong with tools like this
        </h2>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
          Taken from what IB students actually complain about. Here is what this does instead.
        </p>

        <ul className="mt-10 flex flex-col gap-3">
          {ANSWERS.map((a) => (
            <li
              key={a.them}
              className="elev grid gap-4 rounded-[14px] border p-5 md:grid-cols-[1fr_1.3fr] md:gap-8"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
            >
              <div className="flex gap-3">
                <IconClose width={16} height={16} className="mt-0.5 shrink-0" style={{ color: 'var(--status-weak)' }} />
                <p className="text-[14px] leading-snug" style={{ color: 'var(--text-muted)' }}>{a.them}</p>
              </div>
              <div className="flex gap-3">
                <IconCheck width={16} height={16} className="mt-0.5 shrink-0" style={{ color: 'var(--status-proficient)' }} />
                <p className="text-[14px] leading-snug">{a.us}</p>
              </div>
            </li>
          ))}
        </ul>

        <Link href="/signup" className="btn btn-solid control-lg mt-12">
          Start free with one subject
          <IconArrowRight width={16} height={16} />
        </Link>
      </Band>
    </PageShell>
  )
}
