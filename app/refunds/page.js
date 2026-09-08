'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { LegalDoc, Clause, useLegalLang } from '@/components/LegalDoc'
import { OPERATOR, isRegistered } from '@/lib/legal'

/**
 * Refund policy.
 *
 * Written now rather than at the moment money starts moving, because the
 * prices are already on the pricing page and someone reading them is entitled
 * to know the terms before they decide to care. The first clause says the part
 * that matters most today: nothing can be charged yet, so nothing needs
 * refunding yet, and any page suggesting otherwise is wrong.
 */
function Refunds() {
  const [lang, setLang] = useLegalLang()
  const ar = lang === 'ar'

  return (
    <LegalDoc
      titles={{ en: 'Refund Policy', ar: 'سياسة الاسترداد' }}
      updated={{ en: '8 September 2026', ar: '٨ سبتمبر ٢٠٢٦' }}
      lang={lang}
      setLang={setLang}
    >
      <p style={{ marginTop: 28 }}>
        {ar
          ? 'توضح هذه السياسة متى يمكنك استرداد ما دفعته وكيف. وهي مكتوبة قبل فتح الدفع، لأن الأسعار معروضة بالفعل ومن حق من يقرأها أن يعرف الشروط مسبقاً.'
          : 'This policy sets out when you can get your money back and how. It is written before payments open, because the prices are already published and anyone reading them is entitled to know the terms first.'}
      </p>

      <Clause n="1" title={ar ? 'لا يوجد دفع حالياً' : 'Nothing is charged today'}>
        <p>
          {ar
            ? 'الدفع بالبطاقة غير مفعّل. لا يمكن للمنصة حالياً تحصيل أي مبلغ منك، ولا نطلب بيانات بطاقة ولا نخزّنها. الحساب المجاني مجاني بلا حد زمني. إذا طُلب منك الدفع في مكان ما باسم Project Syllabus، فهذا ليس منّا.'
            : 'Card payments are not switched on. The service cannot currently take money from you, and no card details are requested or stored anywhere. The free account is free with no time limit. If you are ever asked to pay something in the name of Project Syllabus, it did not come from us.'}
        </p>
        <p>
          {ar
            ? 'الشروط أدناه تصبح سارية عند فتح الدفع، وستُحدَّث هذه الصفحة بتاريخ التفعيل.'
            : 'The terms below take effect when payments open, and this page will be updated with the date that happens.'}
        </p>
      </Clause>

      <Clause n="2" title={ar ? 'الاشتراكات الفردية' : 'Individual subscriptions'}>
        <p>
          {ar
            ? 'يمكنك طلب استرداد كامل خلال ١٤ يوماً من أي عملية دفع، لأي سبب، دون الحاجة إلى تبرير. أرسل بريداً من العنوان المسجّل في حسابك وسنعيد المبلغ إلى وسيلة الدفع نفسها.'
            : 'You can ask for a full refund within 14 days of any payment, for any reason, without having to justify it. Email from the address on your account and the money goes back to the same card.'}
        </p>
        <p>
          {ar
            ? 'بعد ١٤ يوماً: يمكنك الإلغاء في أي وقت فيستمر اشتراكك حتى نهاية الفترة المدفوعة ثم يتوقف التجديد. لا نسترد الفترات الماضية تلقائياً، لكن إذا كانت الخدمة معطّلة أو لم تعمل كما هو موصوف، راسلنا وسنعالج الأمر.'
            : 'After 14 days: you can cancel at any time, your access runs to the end of the period you paid for, and it does not renew. Past periods are not refunded automatically, but if the service was broken or did not do what it said it did, write to us and we will sort it out.'}
        </p>
      </Clause>

      <Clause n="3" title={ar ? 'اشتراكات المدارس' : 'School subscriptions'}>
        <p>
          {ar
            ? 'ترتيبات المدارس تُبرم باتفاق مكتوب، وشروط الاسترداد تُحدَّد فيه وتسري على ما هو مكتوب في الاتفاق قبل أي شيء في هذه الصفحة. الحد الأدنى: استرداد كامل خلال ٣٠ يوماً من بداية الاشتراك إذا لم تُستخدم الأكواد.'
            : 'School arrangements are made by written agreement, and the refund terms are set out in it; where they differ from this page, the agreement governs. The floor is a full refund within 30 days of the start of the subscription if the codes have not been used.'}
        </p>
      </Clause>

      <Clause n="4" title={ar ? 'كيف تطلب الاسترداد' : 'How to ask'}>
        <p>
          {ar ? 'راسلنا على ' : 'Email '}
          <a href={`mailto:${OPERATOR.dpoEmail}?subject=Refund%20request`}>{OPERATOR.dpoEmail}</a>
          {ar
            ? ' من البريد المسجّل في حسابك، مع ذكر تاريخ الدفع تقريباً. نردّ خلال ٥ أيام عمل، ويستغرق وصول المبلغ إلى البنك عادةً من ٥ إلى ١٠ أيام إضافية.'
            : ' from the address on your account, saying roughly when you paid. We reply within 5 working days, and the money usually takes a further 5 to 10 days to appear on your statement.'}
        </p>
      </Clause>

      <Clause n="5" title={ar ? 'حقوقك القانونية' : 'Your legal rights'}>
        <p>
          {ar
            ? 'لا تنتقص هذه السياسة من أي حق يمنحك إياه قانون حماية المستهلك في بلدك. إذا منحك القانون حقاً أوسع مما هو مذكور هنا، فالقانون هو الذي يسري.'
            : 'Nothing here reduces any right consumer law in your country gives you. Where the law gives you more than this page does, the law applies.'}
        </p>
        {!isRegistered() && (
          <p>
            {ar
              ? 'المنصة قيد التسجيل كشركة في سلطنة عُمان. لن يُفتح الدفع قبل اكتمال التسجيل، وستُحدَّث هذه الصفحة باسم الشركة ورقم السجل التجاري.'
              : 'The service is in the process of being registered as a company in Oman. Payments will not open before that is complete, and this page will be updated with the company name and Commercial Registration number.'}
          </p>
        )}
        <p>
          {ar ? 'انظر أيضاً ' : 'See also the '}
          <Link href="/terms">{ar ? 'الشروط والأحكام' : 'Terms and Conditions'}</Link>
          {ar ? ' و' : ' and '}
          <Link href="/privacy">{ar ? 'سياسة الخصوصية' : 'Privacy Policy'}</Link>.
        </p>
      </Clause>
    </LegalDoc>
  )
}

export default function RefundPolicyPage() {
  return (
    <Suspense fallback={null}>
      <Refunds />
    </Suspense>
  )
}
