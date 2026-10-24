import { memo } from 'react'
import MathText from '@/components/MathText'

/**
 * What a question is set on: the extract a literature question is about, or
 * the situation a maths or science question starts from. Only a language or
 * literature course calls it an extract; elsewhere it is the context, and
 * its formulas are set like the question's.
 *
 * Set apart from the question and typeset like something to be read closely,
 * because that is what it is for. A poem keeps its line breaks: losing them
 * turns it into prose and destroys the thing half the questions ask about.
 *
 * Deliberately not styled as a quotation from somewhere. These extracts are
 * written for the question and are not from any published work, so quotation
 * marks or an attribution slot would imply a source that does not exist.
 */
function QuestionStimulus({ text, kind = 'prose', subject = '' }) {
  if (!text?.trim()) return null

  const isVerse = kind === 'poem'
  const literary = isVerse || kind === 'dialogue' || / A:| B( |$)|ab initio|Literature|Language/.test(subject)

  return (
    <figure
      className="mb-5 rounded-[var(--r-md)] border border-[var(--border-strong)] bg-[var(--surface-sunken)] px-5 py-4"
      aria-label={literary ? 'Extract to read' : 'Context'}
    >
      <p className="t-overline mb-2">
        {isVerse ? 'Read this poem' : kind === 'dialogue' ? 'Read this exchange' : literary ? 'Read this extract' : 'Context'}
      </p>
      <div
        className={`text-[var(--text)] ${
          isVerse
            ? 'whitespace-pre-wrap font-serif text-[15px] leading-[1.9]'
            : 'whitespace-pre-wrap text-[15px] leading-[1.75]'
        }`}
      >
        <MathText>{text.trim()}</MathText>
      </div>
    </figure>
  )
}

export default memo(QuestionStimulus)
