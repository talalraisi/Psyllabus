// node scripts/draft-review-test.mjs
import { cleanReview, segments } from '../lib/draft-review.js'
import { rubricFor } from '../lib/criteria.js'

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : `  (${detail})`}`)
}

const draft = `The aim of this investigation is to find how “temperature” affects the rate of reaction.
I measured   the time taken for the cross to disappear five times at each temperature.
The results show a clear trend, although the uncertainty at 60 °C is large.`

const model = JSON.stringify({
  criteria: [
    { id: 'A', name: 'Research design', max: 6, score: 5, comment: 'Clear aim.' },
    { id: 'b', name: 'Data analysis', max: 6, score: 9, comment: 'Over the max on purpose.' },
    { id: 'C', name: 'Conclusion', max: 6, score: -2, comment: 'Negative on purpose.' },
    { id: 'Z', name: 'Made up', max: 6, score: 6, comment: 'Not a real criterion.' },
  ],
  grade_estimate: '5',
  grade_note: 'Solid start.',
  highlights: [
    { quote: 'how "temperature" affects the rate', criterion: 'A', kind: 'strength', comment: 'Focused.' },
    { quote: 'I measured the time taken for the cross', criterion: 'A', kind: 'issue', comment: 'Spacing differs from the draft.' },
    { quote: 'this sentence is not in the draft at all', criterion: 'B', kind: 'issue', comment: 'Invented.' },
    { quote: 'the uncertainty at 60 °C is large', criterion: 'Q', kind: 'odd', comment: 'Bad criterion and kind.' },
  ],
  strengths: ['Aim'],
  questions: ['Why five repeats?'],
  next_step: 'Add uncertainties.',
})

const r = cleanReview(model, draft, rubricFor('ia', 'Chemistry HL'))
check('parses', !!r)
check('uses the real four criteria, in order', r.criteria.map((c) => c.id).join('') === 'ABCD')
check('a lower-case id still finds its criterion', r.criteria[1].comment === 'Over the max on purpose.')
check('marks are clamped to the maximum', r.criteria[1].score === 6)
check('marks are never negative', r.criteria[2].score === 0)
check('a criterion the model skipped scores zero', r.criteria[3].score === 0)
check('invented quotes are dropped', r.highlights.length === 3, String(r.highlights.length))
check('curly quotes and extra spaces still match', r.highlights.some((h) => h.quote.startsWith('I measured')))
check('an unknown criterion is blanked and an odd kind becomes an issue', r.highlights[2].criterion === '' && r.highlights[2].kind === 'issue')
check('impact defaults to medium when missing', r.highlights.every((h) => ['high', 'medium', 'low'].includes(h.impact)))
check('broken JSON gives nothing, not a crash', cleanReview('{not json', draft, null) === null)

const parts = segments(draft, r.highlights)
check('the text is rebuilt exactly', parts.map((p) => p.text).join('') === draft)
check('every kept highlight is placed', parts.filter((p) => p.n !== undefined).length === 3)
const spaced = parts.find((p) => p.n === 1)
check('a highlight keeps the draft’s own spacing', spaced?.text.includes('measured   the'), spaced?.text)

const free = cleanReview(JSON.stringify({ criteria: [{ id: 'A', name: 'Knowledge', max: 99, score: 50, comment: '' }], highlights: [] }), draft, null)
check('criteria Syllabi supplies itself are capped too', free.criteria[0].max === 40 && free.criteria[0].score === 40)

console.log(failed ? `\n${failed} failed` : '\nall passed')
process.exit(failed ? 1 : 0)
