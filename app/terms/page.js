import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service',
  description: 'The terms for using PSyllabus, and how our practice questions are produced.',
}

const LAST_UPDATED = '17 August 2026'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f8f6f1]">
      <div className="max-w-2xl mx-auto px-5 py-12 md:py-16">
        <Link href="/" className="text-sm font-medium text-[#2D6A4F] hover:underline">
          ← Back to PSyllabus
        </Link>

        <h1 className="t-page-title mt-6 mb-1">Terms of Service</h1>
        <p className="text-sm text-[#6b7280] mb-10">Last updated {LAST_UPDATED}</p>

        <div className="space-y-8 text-sm text-[#374151] leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-[#1a2e1e] mb-2">Using PSyllabus</h2>
            <p>
              PSyllabus is a study tracking and practice tool provided free of charge and as-is.
              Keep your login credentials secure, use the service for your own study, and do not
              attempt to scrape, resell, or bulk-extract the question bank.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#1a2e1e] mb-2">
              How our practice questions are made
            </h2>
            <p>
              Every practice question in PSyllabus is <strong className="font-medium text-[#1a2e1e]">original
              content</strong>, written to match the style, difficulty, and mark allocation of
              exam-board questions. Each question passes an automated verification step before it
              reaches you.
            </p>
            <p className="mt-3">
              We do <strong className="font-medium text-[#1a2e1e]">not</strong> reproduce, host, or
              redistribute past examination papers, mark schemes, or any other copyrighted
              examination material. Where the app points you to third-party resources, it links out
              to the rightful publisher rather than copying their content.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#1a2e1e] mb-2">
              No affiliation or endorsement
            </h2>
            <p>
              PSyllabus is an independent product. It is not affiliated with, authorised by,
              endorsed by, or in any way officially connected to the International Baccalaureate
              Organization, Cambridge Assessment, Pearson Edexcel, AQA, OCR, or the College Board.
              &ldquo;IB&rdquo;, &ldquo;International Baccalaureate&rdquo;, &ldquo;A-Level&rdquo;,
              &ldquo;AP&rdquo;, and &ldquo;Advanced Placement&rdquo; are trademarks of their
              respective owners and are used here only to describe which curricula the tool
              supports.
            </p>
            <p className="mt-3">
              Syllabus topic names are used descriptively so you can navigate your own course.
              Always confirm requirements against the official specification published by your exam
              board and the guidance from your teachers.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#1a2e1e] mb-2">No guarantee of results</h2>
            <p>
              Progress percentages, mastery statuses, and readiness indicators are estimates
              generated from your own quiz performance. They are study aids, not predictions of your
              final grade, and no particular outcome is guaranteed.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#1a2e1e] mb-2">Accuracy</h2>
            <p>
              We verify questions automatically and work to keep them correct, but errors are
              possible in any question bank. If you believe a question or explanation is wrong,
              please report it so we can fix or remove it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#1a2e1e] mb-2">
              Availability and changes
            </h2>
            <p>
              This is an early-stage product under active development. Features may change and
              service may be interrupted. We may update these terms; material changes will be
              reflected in the date above.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#1a2e1e] mb-2">Contact</h2>
            <p>
              Questions, corrections, or takedown requests:{' '}
              <a href="mailto:talalraisi1@gmail.com" className="text-[#2D6A4F] hover:underline">
                talalraisi1@gmail.com
              </a>
              .
            </p>
          </section>

          <p className="text-sm text-[#6b7280] pt-4 border-t border-[#e5e7eb]">
            See also our{' '}
            <Link href="/privacy" className="text-[#2D6A4F] hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  )
}
