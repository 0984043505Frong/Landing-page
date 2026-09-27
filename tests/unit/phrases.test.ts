import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import PhraseText from '../../app/components/PhraseText'
import type { ThaiText } from '../../app/types/content'
import { joinPhrases, toPhraseParts } from '../../app/utils/phrases'

// The hero heading (design spec 5.2, P2): a space after 'ได้ผลจริง', none between the other phrases.
const heading = ['อบรมพนักงานให้', 'ได้ผลจริง ', 'ด้วยหลักสูตร', 'และวิทยากรที่ใช่']

function renderPhraseText(text: ThaiText) {
  return renderToString(createSSRApp({ render: () => h(PhraseText, { text }) }))
}

function textContent(html: string) {
  return html.replace(/<[^>]*>/g, '')
}

/** Counts the elements at the top level of an HTML fragment (<wbr> has no closing tag). */
function topLevelElementCount(html: string) {
  let depth = 0
  let count = 0
  for (const [, slash, name] of html.matchAll(/<(\/?)([a-z]+)[^>]*>/g)) {
    if (slash) depth--
    else {
      if (depth === 0) count++
      if (name !== 'wbr') depth++
    }
  }
  return count
}

describe('joinPhrases', () => {
  it('joins the phrases exactly as written, spaces included', () => {
    expect(joinPhrases(heading)).toBe('อบรมพนักงานให้ได้ผลจริง ด้วยหลักสูตรและวิทยากรที่ใช่')
  })

  it('adds nothing between phrases, so no separator can show up in plain text', () => {
    expect(joinPhrases(['A', 'B'])).toBe('AB')
  })

  it('returns a plain string unchanged', () => {
    expect(joinPhrases('ข้อความ ธรรมดา')).toBe('ข้อความ ธรรมดา')
  })

  it('returns an empty string for an empty list', () => {
    expect(joinPhrases([])).toBe('')
  })
})

describe('toPhraseParts', () => {
  it('moves the space at the end of a phrase out of the phrase', () => {
    expect(toPhraseParts(['ได้ผลจริง ', 'ด้วยหลักสูตร'])[0]).toEqual({ text: 'ได้ผลจริง', space: ' ', wbr: false })
  })

  it('marks a break with <wbr> between phrases that have no space between them', () => {
    expect(toPhraseParts(['อบรมพนักงานให้', 'ได้ผลจริง'])[0]).toEqual({ text: 'อบรมพนักงานให้', space: '', wbr: true })
  })

  it('adds no <wbr> after the last phrase', () => {
    expect(toPhraseParts(heading).at(-1)).toEqual({ text: 'และวิทยากรที่ใช่', space: '', wbr: false })
  })

  it('keeps spaces inside a phrase, where the line must not break', () => {
    expect(toPhraseParts(['ภายใน 1 วันทำการ'])[0]!.text).toBe('ภายใน 1 วันทำการ')
  })
})

describe('<PhraseText>', () => {
  it('puts each phrase in a nowrap span, the space after the span and <wbr> where there is no space', async () => {
    expect(await renderPhraseText(heading)).toBe(
      '<span>'
      + '<span class="whitespace-nowrap">อบรมพนักงานให้</span><wbr>'
      + '<span class="whitespace-nowrap">ได้ผลจริง</span> '
      + '<span class="whitespace-nowrap">ด้วยหลักสูตร</span><wbr>'
      + '<span class="whitespace-nowrap">และวิทยากรที่ใช่</span>'
      + '</span>',
    )
  })

  it('never puts a space inside a phrase span', async () => {
    const html = await renderPhraseText(['ใช้ Generative AI ', 'ช่วยทำงานในองค์กร'])
    expect(html).not.toMatch(/ <\/span>/)
    expect(html).toContain('<span class="whitespace-nowrap">ใช้ Generative AI</span> <span')
  })

  it('wraps all phrases in one element, so a flex or grid parent sees a single child', async () => {
    const html = await renderPhraseText(heading)
    expect(topLevelElementCount(html)).toBe(1)
    expect(html.startsWith('<span>')).toBe(true)
    expect(html.endsWith('</span>')).toBe(true)
  })

  it('shows the same text as joinPhrases', async () => {
    expect(textContent(await renderPhraseText(heading))).toBe(joinPhrases(heading))
  })

  it('shows a plain string as one run of text that the browser may break anywhere', async () => {
    expect(await renderPhraseText('ข้อความ ธรรมดา')).toBe('<span>ข้อความ ธรรมดา</span>')
  })
})
