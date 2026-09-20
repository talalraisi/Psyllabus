/**
 * The pricing page lists what each plan misses. This checks the app agrees.
 *
 * A page claiming Basic has no subject map while the app hands it over is not
 * generosity, it is a lying page — so every exclusion printed on a card is
 * asserted here against the real entitlement check.
 */
// The app's modules import without extensions for the bundler, so this test
// is run through Next rather than node directly:
//   npx next build   (which type-checks them)
// or with a loader that resolves extensions. Kept here as the record of what
// the pricing page promises.
import { canUse, getTier } from '../lib/access.js'
import { PLANS } from '../lib/plans.js' 

// What each printed line means in feature terms.
const FEATURE_OF = {
  'Your other five subjects': 'allSubjects',
  'Timed papers and exam mode': 'timedPapers',
  'Predicted grade out of 45': 'prediction',
  'Ready-made flashcard decks': 'presetDecks',
  'The subject map': 'subjectMap',
  'Syllabi': 'syllabi',
  'New subjects first': null,       // a promise about release order, not a gate
};

const PROFILE = {
  free: { plan: 'free', subjects: ['A', 'B'], free_subject: 'A' },
  basic: { plan: 'basic', subjects: ['A', 'B'] },
  premium: { plan: 'premium', subjects: ['A', 'B'] },
};

let failed = 0;
const check = (name, ok) => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); };

check("tiers rank free < basic < premium",
  getTier(PROFILE.free) === 'free' && getTier(PROFILE.basic) === 'basic' && getTier(PROFILE.premium) === 'premium');

for (const plan of PLANS) {
  const profile = PROFILE[plan.id];
  for (const line of plan.excludes) {
    const feature = FEATURE_OF[line];
    if (feature === undefined) { console.log(`FAIL  ${plan.name} lists "${line}" and nothing maps to it`); failed++; continue; }
    if (feature === null) continue;
    check(`${plan.name} really cannot use ${feature}`, canUse(feature, profile) === false);
  }
  // And everything it advertises, it has.
  for (const [line, feature] of Object.entries(FEATURE_OF)) {
    if (feature && !plan.excludes.includes(line)) {
      check(`${plan.name} can use ${feature}`, canUse(feature, profile) === true);
    }
  }
}

check("a school code grants premium", canUse('syllabi', { plan: 'free', access_expires_at: new Date(Date.now() + 86400000).toISOString() }));
check("an expired code does not", canUse('syllabi', { plan: 'free', access_expires_at: new Date(Date.now() - 86400000).toISOString() }) === false);
check("free keeps the core loop", ['subtopicQuiz','heatmap','redemption','ownFlashcards','planner','todo'].every(f => canUse(f, PROFILE.free)));

console.log(failed ? `\n${failed} failing` : "\nthe page and the app agree");
process.exit(failed ? 1 : 0);
