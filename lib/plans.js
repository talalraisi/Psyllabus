/**
 * What the plans are, in one place.
 *
 * Three for students and one for schools, and the shape of them is the point:
 * the jump from free to basic is most of the product, and the jump from basic
 * to premium is one thing on top. That is deliberate. A student deciding
 * whether to pay at all is deciding about five subjects they cannot open; a
 * student already paying is deciding about a pound more.
 *
 * The school plan is premium for everybody at the school, bought by the
 * school. It is not one of the cards — a fifteen-year-old comparing plans is
 * not going to buy a site licence, and putting it beside the others makes the
 * page a procurement document. It lives at the foot of the page for the
 * teacher who came looking for it.
 *
 * Prices are here and nowhere else, so changing one is changing one number.
 * They are in US dollars because that is what the payment providers will want;
 * nothing takes money yet, which is why every plan's cta says so.
 *
 * Where these came from: Revision Village and Save My Exams charge about ten
 * to fifteen dollars a month, Quizlet Plus eight. Pricing under all of them
 * says "worth what you paid" — students do not buy the cheapest thing, and the
 * person with the card is a parent deciding whether this looks like it works.
 * So Basic sits just under the field and Premium just inside it.
 *
 * The annual price is the one most people should take, and is set at ten
 * months for twelve — a normal discount rather than a fake one.
 */

export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    priceLabel: 'Free',
    cadence: 'for as long as you want',
    tagline: 'One subject, properly.',
    includes: [
      'One subject, all of it',
      'Practice and test modes',
      'Study plan, calendar and streaks',
      'Flashcards, with its ready-made deck',
    ],
    excludes: ['Your other subjects', 'Exam mode', 'Predicted grade', 'Syllabi'],
    cta: 'Start free',
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 12,
    priceLabel: '$12',
    cadence: 'a month',
    annual: '$99 a year',
    tagline: 'All six subjects, not one.',
    includes: [
      'Every subject you take',
      'Exam mode: timed, marked at the end',
      'Predicted grade out of 45',
      'Ready-made decks for every subject',
    ],
    excludes: ['The subject map', 'Syllabi'],
    cta: 'Upgrade',
    note: 'Everything free gives you, six times over.',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 20,
    priceLabel: '$20',
    cadence: 'a month',
    annual: '$169 a year',
    tagline: 'Everything, including Syllabi.',
    includes: [
      'Everything in Basic',
      'Syllabi, your AI tutor, any time',
      'Drafts and Paper 1 and 2 answers marked',
      'Notes and photos turned into flashcards',
      'The subject map',
    ],
    excludes: [],
    cta: 'Upgrade',
    featured: true,
    note: 'The only plan with Syllabi.',
  },
]

/**
 * The same facts as the cards, in a grid.
 *
 * A card can hold six lines before it stops being read, and three cards of
 * different lengths do not line up — which is what made the page a list of
 * bullets rather than a comparison. So the cards say what each plan is for,
 * and this says exactly who gets what, row by row, where the eye can travel
 * across rather than down.
 */
export const COMPARISON = [
  {
    group: 'Your course',
    rows: [
      { label: 'Subjects', free: 'One', basic: 'All of yours', premium: 'All of yours' },
      { label: 'Every topic and subtopic', free: true, basic: true, premium: true },
      { label: 'Quizzes that set your levels', free: true, basic: true, premium: true },
      { label: 'Redemption for wrong answers', free: true, basic: true, premium: true },
      { label: 'Study plan, calendar and reminders', free: true, basic: true, premium: true },
      { label: 'Streaks, daily goal and analytics', free: true, basic: true, premium: true },
    ],
  },
  {
    group: 'Sitting papers',
    rows: [
      { label: 'Build your own paper', free: true, basic: true, premium: true },
      { label: 'Practice and test modes', free: true, basic: true, premium: true },
      { label: 'Exam mode, timed', free: false, basic: true, premium: true },
      { label: 'Predicted grade', free: false, basic: true, premium: true },
    ],
  },
  {
    group: 'Learning it',
    rows: [
      { label: 'Your own flashcards', free: true, basic: true, premium: true },
      { label: 'Ready-made decks', free: 'Your subject', basic: 'Every subject', premium: 'Every subject' },
      { label: 'The subject map', free: false, basic: false, premium: true },
    ],
  },
  {
    group: 'Syllabi, the AI tutor',
    rows: [
      { label: 'Ask anything, with photos, PDFs and links', free: false, basic: false, premium: true },
      { label: 'IA, EE and TOK drafts marked on the criteria', free: false, basic: false, premium: true },
      { label: 'Paper 1 and Paper 2 answers marked', free: false, basic: false, premium: true },
      { label: 'Notes and photos turned into flashcards', free: false, basic: false, premium: true },
      { label: 'Research question ideas', free: false, basic: false, premium: true },
    ],
  },
]

/** Bought by a school, given to its students. Not a card on the page. */
export const SCHOOL_PLAN = {
  name: 'For schools',
  blurb:
    'A code tied to your school’s email domain unlocks Premium for every student. No admin panel, no teacher dashboard, no seat counting. Students redeem it themselves and nobody at the school sees anybody’s results.',
  cta: 'Ask about a school licence',
}

export const planById = (id) => PLANS.find((p) => p.id === id) || PLANS[0]
