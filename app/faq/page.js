import PageShell, { PageHead, Band } from '@/components/marketing/PageShell'
import { Faq } from '@/components/marketing/interactive'
import { FAQ } from '@/components/marketing/content'
import { IconArrowRight } from '@/components/Icons'
import Link from 'next/link'

export const metadata = {
  title: 'Questions',
  description:
    'What Project Syllabus is, how the tracking and the study plan work, which subjects are covered, how school codes work, and what happens to your data.',
}

export default function FaqPage() {
  return (
    <PageShell>
      {/* Lets search engines answer these directly. It moved here with the
          questions — marked up on a page that no longer carries them, it was
          a claim about content that is not on it. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.map(({ q, a }) => ({
              '@type': 'Question',
              name: q,
              acceptedAnswer: { '@type': 'Answer', text: a },
            })),
          }),
        }}
      />

      <PageHead
        eyebrow="Questions"
        title="The ones people ask before signing up"
        intro="If yours is not here, the About page has an address on it and it reaches a person."
      />

      {/* Only the questions. The block of student objections that used to sit
          underneath is on the front page, and a visitor who has read one
          should not meet it again here. */}
      <Band>
        <Faq items={FAQ} />
      </Band>

      <Band tint>
        <div className="flex flex-wrap items-center justify-between gap-6">
          <p className="max-w-lg text-[15px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            Still deciding? One subject is free for as long as you want it, with no card.
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
