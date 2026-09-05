'use client'

import { Suspense } from 'react'
import { LegalDoc, Clause, useLegalLang } from '@/components/LegalDoc'
import { OPERATOR, isRegistered } from '@/lib/legal'

function Privacy() {
  const [lang, setLang] = useLegalLang()
  const ar = lang === 'ar'

  return (
    <LegalDoc
      titles={{ en: 'Privacy Policy', ar: 'سياسة الخصوصية' }}
      updated={{ en: '5 September 2026', ar: '٥ سبتمبر ٢٠٢٦' }}
      lang={lang}
      setLang={setLang}
    >
      <p style={{ marginTop: 28 }}>
        {ar
          ? 'توضح هذه السياسة البيانات التي تجمعها منصة Project Syllabus عنك، وسبب جمعها، وما يمكنك فعله حيالها. وهي مكتوبة لتُقرأ، لا لتُتصفح.'
          : 'This policy sets out what Project Syllabus collects about you, why, and what you can do about it. It is written to be read rather than skimmed.'}
      </p>

      <Clause n="1" title={ar ? 'من يشغّل هذه المنصة' : 'Who operates this service'}>
        {isRegistered() ? (
          <p>
            {ar
              ? `تُشغَّل منصة Project Syllabus من قبل ${OPERATOR.companyName}، السجل التجاري رقم ${OPERATOR.crNumber}، سلطنة عُمان، وهي الجهة المتحكمة في البيانات.`
              : `Project Syllabus is operated by ${OPERATOR.companyName}, Commercial Registration No. ${OPERATOR.crNumber}, Sultanate of Oman, which is the data controller.`}
          </p>
        ) : (
          <p>
            {ar
              ? 'تُشغَّل المنصة حالياً من قبل طالب في مسقط، سلطنة عُمان، وهي قيد التسجيل كشركة. سيُحدَّث هذا البند برقم السجل التجاري واسم الشركة فور صدورهما.'
              : 'The service is currently operated by a student in Muscat, Sultanate of Oman, and is in the process of being registered as a company. This clause will be updated with the company name and Commercial Registration number once issued.'}
          </p>
        )}
        <p>
          {ar
            ? `تُعالَج البيانات الشخصية وفقاً لـ ${OPERATOR.law.ar}.`
            : `Personal data is processed in accordance with the ${OPERATOR.law.en}.`}
        </p>
        <p>
          {ar ? 'للتواصل بشأن حماية البيانات: ' : 'Data protection contact: '}
          <a href={`mailto:${OPERATOR.dpoEmail}`}>{OPERATOR.dpoEmail}</a>
        </p>
      </Clause>

      <Clause n="2" title={ar ? 'البيانات التي نجمعها' : 'What we collect'}>
        <p>{ar ? 'نجمع ما يلي فقط:' : 'We collect only the following:'}</p>
        <ul>
          <li>
            {ar
              ? 'اسمك وبريدك الإلكتروني، لإنشاء حسابك وتسجيل دخولك.'
              : 'Your name and email address, to create your account and sign you in.'}
          </li>
          <li>
            {ar
              ? 'منهجك الدراسي وموادك وسنة تخرجك ودرجاتك المستهدفة، لعرض المنهج الصحيح وقياس تقدمك مقارنة بأهدافك أنت.'
              : 'Your curriculum, subjects, graduation year and target grades, to show you the correct syllabus and measure progress against goals you set yourself.'}
          </li>
          <li>
            {ar
              ? 'إجاباتك في الاختبارات وتقدمك الدراسي والوقت الذي تستغرقه في كل سؤال. هذه هي الخدمة نفسها: بدونها لا يمكن للمنصة أن تعرف ما تعرفه.'
              : 'Your quiz answers, study progress and time spent per question. This is the service itself: without it the app cannot know what you know.'}
          </li>
          <li>
            {ar
              ? 'صورة الملف الشخصي، فقط إذا اخترت رفعها، وتظهر لك وحدك.'
              : 'A profile photo, only if you choose to upload one. It is shown only to you.'}
          </li>
        </ul>
      </Clause>

      <Clause n="3" title={ar ? 'ما لا نجمعه' : 'What we do not collect'}>
        <p>
          {ar
            ? 'لا نجمع بيانات صحية أو حيوية أو مالية، ولا بيانات الموقع الجغرافي، ولا أي بيانات تتعلق بالعرق أو الدين أو الآراء السياسية أو أي فئة أخرى من البيانات الحساسة.'
            : 'We do not collect health data, biometric data, financial data, location data, or anything relating to race, religion, political opinion or any other special category.'}
        </p>
        <p>
          {ar
            ? 'لا نستخدم ملفات تعريف ارتباط للتتبع أو للإعلانات. ملفات تعريف الارتباط الوحيدة المستخدمة هي تلك اللازمة لإبقائك مسجّل الدخول.'
            : 'We use no tracking or advertising cookies. The only cookies set are the ones required to keep you signed in.'}
        </p>
      </Clause>

      <Clause n="4" title={ar ? 'أساس المعالجة' : 'Why we are allowed to hold it'}>
        <p>
          {ar
            ? 'نعالج بياناتك بناءً على موافقتك الصريحة، التي تُمنح عند إنشاء الحساب. ولأن معظم مستخدمي المنصة دون سن الثامنة عشرة، تشمل هذه الموافقة إقراراً بالحصول على إذن ولي الأمر. يمكنك سحب موافقتك في أي وقت بحذف حسابك، دون الحاجة إلى مراسلتنا.'
            : 'We process your data on the basis of your consent, given when you create an account. Because most people using this are under 18, that consent includes a confirmation that you have your parent or guardian’s permission. You can withdraw consent at any time by deleting your account, without needing to contact us.'}
        </p>
      </Clause>

      <Clause n="5" title={ar ? 'الطلاب دون سن الثامنة عشرة' : 'Students under 18'}>
        <p>
          {ar
            ? 'يتطلب إنشاء الحساب تأكيداً صريحاً بأن الطالب حصل على إذن من ولي أمره. ونحتفظ بسجل يتضمن وقت منح هذه الموافقة والنص الذي وافق عليه الطالب بالضبط، لا مجرد إشارة إلى حدوثها.'
            : 'Creating an account requires an explicit confirmation that the student has permission from a parent or guardian. We keep a record of when that confirmation was given and the exact wording agreed to, not merely that it happened.'}
        </p>
        <p>
          {ar
            ? 'يحق لولي الأمر في أي وقت طلب الاطلاع على بيانات ابنه أو تصحيحها أو حذفها نهائياً، عبر البريد الإلكتروني المذكور في البند ١.'
            : 'A parent or guardian may at any time request to see, correct or permanently delete their child’s data, using the address in clause 1.'}
        </p>
      </Clause>

      <Clause n="6" title={ar ? 'أين تُخزَّن البيانات ومن يعالجها' : 'Where it is stored and who processes it'}>
        <p>
          {ar
            ? 'نستعين بمزوّدي الخدمات التاليين. لا يستخدم أي منهم بياناتك لأغراضه الخاصة، ولا يُسمح لأي منهم ببيعها أو مشاركتها.'
            : 'We use the following providers. None of them use your data for their own purposes, and none are permitted to sell or share it.'}
        </p>
        <ul>
          {OPERATOR.processors.map((p) => (
            <li key={p.name}>
              <strong>{p.name}</strong>
              {' — '}
              {p.role}. {p.region}.
            </li>
          ))}
        </ul>
        <p>
          {ar
            ? 'خوادم قواعد البيانات موجودة خارج سلطنة عُمان، وباستخدامك للمنصة فإنك توافق على نقل بياناتك ومعالجتها في تلك الولايات القضائية.'
            : 'Database servers are located outside Oman. By using the service you consent to your data being transferred to and processed in those jurisdictions.'}
        </p>
      </Clause>

      <Clause n="7" title={ar ? 'مدة الاحتفاظ' : 'How long we keep it'}>
        <p>
          {ar
            ? 'نحتفظ ببياناتك ما دام حسابك قائماً. عند حذف الحساب تُحذف البيانات فوراً وبشكل نهائي، ولا يُحتفظ بنسخة مؤرشفة ولا يمكن استرجاعها.'
            : 'We keep your data for as long as your account exists. When you delete your account it is removed immediately and permanently. No archived copy is kept and it cannot be recovered.'}
        </p>
      </Clause>

      <Clause n="8" title={ar ? 'من يستطيع رؤية نتائجك' : 'Who can see your results'}>
        <p>
          {ar
            ? 'لا أحد سواك. لا توجد حسابات للمعلمين ولا لوحات تحكم للصفوف الدراسية، ولن توجد. وعندما تشتري مدرسة اشتراكاً، فإن ذلك يفتح المنصة لطلابها فقط ولا يمنحها أي شيء آخر.'
            : 'Nobody but you. There are no teacher accounts and no class dashboards, and there will not be. When a school buys a licence, that unlocks the app for its students and gives the school nothing else.'}
        </p>
        <p>
          {ar
            ? 'هذا مفروض على مستوى قاعدة البيانات عبر سياسات أمان الصفوف، وليس مجرد إعداد في الواجهة يمكن لأحدهم تغييره.'
            : 'This is enforced at the database level through row-level security policies, not by an interface setting that somebody could change.'}
        </p>
      </Clause>

      <Clause n="9" title={ar ? 'حقوقك' : 'Your rights'}>
        <p>
          {ar
            ? 'بموجب قانون حماية البيانات الشخصية العماني، يحق لك:'
            : 'Under the Oman Personal Data Protection Law you have the right to:'}
        </p>
        <ul>
          <li>{ar ? 'الاطلاع على كل ما نحتفظ به عنك.' : 'See everything we hold about you.'}</li>
          <li>{ar ? 'تصحيح أي بيانات غير دقيقة.' : 'Correct anything that is inaccurate.'}</li>
          <li>
            {ar
              ? 'حذف حسابك وجميع بياناتك نهائياً. يمكنك تنفيذ ذلك بنفسك من صفحة حسابك دون مراسلتنا.'
              : 'Delete your account and all associated data permanently. You can do this yourself from your profile page without contacting us.'}
          </li>
          <li>{ar ? 'سحب موافقتك في أي وقت.' : 'Withdraw your consent at any time.'}</li>
          <li>
            {ar
              ? 'تقديم شكوى إلى الجهة المختصة في سلطنة عُمان إذا رأيت أن بياناتك عولجت بشكل غير سليم.'
              : 'Complain to the relevant authority in Oman if you believe your data has been handled improperly.'}
          </li>
        </ul>
      </Clause>

      <Clause n="10" title={ar ? 'التغييرات على هذه السياسة' : 'Changes to this policy'}>
        <p>
          {ar
            ? 'إذا طرأ تغيير جوهري على طريقة تعاملنا مع البيانات، سنُخطرك عبر البريد الإلكتروني قبل سريان التغيير، لا بعده.'
            : 'If anything material changes about how data is handled, we will email you before the change takes effect, not after.'}
        </p>
      </Clause>

      <Clause n="11" title={ar ? 'التواصل' : 'Contact'}>
        <p>
          {ar ? 'لأي سؤال أو طلب يتعلق ببياناتك: ' : 'For any question or request about your data: '}
          <a href={`mailto:${OPERATOR.dpoEmail}`}>{OPERATOR.dpoEmail}</a>
        </p>
      </Clause>
    </LegalDoc>
  )
}

export default function PrivacyPage() {
  return (
    <Suspense fallback={null}>
      <Privacy />
    </Suspense>
  )
}
