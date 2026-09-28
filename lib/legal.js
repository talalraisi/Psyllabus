/**
 * Who operates this service, and under what.
 *
 * One place for the details that have to appear on the privacy policy and in
 * the footer, so registering the company means editing a single file rather
 * than hunting through pages.
 *
 * Everything reads from here and degrades honestly: until a Commercial
 * Registration exists, nothing claims one. A footer reading
 * "CR: [Insert CR Number]" is worse than no footer at all, and a school's IT
 * department will read it as carelessness about exactly the thing they are
 * being asked to trust.
 */

export const OPERATOR = {
  // Fill these in once the company is registered on Invest Easy.
  companyName: null, // e.g. 'Al-Raisi Technology LLC'
  crNumber: null, // e.g. '1234567'

  // Where data protection requests actually land. Must be monitored.
  dpoEmail: 'talalraisi1@gmail.com',

  // Sub-processors. Named because the law requires it and because a school
  // will ask where the data physically sits.
  processors: [
    { name: 'Supabase', role: 'Database and authentication', region: 'Singapore (ap-southeast-1)' },
    { name: 'Vercel', role: 'Website hosting', region: 'Global edge network' },
  ],

  /* The law, as it now stands.
     6/2022 is the law itself, 68/2026 amended it, and 34/2024 is the executive
     regulation that carries most of the operative detail. The ministry's own
     September 2026 consent guide cites all three, and a policy citing only the
     original reads as one written before the amendment and never revisited. */
  law: {
    en: 'Oman Personal Data Protection Law (Royal Decree No. 6/2022, as amended by Royal Decree No. 68/2026), and its Executive Regulation (Ministerial Decision No. 34/2024)',
    ar: 'قانون حماية البيانات الشخصية العماني (المرسوم السلطاني رقم ٦/٢٠٢٢، المعدل بالمرسوم السلطاني رقم ٦٨/٢٠٢٦)، ولائحته التنفيذية (القرار الوزاري رقم ٣٤/٢٠٢٤)',
  },
}

export const isRegistered = () => Boolean(OPERATOR.companyName && OPERATOR.crNumber)

/** The line that sits at the foot of every page. */
export function operatorLine() {
  const year = new Date().getFullYear()
  if (isRegistered()) {
    return `© ${year} Project Syllabus. Operated by ${OPERATOR.companyName} (CR: ${OPERATOR.crNumber}).`
  }
  // True before registration, and says nothing it cannot back up.
  return `© ${year} Project Syllabus. Built in Muscat, Oman.`
}

/** What we tell people we collect. Kept here so the policy cannot drift from it. */
export const DATA_COLLECTED = [
  {
    en: 'Your name and email address',
    ar: 'الاسم والبريد الإلكتروني',
    why: { en: 'To create and sign you into your account.', ar: 'لإنشاء حسابك وتسجيل الدخول.' },
  },
  {
    en: 'Your curriculum, subjects, graduation year and target grades',
    ar: 'المنهج الدراسي والمواد وسنة التخرج والدرجات المستهدفة',
    why: {
      en: 'To show you the right syllabus and measure progress against your own goals.',
      ar: 'لعرض المنهج الصحيح وقياس تقدمك مقارنة بأهدافك.',
    },
  },
  {
    en: 'Your quiz answers and study progress',
    ar: 'إجاباتك في الاختبارات وتقدمك الدراسي',
    why: {
      en: 'To work out what you know and what to study next. This is the service.',
      ar: 'لتحديد ما تعرفه وما يجب دراسته لاحقاً، وهي الخدمة الأساسية.',
    },
  },
  {
    en: 'A profile photo, only if you upload one',
    ar: 'صورة الملف الشخصي، فقط إذا قمت برفعها',
    why: { en: 'Shown only to you.', ar: 'تظهر لك وحدك.' },
  },
]

export const NOT_COLLECTED = {
  en: 'We do not collect health data, biometric data, financial data, location, or anything about your race, religion or political views. We do not use tracking or advertising cookies, and we do not sell or share your data with anyone for marketing.',
  ar: 'نحن لا نجمع بيانات صحية أو حيوية أو مالية أو بيانات الموقع، ولا أي بيانات تتعلق بالعرق أو الدين أو الآراء السياسية. لا نستخدم ملفات تعريف الارتباط للتتبع أو الإعلانات، ولا نبيع بياناتك أو نشاركها لأغراض تسويقية.',
}
