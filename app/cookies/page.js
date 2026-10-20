'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { LegalDoc, Clause, useLegalLang } from '@/components/LegalDoc'
import { OPERATOR } from '@/lib/legal'

/**
 * Cookie policy.
 *
 * The honest version is short, because the site genuinely does very little:
 * there is no analytics, no advertising, no third-party script of any kind, and
 * the only cookies are the ones that keep you signed in. That is worth stating
 * plainly rather than padding into the usual four-page table, and it is the
 * reason there is no consent banner: strictly necessary cookies do not require
 * consent under any of the regimes this has to satisfy, and a banner asking
 * permission for something you cannot decline is theatre.
 */
function Cookies() {
  const [lang, setLang] = useLegalLang()
  const ar = lang === 'ar'

  return (
    <LegalDoc
      titles={{ en: 'Cookie Policy', ar: 'سياسة ملفات تعريف الارتباط' }}
      updated={{ en: '20 October 2026', ar: '٢٠ أكتوبر ٢٠٢٦' }}
      lang={lang}
      setLang={setLang}
    >
      <p style={{ marginTop: 28 }}>
        {ar
          ? 'تستخدم منصة Project Syllabus أقل قدر ممكن من ملفات تعريف الارتباط. لا توجد أدوات تحليل، ولا إعلانات، ولا أي نصوص برمجية من أطراف خارجية. ملفات تعريف الارتباط الوحيدة المستخدمة هي تلك اللازمة لإبقائك مسجّل الدخول.'
          : 'Project Syllabus uses as few cookies as it is possible to use. There is no analytics, no advertising, and no third-party script of any kind. The only cookies set are the ones that keep you signed in.'}
      </p>

      <Clause n="1" title={ar ? 'ما نضعه بالضبط' : 'Exactly what is set'}>
        <p>
          {ar
            ? 'ملفات تعريف الارتباط (تُرسل إلى الخادم مع كل طلب):'
            : 'Cookies, which are sent to the server with each request:'}
        </p>
        <ul>
          <li>
            <strong>sb-…-auth-token</strong>{' '}
            {ar
              ? 'رمز الجلسة الذي يُبقيك مسجّل الدخول. يضعه مزوّد المصادقة لدينا (Supabase). ينتهي عند تسجيل الخروج.'
              : 'the session token that keeps you signed in, set by our authentication provider (Supabase). Cleared when you sign out.'}
          </li>
          <li>
            <strong>sb-…-auth-token-code-verifier</strong>{' '}
            {ar
              ? 'ملف مؤقت يُستخدم أثناء تسجيل الدخول عبر Google فقط، ويُحذف فور اكتمال العملية.'
              : 'a short-lived value used only while a Google sign-in is in progress, and discarded as soon as it completes.'}
          </li>
        </ul>
        <p>
          {ar
            ? 'ويُخزَّن على جهازك، دون إرساله إلى أي خادم، ويبقى حتى تمسحه من متصفحك:'
            : 'Stored on your own device and never sent to any server, kept until you clear it in your browser:'}
        </p>
        <ul>
          <li>
            <strong>psyllabus:theme</strong>, <strong>psyllabus:sidebar</strong>, <strong>psy:calc:degrees</strong>{' '}
            {ar
              ? 'تفضيلاتك: الوضع الفاتح أو الداكن، وطيّ الشريط الجانبي، والدرجات أو الراديان في الآلة الحاسبة.'
              : 'your preferences: light or dark theme, whether the sidebar is folded, and degrees or radians on the calculator.'}
          </li>
          <li>
            <strong>psyllabus:session-timer</strong>, <strong>psyllabus:study-sessions-pending</strong>{' '}
            {ar
              ? 'مؤقّت المذاكرة الجاري، وأي جلسة لم تُحفظ بعد إذا انقطع الاتصال، حتى تُرسل إلى حسابك.'
              : 'a study timer that is running, and any session not yet saved because you were offline, until it reaches your account.'}
          </li>
          <li>
            <strong>psyllabus:plan-today:…</strong>, <strong>psyllabus:plan-blocks:…</strong>{' '}
            {ar
              ? 'خطة اليوم كما عُرضت عليك أول مرة، حتى لا تتغير أثناء اليوم، وآخر ما أُرسل إلى تقويمك.'
              : 'today’s plan as it was first shown, so it does not reshuffle during the day, and what was last sent to your calendar.'}
          </li>
          <li>
            <strong>psyllabus:device</strong>{' '}
            {ar
              ? 'معرّف عشوائي لهذا الجهاز، يُستخدم فقط عند اختيار المادة المجانية حتى لا يجمع جهاز واحد حسابات مجانية كثيرة. لا نحفظ منه إلا بصمة لا يمكن تحويلها إليه.'
              : 'a random identifier for this device, used only when a free subject is chosen, so one device cannot collect many free accounts. Only a fingerprint of it, which cannot be turned back into it, is kept on our side.'}
          </li>
          <li>
            <strong>psyllabus:reminders-shown</strong>, <strong>psyllabus:study-heatmap-frame</strong>{' '}
            {ar
              ? 'التذكيرات التي عُرضت بالفعل حتى لا تتكرر، والفترة التي اخترتها في خريطة وقت المذاكرة.'
              : 'which reminders you have already seen, so they are not repeated, and the time frame you picked on the study heatmap.'}
          </li>
        </ul>
        <p>
          {ar
            ? 'ويُخزَّن على جهازك داخل التبويب فقط، ويُمحى عند إغلاقه:'
            : 'Stored on your device for this tab only, and erased when you close it:'}
        </p>
        <ul>
          <li>
            <strong>psy:…</strong>{' '}
            {ar
              ? 'نسخة مؤقتة من ملفك الشخصي والمنهج لتسريع التصفح.'
              : 'a short-lived copy of your profile and syllabus so pages open quickly.'}
          </li>
          <li>
            <strong>psyllabus:draft-studio</strong>, <strong>psyllabus:tutor:…</strong>{' '}
            {ar
              ? 'المسودة التي تحررها في Syllabi، والمادة والمحادثة المفتوحتان، حتى لا تفقدها عند تحديث الصفحة. أما محادثاتك وتقييماتك المحفوظة فتُخزَّن في حسابك لا على جهازك.'
              : 'the draft you are editing in Syllabi and which subject and chat are open, so a refresh does not lose them. Your saved chats and markings are kept on your account, not on your device.'}
          </li>
          <li>
            <strong>psyllabus_reloaded_after_error</strong>{' '}
            {ar
              ? 'علامة تمنع إعادة تحميل الصفحة أكثر من مرة بعد تحديث للتطبيق.'
              : 'a marker that stops the page reloading more than once after an update to the app.'}
          </li>
        </ul>
      </Clause>

      <Clause n="2" title={ar ? 'ما لا نستخدمه' : 'What is not used'}>
        <p>
          {ar
            ? 'لا نستخدم Google Analytics ولا أي أداة تحليل أخرى، ولا بكسل إعلانياً، ولا أزرار مشاركة، ولا خطوطاً أو مقاطع مضمّنة من مواقع خارجية، ولا ملفات تعريف ارتباط لتتبّعك عبر المواقع. لا نبيع بياناتك ولا نشاركها لأغراض تسويقية.'
            : 'There is no Google Analytics or any other analytics tool, no advertising pixel, no social sharing buttons, no embedded fonts or videos loaded from other sites, and no cookie that follows you anywhere else. Your data is not sold and not shared for marketing.'}
        </p>
      </Clause>

      <Clause n="3" title={ar ? 'لماذا لا تظهر نافذة موافقة' : 'Why there is no consent banner'}>
        <p>
          {ar
            ? 'ملفات تعريف الارتباط المذكورة أعلاه ضرورية تماماً لتشغيل الخدمة: بدونها لا يمكنك تسجيل الدخول. الملفات الضرورية لا تتطلب موافقة مسبقة. ولأننا لا نستخدم أي ملفات تحليلية أو إعلانية، فلا يوجد شيء تُطلب الموافقة عليه، ونافذة تطلب إذناً لا يمكنك رفضه هي مجرد مظهر شكلي.'
            : 'Everything above is strictly necessary to run the service: without it you cannot stay signed in. Strictly necessary cookies do not require prior consent, and because there is no analytics or advertising cookie, there is nothing left to ask about. A banner requesting permission for something you cannot decline would be theatre rather than a choice.'}
        </p>
        <p>
          {ar
            ? 'إذا أضفنا مستقبلاً أي أداة تحليل أو أي ملف غير ضروري، فسنطلب موافقتك أولاً ونحدّث هذه الصفحة قبل تفعيله.'
            : 'If analytics or any non-essential cookie is ever added, consent will be asked for first and this page updated before it is switched on.'}
        </p>
      </Clause>

      <Clause n="4" title={ar ? 'التحكم بها' : 'Controlling them'}>
        <p>
          {ar
            ? 'يمكنك حذف ملفات تعريف الارتباط أو حظرها من إعدادات متصفحك في أي وقت. حظر ملفات الجلسة يعني أنك لن تتمكن من تسجيل الدخول، وهو ما يعطّل الخدمة بالكامل. لحذف حسابك وبياناتك نهائياً، استخدم زر حذف الحساب في صفحة الملف الشخصي.'
            : 'You can delete or block cookies in your browser at any time. Blocking the session cookie means you will not be able to sign in, which disables the service entirely. To remove your account and data permanently, use the delete account button on your profile page.'}
        </p>
      </Clause>

      <Clause n="5" title={ar ? 'أسئلة' : 'Questions'}>
        <p>
          {ar ? 'للتواصل: ' : 'Contact: '}
          <a href={`mailto:${OPERATOR.dpoEmail}`}>{OPERATOR.dpoEmail}</a>.{' '}
          {ar ? 'انظر أيضاً ' : 'See also the '}
          <Link href="/privacy">{ar ? 'سياسة الخصوصية' : 'Privacy Policy'}</Link>.
        </p>
      </Clause>
    </LegalDoc>
  )
}

export default function CookiePolicyPage() {
  return (
    <Suspense fallback={null}>
      <Cookies />
    </Suspense>
  )
}
