'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import BackLink from '@/components/BackLink'
import { OPERATOR, isRegistered, DATA_COLLECTED, NOT_COLLECTED } from '@/lib/legal'

const LAST_UPDATED = '5 September 2026'

/**
 * Privacy policy, in English and Arabic.
 *
 * Arabic is not a nicety here. The people who have to approve this are an
 * Omani school's administration, and a policy they cannot read in the language
 * their own compliance runs in is a policy they will not sign off.
 */
function PrivacyPolicy() {
  const [lang, setLang] = useState('en')
  const ar = lang === 'ar'

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <div className="mx-auto max-w-3xl px-5 py-12 md:py-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Suspense fallback={<span className="text-sm text-[var(--brand)]">&larr; Back</span>}>
            <BackLink />
          </Suspense>

          <div
            className="inline-flex rounded-[var(--r-md)] border border-[var(--border-strong)] p-1"
            role="group"
            aria-label="Language"
          >
            {[
              ['en', 'English'],
              ['ar', 'العربية'],
            ].map(([code, label]) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className={`control-sm rounded-[var(--r-sm)] px-3 text-sm font-medium transition-colors duration-150 ${
                  lang === code
                    ? 'bg-[var(--brand)] text-white'
                    : 'text-[var(--text-body)] hover:bg-[var(--surface-sunken)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <article dir={ar ? 'rtl' : 'ltr'} className={ar ? 'text-right' : ''}>
          <header className="mt-8 mb-10">
            <h1 className="t-page-title mb-2">
              {ar ? 'سياسة الخصوصية' : 'Privacy Policy'}
            </h1>
            <p className="t-small">
              {ar ? 'آخر تحديث: ٥ سبتمبر ٢٠٢٦' : `Last updated ${LAST_UPDATED}`}
            </p>
          </header>

          <div className="flex flex-col gap-8 text-sm leading-relaxed text-[var(--text-body)]">
            {/* Operator */}
            <section className="surface p-5">
              <h2 className="t-card-title mb-2">
                {ar ? 'من يشغّل هذه المنصة' : 'Who runs this'}
              </h2>
              {isRegistered() ? (
                <p>
                  {ar
                    ? `يتم تشغيل هذه المنصة من قبل ${OPERATOR.companyName}، السجل التجاري رقم ${OPERATOR.crNumber}، سلطنة عُمان.`
                    : `Project Syllabus is operated by ${OPERATOR.companyName}, Commercial Registration No. ${OPERATOR.crNumber}, Sultanate of Oman.`}
                </p>
              ) : (
                <p>
                  {ar
                    ? 'تُشغَّل هذه المنصة حالياً من قبل طالب في مسقط، سلطنة عُمان، وهي قيد التسجيل كشركة. سيتم تحديث هذه الصفحة برقم السجل التجاري فور صدوره.'
                    : 'Project Syllabus is currently run by a student in Muscat, Oman, and is in the process of being registered as a company. This page will be updated with the Commercial Registration number as soon as it is issued.'}
                </p>
              )}
              <p className="mt-3">
                {ar
                  ? `نلتزم بحماية بيانات الطلاب وفقاً لـ ${OPERATOR.law.ar}.`
                  : `We handle student data in line with the ${OPERATOR.law.en}.`}
              </p>
              <p className="mt-3">
                {ar ? 'مسؤول حماية البيانات: ' : 'Data protection contact: '}
                <a href={`mailto:${OPERATOR.dpoEmail}`} className="text-[var(--brand)] hover:underline">
                  {OPERATOR.dpoEmail}
                </a>
              </p>
            </section>

            {/* Short version */}
            <section>
              <h2 className="t-card-title mb-2">{ar ? 'باختصار' : 'The short version'}</h2>
              <p>
                {ar
                  ? 'نجمع أقل قدر ممكن من البيانات اللازمة لتتبع تقدمك الدراسي. لا نبيع بياناتك ولا نشاركها مع أي جهة، ولا يمكن لأي شخص في مدرستك الاطلاع على نتائجك. يمكنك حذف كل شيء في أي وقت من صفحة حسابك.'
                  : 'We collect the least we can get away with, use it only to track your progress, never sell or share it, and never show your results to anyone at your school. You can delete all of it yourself, from your profile page, at any time.'}
              </p>
            </section>

            {/* Under 18 */}
            <section className="surface p-5">
              <h2 className="t-card-title mb-2">
                {ar ? 'الطلاب تحت سن ١٨' : 'Students under 18'}
              </h2>
              <p>
                {ar
                  ? 'معظم مستخدمي هذه المنصة دون سن الثامنة عشرة. لهذا نطلب عند التسجيل تأكيداً صريحاً بأنك حصلت على إذن من ولي أمرك، ونحتفظ بسجل لوقت هذه الموافقة ونصها.'
                  : 'Most people using this are under 18. That is why signing up requires an explicit confirmation that you have your parent or guardian’s permission, and why we keep a record of when that was given and exactly what was agreed to.'}
              </p>
              <p className="mt-3">
                {ar
                  ? 'يحق لولي الأمر في أي وقت طلب الاطلاع على بيانات ابنه أو تصحيحها أو حذفها بالكامل عبر البريد الإلكتروني أعلاه.'
                  : 'A parent or guardian can ask to see, correct or permanently delete their child’s data at any time, using the email address above.'}
              </p>
            </section>

            {/* What we collect */}
            <section>
              <h2 className="t-card-title mb-3">
                {ar ? 'البيانات التي نجمعها' : 'What we collect, and why'}
              </h2>
              <ul className="flex flex-col gap-3">
                {DATA_COLLECTED.map((d) => (
                  <li key={d.en} className="flex flex-col">
                    <strong className="font-medium text-[var(--text)]">{ar ? d.ar : d.en}</strong>
                    <span className="t-small">{ar ? d.why.ar : d.why.en}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4">{ar ? NOT_COLLECTED.ar : NOT_COLLECTED.en}</p>
            </section>

            {/* Where it lives */}
            <section>
              <h2 className="t-card-title mb-3">{ar ? 'أين تُخزَّن البيانات' : 'Where it is stored'}</h2>
              <p className="mb-3">
                {ar
                  ? 'نستعين بمزودي الخدمات التاليين، ولا يستخدم أي منهم بياناتك لأغراضهم الخاصة:'
                  : 'We use these providers, none of which use your data for their own purposes:'}
              </p>
              <ul className="flex flex-col gap-2">
                {OPERATOR.processors.map((p) => (
                  <li key={p.name}>
                    <strong className="font-medium text-[var(--text)]">{p.name}</strong>
                    {' — '}
                    {p.role}. {p.region}.
                  </li>
                ))}
              </ul>
            </section>

            {/* Rights */}
            <section>
              <h2 className="t-card-title mb-3">{ar ? 'حقوقك' : 'Your rights'}</h2>
              <ul className="flex flex-col gap-2">
                <li>
                  {ar
                    ? 'الاطلاع على جميع البيانات التي نحتفظ بها عنك.'
                    : 'See everything we hold about you.'}
                </li>
                <li>
                  {ar ? 'تصحيح أي بيانات غير دقيقة.' : 'Correct anything that is wrong.'}
                </li>
                <li>
                  {ar
                    ? 'حذف حسابك وجميع بياناتك نهائياً، ويمكنك ذلك بنفسك من صفحة الحساب دون الحاجة لمراسلتنا.'
                    : 'Delete your account and all of your data permanently. You can do this yourself from your profile page without asking us.'}
                </li>
                <li>
                  {ar ? 'سحب موافقتك في أي وقت.' : 'Withdraw your consent at any time.'}
                </li>
              </ul>
            </section>

            {/* Nobody at school */}
            <section className="surface p-5">
              <h2 className="t-card-title mb-2">
                {ar ? 'لا أحد في مدرستك يرى نتائجك' : 'Nobody at your school sees your results'}
              </h2>
              <p>
                {ar
                  ? 'لا توجد حسابات للمعلمين ولا لوحات تحكم للصفوف. عندما تشتري مدرسة اشتراكاً، فإنها تفتح المنصة لطلابها فقط ولا تحصل على أي شيء آخر. هذا مفروض على مستوى قاعدة البيانات نفسها، وليس مجرد إعداد يمكن تغييره.'
                  : 'There are no teacher accounts and no class dashboards. When a school buys a licence, it unlocks the app for its students and gets nothing else. This is enforced by the database itself, not by a setting somebody could change.'}
              </p>
            </section>

            {/* Changes */}
            <section>
              <h2 className="t-card-title mb-2">{ar ? 'التغييرات' : 'Changes'}</h2>
              <p>
                {ar
                  ? 'إذا تغيّرت طريقة تعاملنا مع البيانات بشكل جوهري، سنخطرك عبر البريد الإلكتروني قبل أن يسري التغيير.'
                  : 'If we change anything material about how data is handled, we will email you before it takes effect.'}
              </p>
            </section>
          </div>
        </article>

        <p className="t-caption mt-12">
          <Link href="/terms" className="text-[var(--brand)] hover:underline">
            {ar ? 'شروط الاستخدام' : 'Terms of service'}
          </Link>
        </p>
      </div>
    </main>
  )
}

export default function PrivacyPage() {
  return (
    <Suspense fallback={null}>
      <PrivacyPolicy />
    </Suspense>
  )
}
