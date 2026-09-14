/**
 * The exact wording a student agrees to.
 *
 * Stored alongside the timestamp rather than just a boolean, so changing this
 * later cannot retroactively change what somebody actually consented to.
 *
 * It lives here rather than on the sign-up page because two screens ask for it
 * now: the e-mail form, and onboarding for anyone who came in through Google
 * and never saw that form. Importing a page component into another page to
 * reach one string drags the whole page into the other's bundle.
 */
export const CONSENT_TEXT = {
  en: 'I have my parent or guardian’s permission to use Project Syllabus.',
  ar: 'لدي موافقة ولي أمري على استخدام منصة Project Syllabus.',
}
