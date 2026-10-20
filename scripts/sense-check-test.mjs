// node scripts/sense-check-test.mjs
import { senseCheck } from '../lib/sense-check.js'

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : `  (${detail})`}`)
}

const real = `The aim of this investigation is to find out how the length of a simple pendulum affects its period of oscillation. In class we learned that the period should depend only on the length and on the gravitational field strength, so I wanted to test this with a careful experiment of my own. I measured the length from the pivot to the centre of mass of the bob with a metre rule, and timed ten oscillations with a stopwatch before dividing by ten to reduce the effect of my reaction time. Each length was repeated three times and the mean was calculated. The results show a clear increase in period as the length increases, and a graph of the period squared against length gives a straight line that passes close to the origin. From the gradient I calculated a value for the acceleration due to gravity of 9.62 metres per second squared, which is a little below the accepted value. The largest source of uncertainty was the timing, although the angle of release may also have mattered because the simple theory only holds for small angles. In future I would use a light gate and record the release angle with a protractor so that both of these could be controlled more carefully and their effect on the final value of g could be estimated properly.`
const AR = 'يهدف هذا البحث إلى دراسة تأثير طول البندول على زمن الذبذبة في تجربة مخبرية دقيقة قمت بقياس الطول من نقطة التعليق حتى مركز الكتلة باستخدام مسطرة مترية ثم حسبت متوسط عشر ذبذبات لتقليل أثر زمن رد الفعل وكررت كل قياس ثلاث مرات وأظهرت النتائج زيادة واضحة في الزمن مع زيادة الطول ورسمت مربع الزمن مقابل الطول فحصلت على خط مستقيم يمر قرب نقطة الأصل ومن الميل حسبت قيمة تسارع الجاذبية وكانت أقل قليلا من القيمة المقبولة وأكبر مصدر للخطأ كان التوقيت اليدوي وزاوية الإفلات لأن النظرية البسيطة صحيحة فقط للزوايا الصغيرة وفي المستقبل سأستخدم بوابة ضوئية ومنقلة لقياس الزاوية بدقة أكبر وتقدير أثرها على النتيجة النهائية'.split(' ')
const arabic = Array.from({ length: 220 }, (_, i) => AR[(i * 7) % AR.length]).join(' ').replace(/(\S+ \S+ \S+ \S+ \S+ \S+ \S+ \S+ \S+ \S+ \S+)/g, '$1.')

check('a real draft passes', senseCheck(real) === null, senseCheck(real))
check('a real Arabic draft passes', senseCheck(arabic) === null, senseCheck(arabic))
check('too short is refused', !!senseCheck('This is my essay about pendulums.'))
check('keyboard mashing is refused', !!senseCheck(Array.from({ length: 200 }, (_, i) => `sdfkj${i % 7}qwrt xcvbnm`).join(' ')))
check('one word repeated is refused', !!senseCheck('pendulum '.repeat(300)))
check('one sentence pasted again and again is refused', !!senseCheck('The pendulum swings back and forth in the lab today. '.repeat(40)))
check('numbers and symbols are refused', !!senseCheck(Array.from({ length: 200 }, (_, i) => `${i} %%% ###`).join(' ')))
console.log(failed ? `\n${failed} failed` : '\nall passed')
process.exit(failed ? 1 : 0)
