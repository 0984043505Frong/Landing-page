import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { contact, contactSection } from '../../app/data/contact'
import { courses, coursesSection } from '../../app/data/courses'
import { faqs, faqSection } from '../../app/data/faqs'
import { quoteForm } from '../../app/data/quoteForm'
import { site } from '../../app/data/site'
import { stats, statsSection } from '../../app/data/stats'
import { steps, stepsSection } from '../../app/data/steps'
import { trainers, trainersSection } from '../../app/data/trainers'
import type { ThaiText } from '../../app/types/content'
import type { QuoteField } from '../../app/types/quote'
import { joinPhrases } from '../../app/utils/phrases'

/*
 * End-to-end tests of lazy hydration and what comes with it, on the generated page served by
 * `npm run preview` (like landing.spec.ts). Each test name starts with its letter in the project
 * records (task LP-017, a–h) and the decision behind it.
 *
 * What they hold (app/app.vue, nuxt.config.ts, app/components/QuoteForm.vue):
 * - Every section is in the generated HTML. The header hydrates with the page, the contact
 *   section (with the quote form) when it comes into view, and the other sections never (D-039).
 * - No chunk is prefetched: opening the page loads its entry script only (D-040).
 * - Before the quote form hydrates, it keeps what was typed and holds a submit, and a submit
 *   that nothing handles never puts the typed values in the URL (D-041).
 *
 * "Before hydration" is a state these tests control: the contact section's JavaScript is held back
 * with page.route() until the test lets it through, so the tests do not race the network. The
 * names of those files carry a content hash, so no file name is written here: once the page has
 * hydrated, every script it asks for belongs to a section that is hydrating.
 */

const PHONE = { width: 375, height: 812 }
const DESKTOP = { width: 1440, height: 900 }

/** Scrolling a step at a time, as a visitor would: this far, then a pause for the page to react. */
const SCROLL_STEP_PX = 200
const SCROLL_PAUSE_MS = 100

/** The only kinds of request the page may make (D-027): no fetch, XHR, JSON or other files. */
const ALLOWED_REQUEST_TYPES = ['document', 'script', 'stylesheet', 'font']

/** What a visitor types into the quote form: a request that passes its checks. */
const TYPED: Record<QuoteField, string> = {
  name: 'สมชาย ใจดี',
  company: 'บริษัท ตัวอย่าง จำกัด',
  // The site's own placeholder number, not a real line.
  phone: contact.phoneDisplay,
  course: courses[0]!.id,
  message: 'อบรม 20 คน ช่วงเดือนหน้า',
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** Opens the page and waits for Vue to take over the pre-rendered page (header and entry script). */
async function openPage(page: Page) {
  const response = await page.goto('./')
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt')
    return root !== null && '__vue_app__' in root
  })
  return response!
}

function quoteFormElement(page: Page) {
  return page.getByRole('form', { name: joinPhrases(quoteForm.title) })
}

function quoteField(page: Page, field: QuoteField) {
  return page.getByLabel(quoteForm.fields[field].label)
}

async function fillQuoteForm(page: Page) {
  for (const field of ['name', 'company', 'phone', 'message'] as const) await quoteField(page, field).fill(TYPED[field])
  await quoteField(page, 'course').selectOption(TYPED.course)
}

async function expectTypedValuesKept(page: Page) {
  for (const [field, value] of Object.entries(TYPED)) await expect(quoteField(page, field as QuoteField)).toHaveValue(value)
}

function submitButton(page: Page) {
  return page.getByRole('button', { name: quoteForm.submitLabel, exact: true })
}

/** Paths of the .js files the page asks for, in order, whatever the kind of request (a prefetch is 'other'). */
function watchScripts(page: Page) {
  const paths: string[] = []
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (pathname.endsWith('.js')) paths.push(pathname)
  })
  return paths
}

/**
 * Holds back every script the page asks for from now on, until `release()` is called. Call it
 * after openPage(): the entry script has loaded by then, so what is held is the JavaScript of a
 * section that starts to hydrate.
 */
async function holdScripts(page: Page) {
  let release!: () => void
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  const held: string[] = []
  await page.route('**/_nuxt/*.js', async (route) => {
    held.push(new URL(route.request().url()).pathname)
    await released
    await route.continue()
  })
  return { held, release }
}

/**
 * Brings the quote form into view with its JavaScript held back, and checks that the contact
 * section has asked for that JavaScript and has not hydrated.
 */
async function showQuoteFormBeforeHydration(page: Page) {
  await openPage(page)
  const scripts = await holdScripts(page)
  await quoteFormElement(page).scrollIntoViewIfNeeded()
  await expect.poll(() => scripts.held.length, 'the contact section asks for its JavaScript').toBeGreaterThan(0)
  await expect(quoteFormElement(page)).not.toHaveAttribute('data-hydrated')
  return scripts
}

/** Scrolls down one step at once, then pauses; tells whether the page is at its end. */
async function scrollOneStep(page: Page) {
  const atEnd = await page.evaluate((step) => {
    window.scrollBy({ top: step, behavior: 'instant' })
    return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1
  }, SCROLL_STEP_PX)
  await page.waitForTimeout(SCROLL_PAUSE_MS)
  return atEnd
}

async function scrollToEnd(page: Page) {
  let atEnd = false
  while (!atEnd) atEnd = await scrollOneStep(page)
}

/** Top edge of the element in the window, in px (below the window when greater than its height). */
async function topInWindow(page: Page, selector: string) {
  return page.locator(selector).evaluate(element => element.getBoundingClientRect().top)
}

function normaliseSpaces(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * The text of each part of the page, from app/data/: what a visitor must see without JavaScript
 * (D-027). FAQ answers are left out: all but the first are closed, and the test opens them.
 */
function textOfEachPart(): Record<string, ThaiText[]> {
  const { hero, footer } = site
  return {
    '#hero': [hero.eyebrow, hero.heading, hero.subheading, hero.primaryCta.label, hero.secondaryCta.label, hero.note],
    '#stats': [statsSection.heading, ...stats.flatMap(stat => [`${stat.value}${stat.suffix ?? ''}`, stat.label])],
    '#courses': [
      coursesSection.heading,
      coursesSection.intro,
      ...courses.flatMap(course => [
        course.title,
        course.duration,
        ...course.formats.map(format => coursesSection.formatLabels[format]),
        ...course.topics,
      ]),
    ],
    '#trainer-service': [stepsSection.heading, stepsSection.intro, ...steps.flatMap(step => [step.title, step.description])],
    '#trainers': [
      trainersSection.heading,
      trainersSection.intro,
      ...trainers.flatMap(trainer => [trainer.initials, trainer.name, trainer.role, ...trainer.expertise]),
    ],
    '#faq': [faqSection.heading, ...faqs.map(faq => faq.question)],
    '#contact': [
      contactSection.heading,
      contactSection.intro,
      ...contactSection.highlights,
      contact.line.label,
      contactSection.phoneLabel,
      contact.phoneDisplay,
      contactSection.emailLabel,
      contact.email,
      quoteForm.title,
      quoteForm.requiredNote,
      ...Object.values(quoteForm.fields).map(field => field.label),
      quoteForm.optionalLabel,
      quoteForm.submitLabel,
    ],
    'footer': [
      footer.about,
      footer.navTitle,
      ...site.nav.map(link => link.label),
      footer.contactTitle,
      contact.phoneDisplay,
      contact.email,
      footer.copyright,
      footer.note,
    ],
  }
}

// Leave no request waiting in a route handler when a test ends before it lets the scripts through.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' })
})

// ---------------------------------------------------------------------------------------------
// Without JavaScript: the generated HTML on its own
// ---------------------------------------------------------------------------------------------

test.describe('without JavaScript, at 375px', () => {
  // Reduced motion turns off smooth scrolling (main.css). Without JavaScript, a click that has to
  // scroll a smoothly scrolling page first never finds its target standing still.
  test.use({ viewport: PHONE, javaScriptEnabled: false, reducedMotion: 'reduce' })

  test('a (D-027) every section shows its text from app/data/', async ({ page }) => {
    await page.goto('./')
    for (const [selector, texts] of Object.entries(textOfEachPart())) {
      // The part must be in the generated HTML (a section rendered only in the browser is not).
      const part = page.locator(selector)
      await expect(part, `${selector} in the generated HTML`).toHaveCount(1)
      // innerText holds only the text that is rendered: not what is hidden.
      const shown = normaliseSpaces(await part.innerText())
      const missing = texts.map(text => normaliseSpaces(joinPhrases(text))).filter(text => !shown.includes(text))
      expect(missing, `text missing from ${selector}`).toEqual([])
    }

    // Each FAQ answer shows once its question is opened, which a <details> does without JavaScript.
    const items = page.locator('#faq details')
    await expect(items).toHaveCount(faqs.length)
    for (const [index, faq] of faqs.entries()) {
      const item = items.nth(index)
      if (await item.getAttribute('open') === null) await item.locator('summary').click()
      await expect(item.getByText(joinPhrases(faq.answer), { exact: true })).toBeVisible()
    }
  })

  test('c (D-027) every image or frame below the hero is lazy-loaded and sized; none in the hero or above it is lazy', async ({ page }) => {
    await page.goto('./')
    // The attributes as written in the generated HTML: the browser reads them before any script runs.
    const media = await page.locator('img, iframe').evaluateAll(elements => elements.map((element) => {
      const hero = document.getElementById('hero')!
      const afterHero = (hero.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      return {
        tag: element.tagName.toLowerCase(),
        html: element.outerHTML.slice(0, 120),
        belowHero: afterHero && !hero.contains(element),
        loading: element.getAttribute('loading'),
        decoding: element.getAttribute('decoding'),
        hasSize: element.hasAttribute('width') && element.hasAttribute('height'),
      }
    }))

    const problems = media.flatMap((item) => {
      if (!item.belowHero) return item.loading === 'lazy' ? [`${item.html}: lazy in or above the hero`] : []
      return [
        ...(item.loading === 'lazy' ? [] : [`${item.html}: needs loading="lazy"`]),
        // `decoding` exists for images only.
        ...(item.tag !== 'img' || item.decoding === 'async' ? [] : [`${item.html}: needs decoding="async"`]),
        ...(item.hasSize ? [] : [`${item.html}: needs width and height`]),
      ]
    })
    expect(problems).toEqual([])
  })

  test('g (D-041) a submit sends nothing and leaves the typed values out of the URL', async ({ page }) => {
    await page.goto('./')
    const pageUrl = page.url()
    await fillQuoteForm(page)
    await submitButton(page).click()
    // A submit that went through would load a new page by now.
    await page.waitForLoadState()
    await page.waitForTimeout(500)

    expect(page.url()).not.toContain('?')
    expect(page.url()).toBe(pageUrl)
    await expectTypedValuesKept(page)
  })
})

// ---------------------------------------------------------------------------------------------
// What the page loads and asks for
// ---------------------------------------------------------------------------------------------

for (const viewport of [PHONE, DESKTOP]) {
  const hasMenuButton = viewport.width < 1024

  test.describe(`at ${viewport.width}px`, () => {
    test.use({ viewport })

    test('b (D-027, D-042) opening, scrolling to the end, the menu and typing in the form request only the document, scripts, styles and fonts', async ({ page }) => {
      const requests: { type: string, path: string }[] = []
      page.on('request', request => requests.push({ type: request.resourceType(), path: new URL(request.url()).pathname }))

      await openPage(page)
      await scrollToEnd(page)
      // The contact section came into view on the way down and hydrated.
      await expect(quoteFormElement(page)).toHaveAttribute('data-hydrated', '')
      if (hasMenuButton) {
        const menuButton = page.getByRole('button', { name: site.header.menuButtonLabel, exact: true })
        await menuButton.click()
        await expect(menuButton).toHaveAttribute('aria-expanded', 'true')
        await page.keyboard.press('Escape')
        await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
      }
      await fillQuoteForm(page)
      await page.waitForLoadState('networkidle')
      // Gives a request, if typing made one, time to start.
      await page.waitForTimeout(500)

      // The list holds the page's own requests, or the check proves nothing.
      expect(requests.map(request => request.type)).toEqual(expect.arrayContaining(['document', 'script']))
      expect(requests.filter(request => !ALLOWED_REQUEST_TYPES.includes(request.type))).toEqual([])
      expect(requests.filter(request => request.path.endsWith('.json'))).toEqual([])
    })

    test('d (D-039, D-040) opening the page loads its entry script only; the contact section\'s JavaScript comes once the section is in view', async ({ page }) => {
      const scripts = watchScripts(page)
      const response = await page.goto('./')
      const html = await response!.text()

      // No chunk is prefetched (the build:manifest hook in nuxt.config.ts). The entry script is
      // preloaded, which shows that the check reads the real hints of the page.
      expect(html).not.toContain('rel="prefetch"')
      expect(html).toContain('rel="modulepreload"')
      const entry = await page.locator('script[type="module"][src]').evaluateAll(elements => elements.map(element => new URL((element as HTMLScriptElement).src).pathname))
      expect(entry).toHaveLength(1)
      await page.waitForLoadState('networkidle')
      expect(scripts).toEqual(entry)

      // Scroll down through the sections above the contact section: they never hydrate.
      while (await topInWindow(page, '#contact') - SCROLL_STEP_PX > viewport.height) await scrollOneStep(page)
      expect(await topInWindow(page, '#contact')).toBeGreaterThan(viewport.height)
      await page.waitForTimeout(500)
      expect(scripts).toEqual(entry)
      await expect(quoteFormElement(page)).not.toHaveAttribute('data-hydrated')

      // Now into view: its JavaScript loads, and the form hydrates.
      await quoteFormElement(page).scrollIntoViewIfNeeded()
      await expect(quoteFormElement(page)).toHaveAttribute('data-hydrated', '')
      const sectionScripts = scripts.slice(entry.length)
      expect(sectionScripts.length).toBeGreaterThan(0)
      expect(sectionScripts).not.toContain(entry[0])
    })

    test('h (G-008) once the contact section has hydrated, menu links, Back and Forward keep the URL at the base path', async ({ page }) => {
      await openPage(page)
      const pageUrl = page.url()
      await quoteFormElement(page).scrollIntoViewIfNeeded()
      await expect(quoteFormElement(page)).toHaveAttribute('data-hydrated', '')

      const menuButton = page.getByRole('button', { name: site.header.menuButtonLabel, exact: true })
      const menu = page.getByRole('navigation', { name: site.header.navLabel })
      // Each URL must be /Landing-page/#<section>, never /Landing-page/Landing-page/#<section>
      // (app/plugins/router-base-fix.client.ts).
      const history = [pageUrl]
      for (const link of site.nav) {
        if (hasMenuButton) await menuButton.click()
        await menu.getByRole('link', { name: link.label, exact: true }).click()
        history.push(pageUrl + link.href)
        await expect(page).toHaveURL(history.at(-1)!)
      }

      // Back twice, then Forward once, through the history those clicks made.
      await page.goBack()
      await expect(page).toHaveURL(history.at(-2)!)
      await page.goBack()
      await expect(page).toHaveURL(history.at(-3)!)
      await page.goForward()
      await expect(page).toHaveURL(history.at(-2)!)
    })
  })
}

// ---------------------------------------------------------------------------------------------
// The quote form before it hydrates
// ---------------------------------------------------------------------------------------------

test.describe('the quote form before it hydrates, at 375px', () => {
  test.use({ viewport: PHONE })

  test('e (D-041) what is typed before it hydrates stays in all five fields', async ({ page }) => {
    const scripts = await showQuoteFormBeforeHydration(page)
    await fillQuoteForm(page)

    scripts.release()
    await expect(quoteFormElement(page)).toHaveAttribute('data-hydrated', '')
    await expectTypedValuesKept(page)

    // The form took the values over too: they pass its checks and it sends the request.
    await submitButton(page).click()
    await expect(page.getByRole('status')).toBeFocused()
  })

  test('f (D-041) a submit before it hydrates keeps the page and the values, and is sent once it hydrates', async ({ page }) => {
    const scripts = await showQuoteFormBeforeHydration(page)
    const pageUrl = page.url()
    await fillQuoteForm(page)
    // A reload would clear this mark.
    await page.evaluate(() => Object.assign(window, { markedBeforeSubmit: true }))

    await submitButton(page).click()
    await expect(quoteFormElement(page)).toHaveAttribute('data-submit-pending', '')
    await page.waitForTimeout(500)
    expect(page.url()).toBe(pageUrl)
    expect(await page.evaluate(() => 'markedBeforeSubmit' in window), 'the page did not reload').toBe(true)
    await expectTypedValuesKept(page)

    scripts.release()
    const thankYou = page.getByRole('status')
    await expect(thankYou).toBeFocused()
    await expect(thankYou).toBeVisible()
    await expect(quoteFormElement(page)).toBeHidden()
    expect(page.url()).toBe(pageUrl)
  })
})
