import { h } from 'vue'
import type { FunctionalComponent, VNodeArrayChildren } from 'vue'
import type { ThaiText } from '../types/content'
import { toPhraseParts } from '../utils/phrases'

/**
 * Shows Thai text so that a line can break between two phrases but never inside one
 * (D-009, design spec 5.1). For the phrases ['A', 'B ', 'C'] it renders:
 *
 *   <span><span class="whitespace-nowrap">A</span><wbr><span class="whitespace-nowrap">B</span> <span class="whitespace-nowrap">C</span></span>
 *
 * - Each phrase is a nowrap span without its trailing space. The space follows the span as a
 *   text node of its own: a space inside a nowrap span is not a place where the line may break.
 * - <wbr> marks where two phrases without a space between them may be split, so the break does
 *   not depend on the browser's Thai dictionary.
 * - One wrapper span holds all phrases, so they stay one run of text even when the parent is a
 *   flex or grid container (there, every child element becomes a separate box).
 * - A plain string is shown as it is, and the browser breaks it where it likes.
 *
 * Use it inside the element that gives the text its meaning: <h2><PhraseText :text="..." /></h2>.
 *
 * It is a render function rather than a template because Vue's template compiler removes or merges
 * the whitespace between tags, and these spaces must come out exactly as they are in the data.
 * This also lets the unit tests render it in plain Node.
 */
const PhraseText: FunctionalComponent<{ text: ThaiText }> = ({ text }) => {
  if (typeof text === 'string') return h('span', text)

  const children: VNodeArrayChildren = []
  for (const part of toPhraseParts(text)) {
    children.push(h('span', { class: 'whitespace-nowrap' }, part.text))
    if (part.space) children.push(part.space)
    if (part.wbr) children.push(h('wbr'))
  }
  return h('span', children)
}

PhraseText.props = {
  text: { type: [String, Array], required: true },
}

export default PhraseText
