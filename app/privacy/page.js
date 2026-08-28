import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy',
  description: 'What Project Syllabus collects, why, and how to delete it.',
}

const LAST_UPDATED = '17 August 2026'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-2xl mx-auto px-5 py-12 md:py-16">
        <Link href="/" className="text-sm font-medium text-[var(--brand)] hover:underline">
          ← Back to Project Syllabus
        </Link>

        <h1 className="t-page-title mt-6 mb-1">Privacy Policy</h1>
        <p className="text-sm text-[var(--text-muted)] mb-10">Last updated {LAST_UPDATED}</p>

        <div className="space-y-8 text-sm text-[var(--text-body)] leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-[var(--text)] mb-2">The short version</h2>
            <p>
              Project Syllabus stores the minimum needed to track your syllabus progress. We do not sell
              your data, we do not share it with advertisers, and we do not run advertising or
              analytics trackers that profile you. You can delete your account and everything in
              it at any time.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--text)] mb-2">What we collect</h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                <strong className="font-medium text-[var(--text)]">Account details.</strong> Your email
                address and name. If you sign in with Google, Google shares your name, email
                address, and profile picture with us; we never receive your Google password.
              </li>
              <li>
                <strong className="font-medium text-[var(--text)]">Study profile.</strong> The
                curriculum, graduation year, subjects, and target grades you enter during
                onboarding.
              </li>
              <li>
                <strong className="font-medium text-[var(--text)]">Study activity.</strong> Your quiz
                answers, scores, timings, per-subtopic status, and the mistakes saved to your
                review queue. This is what makes the progress tracking work.
              </li>
              <li>
                <strong className="font-medium text-[var(--text)]">Profile photo.</strong> Only if you
                choose to upload one.
              </li>
            </ul>
            <p className="mt-3">
              We do not ask for your date of birth, home address, phone number, payment details, or
              school records.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--text)] mb-2">
              Why we collect it
            </h2>
            <p>
              Solely to operate the product: to show your syllabus progress, decide what to
              recommend studying next, apply skill-decay timing, and keep your mistake review queue
              accurate. We do not use your study data to train AI models.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--text)] mb-2">Where it is stored</h2>
            <p>
              Your data is stored with{' '}
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--brand)] hover:underline"
              >
                Supabase
              </a>{' '}
              (our database and authentication provider) and the site is served by{' '}
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--brand)] hover:underline"
              >
                Vercel
              </a>
              . Database access is protected by row-level security rules, which means your rows are
              readable only by your own authenticated account.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--text)] mb-2">Cookies</h2>
            <p>
              We set only the session cookies required to keep you signed in. There are no
              advertising cookies and no cross-site tracking.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--text)] mb-2">Your control</h2>
            <p>
              You can edit your name and photo on your profile page, and change your subjects and
              target grades at any time. To export or permanently delete your account and all
              associated study data, email{' '}
              <a href="mailto:talalraisi1@gmail.com" className="text-[var(--brand)] hover:underline">
                talalraisi1@gmail.com
              </a>{' '}
              and we will action it. Deletion is irreversible.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--text)] mb-2">Age</h2>
            <p>
              Project Syllabus is built for students preparing for pre-university examinations. If you are
              under 16, please review this policy with a parent or guardian before signing up.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--text)] mb-2">Changes and contact</h2>
            <p>
              If this policy changes materially we will update the date above and notify signed-in
              users. Questions go to{' '}
              <a href="mailto:talalraisi1@gmail.com" className="text-[var(--brand)] hover:underline">
                talalraisi1@gmail.com
              </a>
              .
            </p>
          </section>

          <p className="text-sm text-[var(--text-muted)] pt-4 border-t border-[var(--border-strong)]">
            See also our{' '}
            <Link href="/terms" className="text-[var(--brand)] hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  )
}
