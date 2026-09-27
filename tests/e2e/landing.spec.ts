import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { contact } from '../../app/data/contact'
import { courses, coursesSection } from '../../app/data/courses'
import { faqs } from '../../app/data/faqs'
import { quoteForm } from '../../app/data/quoteForm'
import { site } from '../../app/data/site'
import { trainers } from '../../app/data/trainers'
import { joinPhrases } from '../../app/utils/phrases'

/*
 * End-to-end tests of the generated page, served by `npm run preview` under the same sub-path as
 * GitHub Pages, at the three widths of the design: 375, 768 and 1440px.
 *
 * Each test name starts with what it checks, as numbered in the project records:
 * - 1, 3–16: the test ideas of the stack spec (section 10), with the requirement (N…) or
 *   decision (D-…) behind them;
 * - DA7–DA9: design checks of the design spec (section 7).
 *
 * Numbers of cards and questions come from app/data/, never from fixed counts (D-017): adding
 * or removing a course, a trainer or a question needs no change here.
 *
 * Every test runs with reduced motion. In-page links then jump instead of gliding (the page
 * scrolls smoothly otherwise), so positions can be measured right after a click.
 */
test.use({ reducedMotion: 'reduce' })

const VIEWPORTS = [
  { width: 375, height: 812 }, // phone: menu button, floating LINE button
  { width: 768, height: 1024 }, // tablet: menu button, no floating button
  { width: 1440, height: 900 }, // desktop: the whole menu in the header
]

/** Base path of the site, e.g. '/Landing-page/'. */
const basePath = new URL(site.url).pathname

/** An in-page link stops its target this far from the top of the window (scroll-margin-top in main.css). */
const LINK_TARGET_TOP = 80

/** Sections of the page, in the order of the project brief. */
const SECTION_IDS = ['hero', 'stats', 'courses', 'trainer-service', 'trainers', 'faq', 'contact']

/** Class on <html> while the mobile menu is open (app/composables/useMobileMenu.ts). */
const MENU_OPEN = /\bmenu-open\b/

/** A request that passes the form's checks. The phone number is the site's placeholder, not a real line. */
const VALID_REQUEST = {
  name: 'สมชาย ใจดี',
  company: 'บริษัท ตัวอย่าง จำกัด',
  phone: '02-000-0000',
  course: courses[0]!.id,
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/**
 * Opens the page, then waits for the web font (text boxes get their final size) and for Vue to
 * take over the pre-rendered page (from then on the menu button and the form react).
 */
async function openPage(page: Page) {
  const response = await page.goto('./')
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt')
    return root !== null && '__vue_app__' in root
  })
  return response
}

function menuButton(page: Page) {
  return page.getByRole('button', { name: site.header.menuButtonLabel, exact: true })
}

function mainMenu(page: Page) {
  return page.getByRole('navigation', { name: site.header.navLabel })
}

/** The floating LINE button, found by its label whether it is shown or not. */
function floatingLineButton(page: Page) {
  return page.getByLabel(contact.line.floatingAriaLabel, { exact: true })
}

function contactLineButton(page: Page) {
  return page.getByRole('link', { name: contact.line.contactAriaLabel, exact: true })
}

function quoteFormElement(page: Page) {
  return page.getByRole('form', { name: joinPhrases(quoteForm.title) })
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error(`${locator} is not visible`)
  return box
}

/** `value` is `expected` px, give or take `tolerance` px. */
function expectWithin(value: number, expected: number, tolerance: number) {
  expect(value).toBeGreaterThanOrEqual(expected - tolerance)
  expect(value).toBeLessThanOrEqual(expected + tolerance)
}

/**
 * Bottom edge of the sticky header in the window. The header is 64px high plus a 1px border,
 * so this is its real edge, not a fixed number.
 */
async function headerBottom(page: Page) {
  const header = await boxOf(page.locator('#site-header'))
  return header.y + header.height
}

async function scrollState(page: Page) {
  return page.evaluate(() => ({
    scrollY: window.scrollY,
    maxScrollY: document.documentElement.scrollHeight - window.innerHeight,
  }))
}

/**
 * After a click on an in-page link, its target must stop 80px from the top of the window, below
 * the header. Near the end of the page the window cannot scroll that far: there the target only
 * has to be below the header.
 */
async function expectLinkTargetBelowHeader(page: Page, target: Locator) {
  const top = (await boxOf(target)).y
  expect(top).toBeGreaterThanOrEqual(await headerBottom(page))
  const { scrollY, maxScrollY } = await scrollState(page)
  if (scrollY < maxScrollY - 1) expectWithin(top, LINK_TARGET_TOP, 2)
}

/** The element is inside the window from top to bottom, and not under the sticky header. */
async function expectFullyInView(page: Page, locator: Locator) {
  const box = await boxOf(locator)
  expect(box.y).toBeGreaterThanOrEqual(await headerBottom(page))
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height)
}

/** Number of columns of a grid, from the distinct left edges of its items. */
async function countColumns(items: Locator) {
  const lefts = await items.evaluateAll(elements => elements.map(element => Math.round(element.getBoundingClientRect().left)))
  return new Set(lefts).size
}

async function fillQuoteForm(page: Page, values: { name: string, company: string, phone: string, course?: string }) {
  await page.getByLabel(quoteForm.fields.name.label).fill(values.name)
  await page.getByLabel(quoteForm.fields.company.label).fill(values.company)
  await page.getByLabel(quoteForm.fields.phone.label).fill(values.phone)
  if (values.course) await page.getByLabel(quoteForm.fields.course.label).selectOption(values.course)
}

async function submitQuoteForm(page: Page) {
  await page.getByRole('button', { name: quoteForm.submitLabel, exact: true }).click()
}

/** Converts '#0b2545' to 'rgb(11, 37, 69)', the way the browser reports colours. */
function hexToRgb(hex: string) {
  const digits = hex.length === 4 ? [...hex.slice(1)].map(digit => digit + digit) : hex.slice(1).match(/../g)!
  return `rgb(${digits.map(pair => Number.parseInt(pair, 16)).join(', ')})`
}

// ---------------------------------------------------------------------------------------------
// Checks that run inside the page (passed to page.evaluate, so they use nothing from this file)
// ---------------------------------------------------------------------------------------------

/**
 * Design spec, appendix 1 (DA9). Thai text is shown as nowrap phrase spans (<PhraseText>): no
 * element that holds phrases may have text outside them, or be wider than its box.
 */
function checkThaiPhrases() {
  const isPhrase = (node: Element) => node.tagName === 'SPAN' && getComputedStyle(node).whiteSpace === 'nowrap'
  const containers = new Set([...document.querySelectorAll('span')].filter(isPhrase).map(span => span.parentElement!))
  const problems: { text: string, issue: string }[] = []
  for (const element of containers) {
    if (!element.getClientRects().length) continue // hidden: a closed answer, the other state of the form
    const box = getComputedStyle(element).display === 'inline' ? element.closest('p, li, h1, h2, h3, summary, div, a, button') : element
    if (box && box.clientWidth <= 1) continue // visually hidden (sr-only)
    const text = element.textContent!.trim().slice(0, 40)
    if ([...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent!.trim() !== '')) {
      problems.push({ text, issue: 'text outside phrases' })
    }
    if (box && box.scrollWidth > box.clientWidth + 1) problems.push({ text, issue: 'overflows its box' })
  }
  return {
    horizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
    phraseContainers: containers.size,
    problems,
  }
}

/** Design spec, appendix 2 (DA8): text and controls under the floating LINE button. */
function elementsUnder(button: { x: number, y: number, width: number, height: number }) {
  const selector = 'main a, main button, main summary, main input, main select, main textarea, main h1, main h2, main h3, main p, main li, main label, footer a, footer p'
  return [...document.querySelectorAll(selector)]
    .filter((element) => {
      const r = element.getBoundingClientRect()
      return r.width > 0 && r.right > button.x && r.left < button.x + button.width && r.bottom > button.y && r.top < button.y + button.height
    })
    .map(element => `${element.tagName} ${element.textContent!.trim().slice(0, 30)}`)
}

// ---------------------------------------------------------------------------------------------
// The page at each width
// ---------------------------------------------------------------------------------------------

for (const viewport of VIEWPORTS) {
  const isPhone = viewport.width < 768
  const hasMenuButton = viewport.width < 1024

  test.describe(`at ${viewport.width}px`, () => {
    test.use({ viewport })

    test('1 (N15) loads under the base path with no failed request and no console error', async ({ page }) => {
      const failed: string[] = []
      const loaded: string[] = []
      const consoleProblems: string[] = []
      page.on('response', (response) => {
        if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`)
        else loaded.push(new URL(response.url()).pathname)
      })
      page.on('requestfailed', request => failed.push(`${request.failure()?.errorText} ${request.url()}`))
      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(`${message.type()}: ${message.text()}`)
      })
      page.on('pageerror', error => consoleProblems.push(`uncaught: ${error.message}`))

      const response = await openPage(page)
      expect(response?.status()).toBe(200)
      // A wrong base URL renders a "Redirecting..." page instead of the content.
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(joinPhrases(site.hero.heading))
      await page.waitForLoadState('networkidle')

      // The script and the self-hosted font come from under the base path.
      expect(loaded.some(path => path.startsWith(`${basePath}_nuxt/`) && path.endsWith('.js'))).toBe(true)
      expect(loaded.some(path => path.startsWith(`${basePath}_fonts/`))).toBe(true)
      expect(failed).toEqual([])
      // Hydration mismatches would show up here too.
      expect(consoleProblems).toEqual([])
    })

    test('3 the sections come in order, and each menu link brings its section below the header', async ({ page }) => {
      await openPage(page)
      const pageUrl = page.url()

      expect(await page.locator('#__nuxt > :is(header, main, footer)').evaluateAll(elements => elements.map(element => element.tagName)))
        .toEqual(['HEADER', 'MAIN', 'FOOTER'])
      expect(await page.locator('main > section').evaluateAll(sections => sections.map(section => section.id)))
        .toEqual(SECTION_IDS)

      for (const link of site.nav) {
        if (hasMenuButton) await menuButton(page).click()
        await mainMenu(page).getByRole('link', { name: link.label, exact: true }).click()

        // The URL stays shareable: /Landing-page/#faq, never /Landing-page/Landing-page/#faq.
        await expect(page).toHaveURL(pageUrl + link.href)
        const section = page.locator(link.href)
        await expectLinkTargetBelowHeader(page, section)
        await expect(section.getByRole('heading', { level: 2 })).toBeInViewport()
      }
    })

    if (hasMenuButton) {
      test('4 (D-010) the menu button opens and closes the panel, and keeps its name "เมนู"', async ({ page }) => {
        await openPage(page)
        const button = menuButton(page)
        const panel = page.locator('#site-nav')
        const html = page.locator('html')
        await expect(button).toHaveAttribute('aria-controls', 'site-nav')
        await expect(button).toHaveAttribute('aria-expanded', 'false')
        await expect(panel).toBeHidden()
        if (isPhone) await expect(floatingLineButton(page)).toBeVisible()

        await button.click()
        // Same name while open: aria-expanded alone tells the state.
        await expect(button).toHaveAccessibleName(site.header.menuButtonLabel)
        await expect(button).toHaveAttribute('aria-expanded', 'true')
        await expect(panel).toBeVisible()
        await expect(html).toHaveClass(MENU_OPEN)
        await expect(floatingLineButton(page)).toBeHidden()

        await button.click()
        await expect(button).toHaveAttribute('aria-expanded', 'false')
        await expect(panel).toBeHidden()
        await expect(html).not.toHaveClass(MENU_OPEN)
        if (isPhone) await expect(floatingLineButton(page)).toBeVisible()
      })

      test('4 (D-010) Escape, a menu link and the backdrop close the panel', async ({ page }) => {
        await openPage(page)
        const button = menuButton(page)

        // Escape puts the focus back on the menu button.
        await button.click()
        await page.keyboard.press('Escape')
        await expect(button).toHaveAttribute('aria-expanded', 'false')
        await expect(button).toBeFocused()

        const firstLink = site.nav[0]!
        await button.click()
        await mainMenu(page).getByRole('link', { name: firstLink.label, exact: true }).click()
        await expect(button).toHaveAttribute('aria-expanded', 'false')
        await expect(page.locator(firstLink.href)).toBeInViewport()

        // The backdrop covers the page under the panel, down to the bottom of the window.
        await button.click()
        await page.mouse.click(viewport.width / 2, viewport.height - 20)
        await expect(button).toHaveAttribute('aria-expanded', 'false')
        await expect(page.locator('html')).not.toHaveClass(MENU_OPEN)
      })

      test('4 (D-012) widening the window to 1024px closes the panel and shows the whole menu', async ({ page }) => {
        await openPage(page)
        await menuButton(page).click()

        await page.setViewportSize({ width: 1024, height: 768 })
        await expect(menuButton(page)).toBeHidden()
        await expect(page.locator('html')).not.toHaveClass(MENU_OPEN)
        await expect(mainMenu(page).getByRole('link', { name: site.nav[0]!.label, exact: true })).toBeVisible()

        await page.setViewportSize(viewport)
        await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'false')
        await expect(page.locator('#site-nav')).toBeHidden()
      })

      test('4 (D-018) Tab past the last item of the open panel closes it, and the focus goes on to the hero', async ({ page }) => {
        await openPage(page)
        const button = menuButton(page)
        await button.focus()
        await page.keyboard.press('Enter')
        await expect(button).toHaveAttribute('aria-expanded', 'true')

        // Through the menu links and the panel's quote button: the panel stays open.
        const panelItems = page.locator('#site-nav a')
        await expect(panelItems).toHaveCount(site.nav.length + 1)
        for (let index = 0; index < site.nav.length + 1; index++) {
          await page.keyboard.press('Tab')
          await expect(panelItems.nth(index)).toBeFocused()
          await expect(button).toHaveAttribute('aria-expanded', 'true')
        }

        // One more Tab leaves the header: the focus goes on as usual, and the panel closes.
        await page.keyboard.press('Tab')
        await expect(page.locator('#hero').getByRole('link', { name: site.hero.primaryCta.label, exact: true })).toBeFocused()
        await expect(button).toHaveAttribute('aria-expanded', 'false')
        await expect(page.locator('#site-nav')).toBeHidden()
        await expect(page.locator('html')).not.toHaveClass(MENU_OPEN)
        if (isPhone) await expect(floatingLineButton(page)).toBeVisible()

        // The page scrolls again.
        const { scrollY } = await scrollState(page)
        await page.mouse.move(viewport.width / 2, viewport.height / 2)
        await page.mouse.wheel(0, 400)
        await expect.poll(async () => (await scrollState(page)).scrollY).toBeGreaterThan(scrollY)
      })

      test('4 (D-018) the panel stays open while the focus stays in the header', async ({ page }) => {
        await openPage(page)
        const button = menuButton(page)
        await button.focus()
        await page.keyboard.press('Enter')

        // Shift+Tab from the menu button goes to the logo link, which is still in the header.
        await page.keyboard.press('Shift+Tab')
        await expect(page.locator('#site-header a[href="#hero"]')).toBeFocused()
        await expect(button).toHaveAttribute('aria-expanded', 'true')
        await expect(page.locator('#site-nav')).toBeVisible()

        // A tap on an empty part of the panel moves the focus to no element: the panel stays open too.
        await page.keyboard.press('Tab')
        await expect(button).toBeFocused()
        const panel = await boxOf(page.locator('#site-nav'))
        await page.mouse.click(panel.x + 4, panel.y + panel.height - 8)
        await expect(button).toHaveAttribute('aria-expanded', 'true')
        await expect(page.locator('#site-nav')).toBeVisible()
      })
    }
    else {
      test('4 (D-012) the whole menu sits in the header row, with no menu button', async ({ page }) => {
        await openPage(page)
        for (const size of [viewport, { width: 1024, height: 768 }]) {
          await page.setViewportSize(size)
          await expect(menuButton(page)).toBeHidden()
          const header = await boxOf(page.locator('#site-header'))
          const items = [
            ...site.nav.map(link => mainMenu(page).getByRole('link', { name: link.label, exact: true })),
            mainMenu(page).getByRole('link', { name: site.hero.primaryCta.label, exact: true }),
          ]
          for (const item of items) {
            const box = await boxOf(item)
            expect(box.y).toBeGreaterThanOrEqual(header.y)
            expect(box.y + box.height).toBeLessThanOrEqual(header.y + header.height)
          }
        }
      })
    }

    test('5 (N10) one card per course in app/data/courses.ts, each with its 3 topics', async ({ page }) => {
      await openPage(page)
      const cards = page.locator('#courses article')
      await expect(cards).toHaveCount(courses.length)
      for (const [index, course] of courses.entries()) {
        const card = cards.nth(index)
        await expect(card.getByRole('heading', { level: 3 })).toHaveText(joinPhrases(course.title))
        await expect(card.getByText(course.duration, { exact: true })).toBeVisible()
        await expect(card.locator(':scope > div li')).toHaveText(course.formats.map(format => coursesSection.formatLabels[format]))
        await expect(card.locator(':scope > ul > li')).toHaveText(course.topics)
      }

      // The quote form offers the same courses, between its placeholder and "not sure yet".
      const options = await page.locator('#f-course option').evaluateAll(elements => elements.map(option => (option as HTMLOptionElement).value))
      expect(options).toEqual(['', ...courses.map(course => course.id), 'not-sure'])

      // 1 column on phones, 2 from 768px, 3 from 1024px (design spec 4.6).
      const columns = viewport.width >= 1024 ? 3 : viewport.width >= 768 ? 2 : 1
      expect(await countColumns(cards)).toBe(Math.min(columns, courses.length))
    })

    test('6 (N12) one card per trainer in app/data/trainers.ts, with initials instead of a photo', async ({ page }) => {
      await openPage(page)
      const cards = page.locator('#trainers article')
      await expect(cards).toHaveCount(trainers.length)
      await expect(page.locator('#trainers img')).toHaveCount(0)
      for (const [index, trainer] of trainers.entries()) {
        const card = cards.nth(index)
        await expect(card.getByRole('heading', { level: 3 })).toHaveText(joinPhrases(trainer.name))
        await expect(card.locator(':scope > [aria-hidden="true"]')).toHaveText(trainer.initials)
        await expect(card.locator('li')).toHaveText(trainer.expertise)
      }

      // 1 column on phones, 2 from 768px (design spec 4.8).
      expect(await countColumns(cards)).toBe(Math.min(viewport.width >= 768 ? 2 : 1, trainers.length))
    })

    test('7 FAQ lists the questions of app/data/faqs.ts, the first one open, one open at a time', async ({ page }) => {
      await openPage(page)
      const items = page.locator('#faq details')
      await expect(items).toHaveCount(faqs.length)
      await expect(page.locator('#faq summary')).toHaveText(faqs.map(faq => joinPhrases(faq.question)))
      await expect(items.first()).toHaveAttribute('open')
      await expect(page.locator('#faq details[open]')).toHaveCount(1)

      const last = items.last()
      if (faqs.length > 1) {
        // Opening another question closes the open one.
        await last.locator('summary').click()
        await expect(last).toHaveAttribute('open')
        await expect(items.first()).not.toHaveAttribute('open')
      }
      await expect(last.locator('p')).toHaveText(joinPhrases(faqs.at(-1)!.answer))

      // A click on the open question closes it, and Enter opens it again.
      await last.locator('summary').click()
      await expect(last).not.toHaveAttribute('open')
      await last.locator('summary').press('Enter')
      await expect(last).toHaveAttribute('open')
    })

    test.describe('without JavaScript', () => {
      test.use({ javaScriptEnabled: false })

      test('7 FAQ questions still open and close', async ({ page }) => {
        await page.goto('./')
        const first = page.locator('#faq details').first()
        await expect(first).toHaveAttribute('open')
        await first.locator('summary').click()
        await expect(first).not.toHaveAttribute('open')
        await first.locator('summary').click()
        await expect(first).toHaveAttribute('open')
      })
    })

    test('8 (N13, D-003) an empty submit shows an error under each required field and focuses the first one', async ({ page }) => {
      await openPage(page)
      await submitQuoteForm(page)

      for (const field of ['name', 'company', 'phone', 'course'] as const) {
        const control = page.locator(`#f-${field}`)
        await expect(control).toHaveAttribute('aria-invalid', 'true')
        await expect(control).toHaveAttribute('aria-describedby', `f-${field}-error`)
        await expect(page.locator(`#f-${field}-error`)).toHaveText(joinPhrases(quoteForm.errors[field].required))
      }
      // The message is optional.
      await expect(page.locator('#f-message')).not.toHaveAttribute('aria-invalid')
      await expect(page.locator('#f-message-error')).toHaveCount(0)
      await expect(page.locator('#f-name')).toBeFocused()
    })

    test('8 (N13, D-003) a phone number in a wrong format gets its own error, which goes once it is fixed', async ({ page }) => {
      await openPage(page)
      await fillQuoteForm(page, { ...VALID_REQUEST, phone: '08123' })
      await submitQuoteForm(page)

      const phone = page.getByLabel(quoteForm.fields.phone.label)
      await expect(phone).toBeFocused()
      await expect(phone).toHaveAttribute('aria-invalid', 'true')
      await expect(page.locator('#f-phone-error')).toHaveText(joinPhrases(quoteForm.errors.phone.invalid))

      await phone.fill(VALID_REQUEST.phone)
      await expect(phone).not.toHaveAttribute('aria-invalid')
      await expect(page.locator('#f-phone-error')).toHaveCount(0)
    })

    test('8 (N13) a valid request shows the thank-you message and sends nothing', async ({ page }) => {
      await openPage(page)
      await page.waitForLoadState('networkidle')
      const requests: string[] = []
      page.on('request', request => requests.push(request.url()))

      await fillQuoteForm(page, VALID_REQUEST)
      await submitQuoteForm(page)

      const status = page.getByRole('status')
      await expect(status).toBeFocused()
      expect(await status.locator('p').evaluateAll(lines => lines.map(line => line.textContent)))
        .toEqual([joinPhrases(quoteForm.success.message), joinPhrases(quoteForm.success.note)])
      await expect(quoteFormElement(page)).toBeHidden()

      // Nothing leaves the browser yet (TODO(formspree) in app/utils/submitQuote.ts). The wait gives
      // a request, if the form made one, time to start.
      await page.waitForTimeout(500)
      expect(requests).toEqual([])

      // "Send another request" brings back an empty form, ready to type into.
      await page.getByRole('button', { name: quoteForm.success.resetLabel, exact: true }).click()
      await expect(quoteFormElement(page)).toBeVisible()
      await expect(page.getByLabel(quoteForm.fields.name.label)).toBeFocused()
      await expect(page.getByLabel(quoteForm.fields.name.label)).toHaveValue('')
    })

    test('9 (N5, N6) everything that can be clicked is at least 44px tall, and form fields use 16px text', async ({ page }) => {
      await openPage(page)
      const heights = (selector: string) => page.locator(selector).evaluateAll(elements => elements
        .filter(element => element.getClientRects().length > 0) // skips hidden ones
        .map(element => ({ element: `${element.tagName} ${element.textContent!.trim().slice(0, 30)}`, height: element.getBoundingClientRect().height })))

      const shown = await heights('a[href], button, summary, input, select, textarea')
      expect(shown.length).toBeGreaterThan(0)
      expect(shown.filter(({ height }) => height < 44)).toEqual([])

      if (hasMenuButton) {
        await menuButton(page).click()
        const panelItems = await heights('#site-nav a')
        expect(panelItems).toHaveLength(site.nav.length + 1)
        expect(panelItems.filter(({ height }) => height < 44)).toEqual([])
      }

      const fontSizes = await page.locator('input, select, textarea').evaluateAll(fields => fields.map(field => getComputedStyle(field).fontSize))
      expect(fontSizes.length).toBeGreaterThan(0)
      expect(new Set(fontSizes)).toEqual(new Set(['16px']))
    })

    if (isPhone) {
      test('10 (D-006) the floating LINE button sits in the bottom-right corner and leads to the contact section', async ({ page }) => {
        await openPage(page)
        const pageUrl = page.url()
        const button = floatingLineButton(page)
        await expect(button).toBeVisible()
        await expect(button).toHaveAttribute('href', contact.line.floatingHref)
        await expect(button).not.toHaveAttribute('target')

        // 56 × 56, 16px from the right and bottom edges (design spec 4.12).
        const box = await boxOf(button)
        expectWithin(box.width, 56, 0.5)
        expectWithin(box.height, 56, 0.5)
        expectWithin(viewport.width - (box.x + box.width), 16, 0.5)
        expectWithin(viewport.height - (box.y + box.height), 16, 0.5)
        // The footer leaves room for the button under its last line (design spec 4.12).
        await expect(page.locator('footer')).toHaveCSS('padding-bottom', '104px')

        await button.click()
        await expect(page).toHaveURL(pageUrl + contact.line.floatingHref)
        await expectLinkTargetBelowHeader(page, page.locator(contact.line.floatingHref))
      })

      test('DA8 the floating LINE button covers no text or control: first screen, submit button, end of the page', async ({ page }) => {
        await openPage(page)
        const submitButton = page.getByRole('button', { name: quoteForm.submitLabel, exact: true })

        // First screen.
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
        expect((await scrollState(page)).scrollY).toBe(0)
        expect(await page.evaluate(elementsUnder, await boxOf(floatingLineButton(page)))).toEqual([])

        // The worst case for the form: its submit button right at the bottom edge of the window.
        await submitButton.evaluate(element => element.scrollIntoView({ block: 'end', behavior: 'instant' }))
        const submit = await boxOf(submitButton)
        expectWithin(submit.y + submit.height, viewport.height, 1)
        expect(await page.evaluate(elementsUnder, await boxOf(floatingLineButton(page)))).toEqual([])

        // End of the page: the footer's last line.
        await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
        const { scrollY, maxScrollY } = await scrollState(page)
        expect(scrollY).toBe(maxScrollY)
        expect(await page.evaluate(elementsUnder, await boxOf(floatingLineButton(page)))).toEqual([])
      })
    }
    else {
      test('10 (D-006) the floating LINE button is hidden from 768px', async ({ page }) => {
        await openPage(page)
        await expect(floatingLineButton(page)).toHaveCount(1)
        await expect(floatingLineButton(page)).toHaveCSS('display', 'none')
        await expect(page.locator('footer')).toHaveCSS('padding-bottom', '40px')
      })
    }

    test('10 (D-006, D-019) the LINE button of the contact section brings the form card below the header', async ({ page }) => {
      await openPage(page)
      const pageUrl = page.url()

      // One element carries the anchor: the card around the form and the thank-you status.
      const card = page.locator('[id="quote-form"]')
      await expect(card).toHaveCount(1)
      await expect(card.locator('form')).toHaveCount(1)
      await expect(card.locator('[role="status"]')).toHaveCount(1)
      const form = quoteFormElement(page)
      await expect(form).not.toHaveAttribute('id')
      await expect(form).toHaveAttribute('novalidate')
      await expect(form).toHaveAttribute('aria-labelledby', 'form-title')

      const button = contactLineButton(page)
      await expect(button).toHaveAttribute('href', contact.line.contactHref)
      await expect(button).toHaveText(contact.line.label)
      await expect(button).not.toHaveAttribute('target')

      await button.click()
      await expect(page).toHaveURL(pageUrl + contact.line.contactHref)
      await expectLinkTargetBelowHeader(page, card)
      await expectFullyInView(page, page.locator('#form-title'))
    })

    test('10 (D-019) after a request is sent, the same LINE button brings the thank-you message into view', async ({ page }) => {
      await openPage(page)
      const button = contactLineButton(page)
      await button.click()
      await fillQuoteForm(page, VALID_REQUEST)
      await submitQuoteForm(page)
      const status = page.getByRole('status')
      await expect(status).toBeVisible()

      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      expect((await scrollState(page)).scrollY).toBe(0)
      await button.click()

      await expectLinkTargetBelowHeader(page, page.locator('[id="quote-form"]'))
      await expectFullyInView(page, status)
      await expectFullyInView(page, page.getByRole('button', { name: quoteForm.success.resetLabel, exact: true }))
    })

    test('11 (N16, D-006) phone, email and LINE links follow app/data/contact.ts, and no link leads to LINE', async ({ page }) => {
      await openPage(page)
      const hrefs = await page.locator('a[href]').evaluateAll(links => links.map(link => link.getAttribute('href')!))

      const phoneLinks = hrefs.filter(href => href.startsWith('tel:'))
      expect(phoneLinks.length).toBeGreaterThan(0)
      expect(new Set(phoneLinks)).toEqual(new Set([contact.phoneHref]))
      const emailLinks = hrefs.filter(href => href.startsWith('mailto:'))
      expect(emailLinks.length).toBeGreaterThan(0)
      expect(new Set(emailLinks)).toEqual(new Set([`mailto:${contact.email}`]))

      // This demo brand has no LINE account, so nothing on the page may lead to one (D-006).
      expect(hrefs).toContain(contact.line.floatingHref)
      expect(hrefs).toContain(contact.line.contactHref)
      expect(await page.content()).not.toContain('line.me')
    })

    test('12 (N11) the footer shows the disclaimer word for word', async ({ page }) => {
      await openPage(page)
      const footerLines = await page.locator('footer p').evaluateAll(lines => lines.map(line => line.textContent))
      expect(footerLines).toContain(joinPhrases(site.footer.note))
      await expect(page.locator('footer').getByText(joinPhrases(site.footer.note), { exact: true })).toBeVisible()
    })

    test('14 (N7) images are SVG or WebP, and lazy-loaded below the hero', async ({ page }) => {
      const imageRequests: string[] = []
      page.on('request', (request) => {
        if (request.resourceType() === 'image') imageRequests.push(new URL(request.url()).pathname)
      })
      await openPage(page)
      await page.waitForLoadState('networkidle')

      // The PNG icons of the page head (D-002) are for devices and link previews, not loaded by the page.
      for (const path of imageRequests) expect(path).toMatch(/\.(svg|webp)$/)
      const images = await page.locator('img').evaluateAll(elements => elements.map(element => ({
        src: new URL((element as HTMLImageElement).src).pathname,
        loading: (element as HTMLImageElement).loading,
        inHero: element.closest('#hero') !== null,
      })))
      for (const image of images) {
        expect(image.src).toMatch(/\.(svg|webp)$/)
        expect(image.loading).toBe(image.inHero ? 'eager' : 'lazy')
      }
    })

    test('15 (N9) the page takes its colours from the tokens in app/assets/css/theme.css', async ({ page }) => {
      await openPage(page)
      const tokens = themeColors()
      expect(Object.keys(tokens).length).toBeGreaterThan(0)

      // Every colour token of theme.css reaches the page as a CSS variable with the same value.
      const values = await page.evaluate((names) => {
        const probe = document.createElement('span')
        document.body.append(probe)
        const result = Object.fromEntries(names.map((name) => {
          probe.style.color = `var(--color-${name})`
          return [name, getComputedStyle(probe).color]
        }))
        probe.remove()
        return result
      }, Object.keys(tokens))
      expect(values).toEqual(Object.fromEntries(Object.entries(tokens).map(([name, hex]) => [name, hexToRgb(hex)])))

      // The main surfaces use them (design spec DA2).
      await expect(page.locator('#hero')).toHaveCSS('background-color', hexToRgb(tokens['brand-900']!))
      await expect(page.locator('#courses')).toHaveCSS('background-color', hexToRgb(tokens['surface-muted']!))
      const primaryButton = page.locator('#hero').getByRole('link', { name: site.hero.primaryCta.label, exact: true })
      await expect(primaryButton).toHaveCSS('background-color', hexToRgb(tokens['accent-500']!))
      await expect(primaryButton).toHaveCSS('color', hexToRgb(tokens['brand-900']!))
    })

    test('DA7 the hero buttons are 12px apart when stacked on phones, 16px apart side by side from 640px', async ({ page }) => {
      await openPage(page)
      const hero = page.locator('#hero')
      const primary = await boxOf(hero.getByRole('link', { name: site.hero.primaryCta.label, exact: true }))
      const secondary = await boxOf(hero.getByRole('link', { name: site.hero.secondaryCta.label, exact: true }))

      if (isPhone) {
        // Stacked, both as wide as the content (375 - 2 × 20px).
        expectWithin(secondary.y - (primary.y + primary.height), 12, 1)
        expectWithin(primary.width, 335, 1)
        expectWithin(secondary.width, 335, 1)
      }
      else {
        // Side by side on one row.
        expectWithin(secondary.y, primary.y, 1)
        expectWithin(secondary.x - (primary.x + primary.width), 16, 1)
      }
    })

    test('DA9 Thai text breaks only between phrases, with no horizontal scrolling (all answers open, form errors, thank-you)', async ({ page }) => {
      await openPage(page)
      const expectPhrasesFit = async (state: string) => {
        const result = await page.evaluate(checkThaiPhrases)
        // Some phrase lists must be on the page, or the check proves nothing.
        expect(result.phraseContainers, state).toBeGreaterThan(0)
        expect(result.problems, state).toEqual([])
        expect(result.horizontalScroll, state).toBe(false)
      }

      await page.evaluate(() => document.querySelectorAll('details').forEach((details) => {
        details.removeAttribute('name')
        details.open = true
      }))
      await expectPhrasesFit('all answers open')

      // The longest error (the phone format) and the course error.
      await fillQuoteForm(page, { ...VALID_REQUEST, phone: '08123', course: undefined })
      await submitQuoteForm(page)
      await expect(page.locator('#f-phone-error')).toBeVisible()
      await expectPhrasesFit('form errors')

      await page.getByLabel(quoteForm.fields.phone.label).fill(VALID_REQUEST.phone)
      await page.getByLabel(quoteForm.fields.course.label).selectOption(VALID_REQUEST.course)
      await submitQuoteForm(page)
      await expect(page.getByRole('status')).toBeVisible()
      await expectPhrasesFit('thank-you message')
    })

    test('headings go from one h1 down without skipping a level, and no image lacks a text alternative', async ({ page }) => {
      await openPage(page)
      const levels = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(headings => headings.map(heading => Number(heading.tagName[1])))
      expect(levels[0]).toBe(1)
      expect(levels.filter(level => level === 1)).toHaveLength(1)
      const skips = levels.flatMap((level, index) => (index > 0 && level > levels[index - 1]! + 1 ? [`h${levels[index - 1]} → h${level}`] : []))
      expect(skips).toEqual([])

      await expect(page.locator('img:not([alt])')).toHaveCount(0)
      // Icons are decoration next to text that says the same, so screen readers skip them.
      await expect(page.locator('svg:not([aria-hidden="true"])')).toHaveCount(0)
    })
  })
}

// ---------------------------------------------------------------------------------------------
// The page head (the same at every width)
// ---------------------------------------------------------------------------------------------

test.describe('page head', () => {
  test('13 (N8) has the title, description, Open Graph tags, canonical URL and language', async ({ page }) => {
    await page.goto('./')
    const meta = (attribute: 'name' | 'property', key: string) => page.locator(`meta[${attribute}="${key}"]`)
    const ogImageUrl = new URL(site.ogImage, site.url).href

    await expect(page).toHaveTitle(site.title)
    await expect(page.locator('html')).toHaveAttribute('lang', 'th')
    await expect(meta('name', 'description')).toHaveAttribute('content', site.description)
    await expect(meta('property', 'og:title')).toHaveAttribute('content', site.title)
    await expect(meta('property', 'og:description')).toHaveAttribute('content', site.description)
    await expect(meta('property', 'og:type')).toHaveAttribute('content', 'website')
    await expect(meta('property', 'og:url')).toHaveAttribute('content', site.url)
    await expect(meta('property', 'og:image')).toHaveAttribute('content', ogImageUrl)
    await expect(meta('property', 'og:image:alt')).toHaveAttribute('content', site.ogImageAlt)
    await expect(meta('name', 'twitter:card')).toHaveAttribute('content', 'summary_large_image')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', site.url)
  })

  test('13 (N8) every file that the head links to answers 200: icon, apple-touch-icon and og:image', async ({ page }) => {
    await page.goto('./')

    // The browser may not request these files on its own, so request each one directly.
    const icon = await page.locator('link[rel="icon"]').getAttribute('href')
    expect(icon).toBe(`${basePath}favicon.svg`)
    const iconResponse = await page.request.get(new URL(icon!, page.url()).href)
    expect(iconResponse.status()).toBe(200)
    expect(iconResponse.headers()['content-type']).toContain('image/svg+xml')

    const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
    expect(touchIcon).toBe(`${basePath}apple-touch-icon.png`)
    const touchIconResponse = await page.request.get(new URL(touchIcon!, page.url()).href)
    expect(touchIconResponse.status()).toBe(200)
    expect(pngSize(await touchIconResponse.body())).toEqual({ width: 180, height: 180 })

    // og:image is the production URL (link previews need an absolute one). Its path under the site
    // URL is requested from the preview server instead.
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
    expect(ogImage!.startsWith(site.url)).toBe(true)
    const ogImageResponse = await page.request.get(new URL(ogImage!.slice(site.url.length), page.url()).href)
    expect(ogImageResponse.status()).toBe(200)
    const width = Number(await page.locator('meta[property="og:image:width"]').getAttribute('content'))
    const height = Number(await page.locator('meta[property="og:image:height"]').getAttribute('content'))
    expect(pngSize(await ogImageResponse.body())).toEqual({ width, height })
  })
})

/** Width and height from the header of a PNG file. */
function pngSize(png: Buffer) {
  expect(png.subarray(1, 4).toString('latin1')).toBe('PNG')
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}

// ---------------------------------------------------------------------------------------------
// The source files (checks that need no browser)
// ---------------------------------------------------------------------------------------------

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))

function readProjectFile(path: string) {
  return readFileSync(join(projectRoot, path), 'utf8')
}

/** Paths of all files under the given folders of the project, with forward slashes. */
function projectFiles(...folders: string[]): string[] {
  const walk = (folder: string): string[] => readdirSync(folder).flatMap((name) => {
    const path = join(folder, name)
    return statSync(path).isDirectory() ? walk(path) : [relative(projectRoot, path).split(sep).join('/')]
  })
  return folders.flatMap(folder => walk(join(projectRoot, folder)))
}

/** Colour tokens of app/assets/css/theme.css, e.g. { 'brand-900': '#0b2545' }. */
function themeColors(): Record<string, string> {
  const css = readProjectFile('app/assets/css/theme.css')
  return Object.fromEntries([...css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{3,8});/gi)].map(([, name, hex]) => [name!, hex!]))
}

test.describe('source files', () => {
  test('8 (N13) submitQuote() marks where a form service would be connected: TODO(formspree)', () => {
    expect(readProjectFile('app/utils/submitQuote.ts')).toContain('TODO(formspree)')
  })

  test('11 (N16) the phone number and the email address are written only in app/data/contact.ts', () => {
    const values = [contact.phoneDisplay, contact.phoneHref.slice('tel:'.length), contact.email]
    // The search must find them where they belong, or it proves nothing.
    for (const value of values) expect(readProjectFile('app/data/contact.ts')).toContain(value)
    const filesWithValues = projectFiles('app', 'public', 'scripts')
      .filter(path => path !== 'app/data/contact.ts')
      .filter(path => values.some(value => readProjectFile(path).includes(value)))
    expect(filesWithValues).toEqual([])
  })

  test('15 (N9) colours are written only in app/assets/css/theme.css', () => {
    const hexColour = /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/i
    // The search must find the colours where they belong, or it proves nothing.
    expect(readProjectFile('app/assets/css/theme.css')).toMatch(hexColour)
    const filesWithColours = projectFiles('app')
      .filter(path => /\.(vue|ts|css)$/.test(path) && path !== 'app/assets/css/theme.css')
      .filter(path => hexColour.test(readProjectFile(path)))
    expect(filesWithColours).toEqual([])
  })

  test('16 (N2) package.json has no UI library, jQuery or slider', () => {
    const { dependencies = {}, devDependencies = {} } = JSON.parse(readProjectFile('package.json'))
    const packages = Object.keys({ ...dependencies, ...devDependencies })
    const heavy = /jquery|bootstrap|vuetify|primevue|element-plus|quasar|naive-ui|ant-design|^@nuxt\/ui|@mui|swiper|slick|glide|splide|flickity|owl\.carousel|keen-slider|embla|tiny-slider|carousel/i
    expect(packages.length).toBeGreaterThan(0)
    expect(packages.filter(name => heavy.test(name))).toEqual([])
  })
})
