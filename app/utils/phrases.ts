import type { ThaiText } from '../types/content'

/** One phrase of a phrase list, split the way <PhraseText> renders it (design spec 5.1, rules 1–3). */
export interface PhrasePart {
  /** The phrase without the space at its end. It goes inside a `white-space: nowrap` span. */
  text: string
  /** The space at the end of the phrase ('' if none). It goes after the span, as a text node of its own. */
  space: string
  /** True if a <wbr> goes after the span: the next phrase follows with no space in between. */
  wbr: boolean
}

/**
 * Joins Thai text into plain text, exactly as written in app/data/.
 * Use it where no markup is possible: <title>, meta tags, aria-label and <option>.
 */
export function joinPhrases(text: ThaiText): string {
  return typeof text === 'string' ? text : text.join('')
}

/**
 * Splits a list of phrases for rendering:
 * - the space at the end of a phrase is taken out of the phrase, so the line can break there;
 * - between two phrases with no space, a <wbr> marks where the line may break.
 *
 * toPhraseParts(['A', 'B ', 'C']) returns
 * [{ text: 'A', space: '', wbr: true }, { text: 'B', space: ' ', wbr: false }, { text: 'C', space: '', wbr: false }]
 */
export function toPhraseParts(phrases: readonly string[]): PhrasePart[] {
  return phrases.map((phrase, index) => {
    const text = phrase.replace(/ +$/, '')
    const space = phrase.slice(text.length)
    const isLast = index === phrases.length - 1
    return { text, space, wbr: space === '' && !isLast }
  })
}
