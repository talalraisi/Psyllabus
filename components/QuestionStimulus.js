import { memo } from 'react'

/**
 * The extract a literature question is about.
 *
 * Set apart from the question and typeset like something to be read closely,
 * because that is what it is for. A poem keeps its line breaks: losing them
 * turns it into prose and destroys the thing half the questions ask about.
 *
 * Deliberately not styled as a quotation from somewhere. These extracts are
 * written for the question and are not from any published work, so quotation
 * marks or an attribution slot would imply a source that does not exist.
 */
function QuestionStimulus({ text, kind = 'prose' }) {
  if (!text?.trim()) return null

  const isVerse = kind === 'poem'

  return (
    <figure
      className="mb-5 rounded-[var(--r-md)] border border-[var(--border-strong)] bg-[var(--surface-sunken)] px-5 py-4"
      aria-label="Extract to read"
    >
      <p className="t-overline mb-2">
        {isVerse ? 'Read this poem' : kind === 'dialogue' ? 'Read this exchange' : 'Read this extract'}
      </p>
      <div
        className={`text-[var(--text)] ${
          isVerse
            ? 'whitespace-pre-wrap font-serif text-[15px] leading-[1.9]'
            : 'whitespace-pre-wrap text-[15px] leading-[1.75]'
        }`}
      >
        {text.trim()}
      </div>
    </figure>
  )
}

export default memo(QuestionStimulus)
