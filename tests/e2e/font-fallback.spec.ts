import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

/*
 * The Thai text while Noto Sans Thai is still downloading (LP-026).
 *
 * theme.css gives the Thai letters a fallback face, "Thai Fallback: Tahoma": the system font Tahoma
 * scaled to the width of Noto Sans Thai. Without it the browser draws Thai in a system font at that
 * font's own size, the hero heading wraps differently, and the page jumps when the web font arrives
 * (layout shift 0.27 at 1440x900 in v1.0.0).
 *
 * - The first test reads the built CSS and runs everywhere, CI included.
 * - The others hold the web fonts, read how the hero text wraps, let the fonts in and read it
 *   again. The face was measured against Tahoma, a Windows font, so they run on Windows only: on
 *   any other platform (the Linux CI runner) they are skipped with the reason, because the page
 *   then falls back to another Thai font the face was not measured for (decision D-060). On
 *   Windows they first check that Tahoma is installed and fail if it is not, rather than skip.
 */

const FALLBACK = 'Thai Fallback: Tahoma'
/** The first Thai letter: enough to make the browser load a face whose unicode-range is Thai. */
const THAI_LETTER = 'ก'

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
  { width: 812, height: 375 }, // phone on its side
]

test('LP-026 the Thai fallback face is in the built CSS, for Thai letters only, after Noto Sans Thai', async ({ page }) => {
  await page.goto('./')
  const found = await page.evaluate((family) => {
    const faces = [...document.styleSheets]
      .flatMap(sheet => [...sheet.cssRules])
      .filter((rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule)
      .filter(rule => rule.style.getPropertyValue('font-family').replace(/["']/g, '') === family)
    return {
      faces: faces.map(face => ({
        weight: face.style.getPropertyValue('font-weight'),
        src: face.style.getPropertyValue('src'),
        sizeAdjust: face.style.getPropertyValue('size-adjust'),
        unicodeRange: face.style.getPropertyValue('unicode-range'),
      })),
      stack: getComputedStyle(document.body).fontFamily.split(',').map(name => name.trim().replace(/["']/g, '')),
    }
  }, FALLBACK)

  expect(found.faces.map(face => face.weight).sort(), `@font-face rules of "${FALLBACK}"`).toEqual(['400', '700'])
  for (const face of found.faces) {
    expect(face.src, `src of the ${face.weight} face`).toMatch(/^local\(/)
    // Tahoma is wider than Noto Sans Thai: the face must scale it down.
    expect(Number.parseFloat(face.sizeAdjust), `size-adjust of the ${face.weight} face`).toBeLessThan(100)
    expect(face.unicodeRange.toUpperCase(), `unicode-range of the ${face.weight} face`).toBe('U+E01-E5B, U+200C-200D, U+25CC')
  }
  expect(found.stack[0], 'first font of the page').toBe('Noto Sans Thai')
  expect(found.stack, 'font stack of the page').toContain(FALLBACK)
})

/**
 * How the hero text wraps - for the eyebrow, heading, subheading and note, which phrases (by index)
 * share each line - and where the next section starts.
 */
async function heroLayout(page: Page) {
  return page.evaluate(() => {
    const linesOf = (block: Element | null) => {
      const lines: { top: number, phrases: number[] }[] = []
      block?.querySelectorAll('span.whitespace-nowrap').forEach((phrase, index) => {
        const top = Math.round(phrase.getBoundingClientRect().top)
        const line = lines.find(candidate => Math.abs(candidate.top - top) < 4)
        if (line) line.phrases.push(index)
        else lines.push({ top, phrases: [index] })
      })
      return lines.map(line => line.phrases)
    }
    const heading = document.querySelector('#hero-heading')!
    const stats = document.querySelector('#stats')!.getBoundingClientRect().top + window.scrollY
    return {
      eyebrow: linesOf(heading.previousElementSibling),
      heading: linesOf(heading),
      subheading: linesOf(heading.nextElementSibling),
      note: linesOf(document.querySelector('#hero-heading + p + div + p')),
      statsTop: Math.round(stats),
    }
  })
}

/**
 * Whether Tahoma is installed: Latin text set in "Tahoma, monospace" then measures differently from
 * monospace. (Not Thai text: monospace has no Thai letters, so the browser would draw those in its
 * own Thai fallback - Tahoma on Windows - in both cases.)
 */
async function hasTahoma(page: Page) {
  return page.evaluate(() => {
    const context = document.createElement('canvas').getContext('2d')!
    const width = (font: string) => {
      context.font = font
      return context.measureText('mmmmmmmmmmlli').width
    }
    return width('40px Tahoma, monospace') !== width('40px monospace')
  })
}

for (const viewport of VIEWPORTS) {
  test(`LP-026 at ${viewport.width}x${viewport.height} the hero text wraps the same in the Thai fallback as in Noto Sans Thai`, async ({ browser }) => {
    test.skip(process.platform !== 'win32', 'Tahoma is a Windows font: on other platforms the page falls back to a Thai font the face was not measured for (D-060)')
    const context = await browser.newContext({ viewport })
    try {
      const page = await context.newPage()
      const held: Route[] = []
      await page.route('**/_fonts/**', (route) => {
        held.push(route)
      })
      await page.goto('./', { waitUntil: 'domcontentloaded' })
      // On Windows a missing Tahoma is a broken test machine, not a reason to skip: fail loudly.
      expect(await hasTahoma(page), 'Tahoma must be installed on Windows to check the Thai fallback face').toBe(true)

      // The fallback face is a local font: wait until it is ready, while the web fonts are still held.
      await page.evaluate(({ family, letter }) => Promise.all(['400', '700'].map(weight => document.fonts.load(`${weight} 16px "${family}"`, letter))), { family: FALLBACK, letter: THAI_LETTER })
      expect(await page.evaluate(() => document.fonts.status), 'web fonts still held').toBe('loading')
      const withFallback = await heroLayout(page)

      // Let the held font requests through first: unroute() would pass them on by itself.
      for (const route of held) await route.continue()
      await page.unroute('**/_fonts/**')
      await page.evaluate(async () => {
        await document.fonts.ready
      })
      const withWebFont = await heroLayout(page)

      expect(withFallback, 'lines of the hero text and the top of #stats: fallback font vs Noto Sans Thai').toEqual(withWebFont)
    }
    finally {
      await context.close()
    }
  })
}
