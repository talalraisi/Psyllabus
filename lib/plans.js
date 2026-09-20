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
      'One subject, chosen by you',
      'Every topic and subtopic of it',
      'Quizzes that set your levels',
      'Redemption for what you get wrong',
      'Your own flashcards, planner and to-do',
    ],
    excludes: [
      'Your other five subjects',
      'Timed papers and exam mode',
      'Predicted grade out of 45',
      'Ready-made flashcard decks',
      'The subject map',
      'Syllabi',
    ],
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
      'The study planner across all of them',
      'Predicted grade out of 45',
      'Timed papers and exam mode',
      'Ready-made flashcard decks',
      'Calendar, deadlines and reminders',
    ],
    excludes: ['The subject map', 'Syllabi', 'New subjects first'],
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
      'Syllabi reads your IA, EE or TOK draft',
      'Research question ideas, six at a time',
      'How to study a subject, from your own results',
      'The subject map: your whole course as one picture',
      'New subjects the week they land',
    ],
    excludes: [],
    cta: 'Upgrade',
    featured: true,
    note: 'The only plan with Syllabi.',
  },
]

/** Bought by a school, given to its students. Not a card on the page. */
export const SCHOOL_PLAN = {
  name: 'For schools',
  blurb:
    'A code tied to your school’s email domain unlocks Premium for every student. No admin panel, no teacher dashboard, no seat counting — students redeem it themselves and nobody at the school sees anybody’s results.',
  cta: 'Ask about a school licence',
}

export const planById = (id) => PLANS.find((p) => p.id === id) || PLANS[0]
