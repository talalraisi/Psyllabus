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
      'Planner, calendar and flashcards',
    ],
    excludes: ['Your other five subjects', 'Syllabi'],
    cta: 'Start free',
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 4,
    priceLabel: '$4',
    cadence: 'a month',
    tagline: 'All six subjects, not one.',
    includes: [
      'Every subject you take',
      'The study planner across all of them',
      'Predicted grade out of 45',
      'Timed papers and exam mode',
      'Ready-made flashcard decks',
      'Calendar, deadlines and reminders',
    ],
    excludes: ['Syllabi'],
    cta: 'Upgrade',
    note: 'Everything above, six times over.',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 6,
    priceLabel: '$6',
    cadence: 'a month',
    tagline: 'Basic, plus Syllabi.',
    includes: [
      'Everything in Basic',
      'Syllabi reads your IA, EE or TOK draft',
      'Research question ideas, six at a time',
      'How to study a subject, from your own results',
      'New subjects as they land',
    ],
    excludes: [],
    cta: 'Upgrade',
    featured: true,
    note: 'Two pounds more than Basic, and the only plan with Syllabi.',
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
