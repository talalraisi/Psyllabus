/**
 * The shapes Syllabi's idea tools answer in, and the checks that make an
 * answer safe to lay out. Research question ideas come back as cards; study
 * advice as a short plan of steps.
 */

const STR = { type: 'string' }

export const APPROACHES = ['experiment', 'data', 'survey', 'sources', 'texts', 'fieldwork', 'modelling']

export const RESEARCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ideas', 'how_to_choose'],
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'approach', 'scope', 'needs', 'trap', 'feasibility', 'focus'],
        properties: {
          question: STR,
          approach: { type: 'string', enum: APPROACHES },
          scope: STR,
          needs: STR,
          trap: STR,
          feasibility: { type: 'string', enum: ['easy', 'doable', 'stretch'] },
          focus: { type: 'string', enum: ['narrow', 'balanced', 'broad'] },
        },
      },
    },
    how_to_choose: STR,
  },
}

export const STUDY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'steps', 'avoid'],
  properties: {
    headline: STR,
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'detail', 'minutes', 'subtopic'],
        properties: { title: STR, detail: STR, minutes: { type: 'integer' }, subtopic: STR },
      },
    },
    avoid: STR,
  },
}

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const parse = (json) => {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function cleanResearch(json) {
  const r = parse(json)
  if (!r || !Array.isArray(r.ideas)) return null
  const ideas = r.ideas
    .map((i) => ({
      question: str(i.question, 300),
      approach: APPROACHES.includes(i.approach) ? i.approach : 'sources',
      scope: str(i.scope, 400),
      needs: str(i.needs, 400),
      trap: str(i.trap, 400),
      feasibility: ['easy', 'doable', 'stretch'].includes(i.feasibility) ? i.feasibility : 'doable',
      focus: ['narrow', 'balanced', 'broad'].includes(i.focus) ? i.focus : 'balanced',
    }))
    .filter((i) => i.question)
    .slice(0, 8)
  return ideas.length ? { ideas, how_to_choose: str(r.how_to_choose, 500) } : null
}

export function cleanStudy(json) {
  const r = parse(json)
  if (!r || !Array.isArray(r.steps)) return null
  const steps = r.steps
    .map((s) => ({
      title: str(s.title, 120),
      detail: str(s.detail, 500),
      minutes: Math.max(5, Math.min(180, Math.round(Number(s.minutes) || 30))),
      subtopic: str(s.subtopic, 160),
    }))
    .filter((s) => s.title)
    .slice(0, 7)
  return steps.length ? { headline: str(r.headline, 300), steps, avoid: str(r.avoid, 400) } : null
}
