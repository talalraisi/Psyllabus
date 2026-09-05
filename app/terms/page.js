'use client'

import { Suspense } from 'react'
import { LegalDoc, Clause, useLegalLang } from '@/components/LegalDoc'
import { OPERATOR, isRegistered } from '@/lib/legal'

function Terms() {
  const [lang, setLang] = useLegalLang()
  const ar = lang === 'ar'

  return (
    <LegalDoc
      titles={{ en: 'Terms of Service', ar: 'شروط الاستخدام' }}
      updated={{ en: '5 September 2026', ar: '٥ سبتمبر ٢٠٢٦' }}
      lang={lang}
      setLang={setLang}
    >
      <p style={{ marginTop: 28 }}>
        {ar
          ? 'باستخدامك منصة Project Syllabus فإنك توافق على الشروط التالية. إذا كنت لا توافق عليها، فالرجاء عدم استخدام المنصة.'
          : 'By using Project Syllabus you agree to these terms. If you do not agree to them, please do not use the service.'}
      </p>

      <Clause n="1" title={ar ? 'من يقدّم الخدمة' : 'Who provides this service'}>
        <p>
          {isRegistered()
            ? ar
              ? `تُقدَّم منصة Project Syllabus من قبل ${OPERATOR.companyName}، السجل التجاري رقم ${OPERATOR.crNumber}، سلطنة عُمان.`
              : `Project Syllabus is provided by ${OPERATOR.companyName}, Commercial Registration No. ${OPERATOR.crNumber}, Sultanate of Oman.`
            : ar
              ? 'تُقدَّم المنصة حالياً من قبل طالب في مسقط، سلطنة عُمان، وهي قيد التسجيل كشركة.'
              : 'The service is currently provided by a student in Muscat, Sultanate of Oman, and is in the process of being registered as a company.'}
        </p>
      </Clause>

      <Clause n="2" title={ar ? 'من يحق له الاستخدام' : 'Who may use it'}>
        <p>
          {ar
            ? 'المنصة مخصّصة للطلاب الذين يدرسون مناهج ما قبل الجامعة. إذا كان عمرك دون الثامنة عشرة، يلزم حصولك على إذن ولي أمرك قبل إنشاء الحساب، وسيُطلب منك تأكيد ذلك عند التسجيل.'
            : 'The service is intended for students studying pre-university curricula. If you are under 18 you need your parent or guardian’s permission before creating an account, and you will be asked to confirm this at sign-up.'}
        </p>
        <p>
          {ar
            ? 'حسابك شخصي. لا تشارك بيانات الدخول مع غيرك، وأنت مسؤول عن أي نشاط يتم من خلال حسابك.'
            : 'Your account is personal to you. Do not share your login details, and you are responsible for activity carried out through your account.'}
        </p>
      </Clause>

      <Clause n="3" title={ar ? 'الاستخدام المقبول' : 'Acceptable use'}>
        <p>{ar ? 'يُمنع عليك:' : 'You must not:'}</p>
        <ul>
          <li>
            {ar
              ? 'استخراج بنك الأسئلة أو نسخه بالجملة أو إعادة بيعه أو إعادة نشره.'
              : 'Scrape, bulk-extract, resell or redistribute the question bank.'}
          </li>
          <li>
            {ar
              ? 'محاولة الوصول إلى بيانات مستخدم آخر أو الالتفاف على ضوابط الوصول.'
              : 'Attempt to access another user’s data or bypass access controls.'}
          </li>
          <li>
            {ar
              ? 'مشاركة رمز اشتراك مدرستك مع أشخاص من خارجها.'
              : 'Share your school’s access code with anyone outside that school.'}
          </li>
        </ul>
        <p>
          {ar
            ? 'رموز المدارس مرتبطة بنطاق البريد الإلكتروني للمدرسة أو تُصدر لكل طالب على حدة، ويمكن إلغاؤها. وإلغاء الرمز يعيد كل حساب دخل عبره إلى الخطة المجانية.'
            : 'School codes are tied to the school’s email domain or issued individually, and can be revoked. Revoking a code returns every account it admitted to the free plan.'}
        </p>
      </Clause>

      <Clause n="4" title={ar ? 'كيف تُكتب أسئلة الممارسة' : 'How the practice questions are made'}>
        <p>
          {ar
            ? 'جميع الأسئلة في المنصة محتوى أصلي، مكتوب ليطابق أسلوب أسئلة الامتحانات ومستوى صعوبتها وتوزيع درجاتها. ويمر كل سؤال بمرحلة تحقق آلية قبل عرضه عليك.'
            : 'Every question in the service is original content, written to match the style, difficulty and mark allocation of exam-board questions. Each one passes an automated verification step before it reaches you.'}
        </p>
        <p>
          <strong>
            {ar
              ? 'نحن لا ننسخ ولا نستضيف ولا نعيد نشر أوراق امتحانات سابقة أو مخططات تصحيح أو أي مادة امتحانية محمية بحقوق الطبع.'
              : 'We do not reproduce, host or redistribute past examination papers, mark schemes, or any other copyrighted examination material.'}
          </strong>
        </p>
        <p>
          {ar
            ? 'وعندما توجّهك المنصة إلى مصادر خارجية، فإنها تربطك بموقع الناشر الأصلي بدلاً من نسخ محتواه.'
            : 'Where the app points you to third-party resources, it links out to the rightful publisher rather than copying their content.'}
        </p>
      </Clause>

      <Clause n="5" title={ar ? 'دقة المحتوى' : 'Accuracy'}>
        <p>
          {ar
            ? 'تُولَّد الأسئلة آلياً ثم يجري التحقق منها، ورغم ذلك قد يمر خطأ من حين لآخر. لا تعتمد على المنصة كمصدر وحيد للحقيقة، وإذا وجدت سؤالاً يبدو خاطئاً فأبلغنا به.'
            : 'Questions are generated and then verified, but errors can still get through. Do not rely on the service as your only source of truth, and please report any question that looks wrong.'}
        </p>
        <p>
          {ar
            ? 'الدرجة المتوقعة التي تعرضها المنصة أداة دراسية تعتمد على أدائك في الاختبارات داخل التطبيق. وهي ليست تنبؤاً بنتيجتك النهائية ولا ضماناً لها، ولا علاقة لها بأي جهة امتحانية.'
            : 'The predicted grade shown in the app is a study aid based on your performance within it. It is not a prediction of, nor a guarantee of, your actual examination result, and it has no connection to any examination board.'}
        </p>
      </Clause>

      <Clause n="6" title={ar ? 'عدم الانتساب' : 'No affiliation'}>
        <p>
          {ar
            ? 'Project Syllabus منتج مستقل. وهو غير منتسب إلى منظمة البكالوريا الدولية أو Cambridge Assessment أو Pearson Edexcel أو AQA أو OCR أو College Board، وغير معتمد أو مُصادق عليه من أي منها، ولا تربطه بها أي صفة رسمية.'
            : 'Project Syllabus is an independent product. It is not affiliated with, authorised by, endorsed by, or officially connected to the International Baccalaureate Organization, Cambridge Assessment, Pearson Edexcel, AQA, OCR or the College Board.'}
        </p>
        <p>
          {ar
            ? 'أسماء «البكالوريا الدولية» و«IB» و«A-Level» و«AP» و«Advanced Placement» علامات تجارية مملوكة لأصحابها، وتُستخدم هنا للإشارة الوصفية فقط.'
            : '“International Baccalaureate”, “IB”, “A-Level”, “AP” and “Advanced Placement” are trademarks of their respective owners, used here descriptively only.'}
        </p>
      </Clause>

      <Clause n="7" title={ar ? 'الحسابات المجانية والمدفوعة' : 'Free and paid accounts'}>
        <p>
          {ar
            ? 'تفتح الخطة المجانية مادة دراسية واحدة تختارها، بلا حد زمني ودون الحاجة إلى بطاقة. ويمكنك تغيير المادة، مع فترة انتظار بين تغيير وآخر.'
            : 'The free plan opens one subject of your choosing, with no time limit and no card required. You can change which subject, subject to a waiting period between changes.'}
        </p>
        <p>
          {ar
            ? 'لم تُفعَّل المدفوعات بعد. وعند تفعيلها ستُنشر شروط الدفع والاسترداد قبل إمكانية إجراء أي عملية شراء.'
            : 'Payments are not yet enabled. When they are, payment and refund terms will be published before any purchase can be made.'}
        </p>
      </Clause>

      <Clause n="8" title={ar ? 'الإتاحة' : 'Availability'}>
        <p>
          {ar
            ? 'تُقدَّم الخدمة «كما هي». ونسعى لإبقائها متاحة وموثوقة، لكننا لا نضمن عملها دون انقطاع، وقد تتغير الميزات أو تُزال.'
            : 'The service is provided as-is. We aim to keep it available and reliable but do not guarantee uninterrupted operation, and features may change or be removed.'}
        </p>
        <p>
          {ar
            ? 'يمكنك حذف حسابك في أي وقت من صفحة الحساب. ويحق لنا إيقاف حساب يخالف هذه الشروط، مع إشعارك بالسبب متى أمكن ذلك.'
            : 'You may delete your account at any time from your profile page. We may suspend an account that breaches these terms, and will tell you why where we can.'}
        </p>
      </Clause>

      <Clause n="9" title={ar ? 'حدود المسؤولية' : 'Limitation of liability'}>
        <p>
          {ar
            ? 'المنصة أداة للدراسة، ونتيجتك في الامتحان تعتمد عليك أنت. وفي حدود ما يسمح به القانون، لا نتحمل المسؤولية عن نتائج دراسية أو أي خسارة ناتجة عن الاعتماد على المنصة.'
            : 'This is a study tool, and your examination result depends on you. To the extent permitted by law, we accept no liability for academic outcomes or for any loss arising from reliance on the service.'}
        </p>
      </Clause>

      <Clause n="10" title={ar ? 'الخصوصية' : 'Privacy'}>
        <p>
          {ar
            ? 'توضّح سياسة الخصوصية البيانات التي نجمعها وسبب جمعها وحقوقك عليها، وهي جزء لا يتجزأ من هذه الشروط.'
            : 'Our privacy policy sets out what we collect, why, and what rights you have over it. It forms part of these terms.'}
        </p>
      </Clause>

      <Clause n="11" title={ar ? 'القانون الواجب التطبيق' : 'Governing law'}>
        <p>
          {ar
            ? 'تخضع هذه الشروط لقوانين سلطنة عُمان وتُفسَّر وفقاً لها، وتختص محاكم السلطنة بالنظر في أي نزاع ينشأ عنها.'
            : 'These terms are governed by the laws of the Sultanate of Oman, and the courts of Oman have jurisdiction over any dispute arising from them.'}
        </p>
      </Clause>

      <Clause n="12" title={ar ? 'التواصل' : 'Contact'}>
        <p>
          {ar ? 'لأي استفسار بشأن هذه الشروط: ' : 'For any question about these terms: '}
          <a href={`mailto:${OPERATOR.dpoEmail}`}>{OPERATOR.dpoEmail}</a>
        </p>
      </Clause>
    </LegalDoc>
  )
}

export default function TermsPage() {
  return (
    <Suspense fallback={null}>
      <Terms />
    </Suspense>
  )
}
