/**
 * The subject picker asks for a course, then its level. This checks the
 * split against the names the app actually stores, including the ones that
 * are nobody's idea of a pattern.
 */
import { splitLevel, coursesOf, defaultLevel } from '../lib/course-levels.js'

let failed = 0
const check = (name, ok) => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
}

check('a level is split off the end', splitLevel('Biology HL').base === 'Biology' && splitLevel('Biology HL').level === 'HL')
check('SL too', splitLevel('Physics SL').level === 'SL')
check('no level means no level', splitLevel('Theory of Knowledge').level === null)

// The awkward ones: a level word inside the name, and a name that ends in
// something that only looks like one.
check('"Language A: Literature HL" keeps its colon', splitLevel('Language A: Literature HL').base === 'Language A: Literature')
check('"Global Politics SL" splits', splitLevel('Global Politics SL').base === 'Global Politics')
check('a bare name is left alone', splitLevel('Extended Essay').base === 'Extended Essay')

const ib = [
  'Biology SL',
  'Biology HL',
  'Chemistry SL',
  'Chemistry HL',
  'Environmental Systems and Societies SL',
  'Computer Science SL',
  'Computer Science HL',
]
const courses = coursesOf(ib)
check('seven entries become four courses', courses.length === 4)
check('Biology offers both levels', Object.keys(coursesOf(ib).find((c) => c.base === 'Biology').levels).sort().join() === 'HL,SL')
check(
  'a course offered at one level keeps it as a level, not an only',
  coursesOf(ib).find((c) => c.base === 'Environmental Systems and Societies').levels.SL ===
    'Environmental Systems and Societies SL'
)
check('order is the order it was given in', courses[0].base === 'Biology' && courses[1].base === 'Chemistry')

const core = coursesOf(['Theory of Knowledge', 'Extended Essay', 'CAS'])
check('the core is three single choices', core.length === 3 && core.every((c) => c.only && !Object.keys(c.levels).length))

// "Not sure yet" must never file somebody under more than they take.
check('not sure picks SL where there is a choice', defaultLevel(courses.find((c) => c.base === 'Biology')) === 'Biology SL')
check(
  'not sure picks the only level when SL is not offered',
  defaultLevel(coursesOf(['Further Mathematics HL'])[0]) === 'Further Mathematics HL'
)
check('not sure on a levelless course picks the course', defaultLevel(core[0]) === 'Theory of Knowledge')

check('an empty list is an empty list', coursesOf([]).length === 0 && coursesOf(undefined).length === 0)

console.log(failed ? `\n${failed} failing` : '\nthe picker splits every name the app stores')
process.exit(failed ? 1 : 0)
