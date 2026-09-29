import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { site } from '../../app/data/site'
import { stats } from '../../app/data/stats'
import { COUNTUP_MODE } from '../../app/motion/countup-mode'

/*
 * End-to-end tests of the motion of v1.1 (design spec section 10, task LP-018), on the generated
 * page served by `npm run preview` (like landing.spec.ts). Each test name starts with the design
 * check it covers (DA14–DA22 in design spec section 7) and the decision behind it.
 *
 * Unlike landing.spec.ts, these tests run with motion on (no-preference) unless they say otherwise:
 * that is what they check. The motion comes from one inline script (app/motion/page-motion.js,
 * D-045) and app/assets/css/motion.css.
 *
 * Count-up has two modes behind one switch, data-countup-mode on <section id="stats"> (D-049):
 * 'load' (mode A) and 'scroll' (mode B). The build has the mode of COUNTUP_MODE; the other one is
 * tested on the same build by rewriting the switch in the HTML the browser receives, in the start
 * tag of <section id="stats"> only (the page's CSS has the same text in its selectors, L-065).
 *
 * Timing is read from the screen, frame by frame, and only after the first contentful paint
 * (G-036): reading styles before the first paint would start the CSS count early. The tests wait
 * for animations to finish with getAnimations() and `finished`; the few fixed waits check that
 * something does NOT start by itself, as the design checks prescribe.
 */

type CountUpMode = 'load' | 'scroll'
const MODES: CountUpMode[] = ['load', 'scroll']

const PHONE = { width: 375, height: 812 }
const TABLET = { width: 768, height: 1024 }
const DESKTOP = { width: 1440, height: 900 }
/** A phone held sideways: the numbers are below the first screen (design spec 10.5). */
const LANDSCAPE = { width: 812, height: 375 }
const VIEWPORTS = [PHONE, TABLET, DESKTOP]

/** Base path of the site, e.g. '/Landing-page/'. */
const basePath = new URL(site.url).pathname

/** Sections of the page, top to bottom, then the footer. */
const PAGE_PARTS = ['#hero', '#stats', '#courses', '#trainer-service', '#trainers', '#faq', '#contact', 'footer']

/** Limits of the design spec, section 10, and the decisions behind them. */
const SPEC = {
  /** D-034: the count-up lasts 1000ms on screen, give or take 5%, and never more than 1100ms. */
  countUpMs: 1000,
  countUpMinMs: 950,
  countUpMaxMs: 1050,
  /** Numbers 1 / 2 / 3 start 0 / 80 / 160ms apart (--stagger-step), give or take one frame at 60 Hz. */
  staggerMs: 80,
  frameMs: 17,
  /** D-030 rule 3: every other animation lasts 400ms or less; the last of a batch waits 300ms or less. */
  maxDurationMs: 400,
  maxDelayMs: 300,
  /** D-030 rule 2: only these move... */
  moving: ['transform', 'translate', 'scale', 'rotate', 'opacity'],
  /** ...plus the colour fades that v1.0 already had on hover. */
  v10Colours: ['color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  /** Where an element ends after its motion = where it is with reduced motion, give or take this. */
  positionTolerancePx: 0.5,
}

/** The final text of each number, as in app/data/stats.ts (e.g. '120+'). */
const FINAL_NUMBERS = stats.map(stat => `${stat.value}${stat.suffix ?? ''}`)

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))

// ---------------------------------------------------------------------------------------------
// What the page records about itself, frame by frame
// ---------------------------------------------------------------------------------------------

interface AnimationRecord {
  kind: string
  name: string | null
  properties: string[]
  duration: number
  delay: number
  easing: string
  target: string
  time: number
}

interface CountFrame {
  time: number
  /** The stats card is at least partly in the window. */
  onScreen: boolean
  cardTop: number
  cardBottom: number
  /** What each number shows (design spec 10.5): the running value, or the final text. */
  shown: string[]
  /** Lowest opacity of the final values. */
  finalOpacity: number
  /** data-countup-state of #stats. */
  state: string | null
  /** Size of each number's box, to see that it never changes. */
  boxes: string
}

interface MotionLog {
  fcp: number | null
  /** When the web font last finished loading (document.fonts 'loadingdone'). */
  fontsDoneAt: number | null
  frames: number
  maxAnimations: number
  animations: AnimationRecord[]
  counts: CountFrame[]
  shifts: { value: number, hadRecentInput: boolean, time: number }[]
  /** Frames in which an element waiting for reveal was at least partly in the window. */
  hiddenOnScreen: { time: number, count: number }[]
  /** Every value that data-reveal-state took, per element (in the order of [data-reveal]). */
  revealStates: Record<number, string[]>
}

declare global {
  interface Window {
    __motion: MotionLog
  }
}

/**
 * Runs in the page before any of its scripts (page.addInitScript), so it passes nothing from this
 * file. It starts sampling on the first frame after the first contentful paint, so it never forces
 * a style calculation before the page is painted.
 */
function recordMotion() {
  const log: MotionLog = { fcp: null, fontsDoneAt: null, frames: 0, maxAnimations: 0, animations: [], counts: [], shifts: [], hiddenOnScreen: [], revealStates: {} }
  window.__motion = log

  const describe = (element: Element | null, pseudo?: string | null) => {
    if (!element) return 'none'
    const id = element.id ? `#${element.id}` : ''
    const classes = element.classList.length ? `.${[...element.classList].slice(0, 2).join('.')}` : ''
    const section = element.closest('section[id]')
    return `${element.tagName.toLowerCase()}${id}${classes}${pseudo ?? ''}${section && section !== element ? ` in #${section.id}` : ''}`
  }
  const kebab = (name: string) => (name.startsWith('--') ? name : name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`))

  // Text reflows once when the web font replaces its fallback. Shifts after this moment cannot come from the font.
  document.fonts.addEventListener('loadingdone', () => {
    log.fontsDoneAt = Math.round(performance.now())
  })

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & { value: number, hadRecentInput: boolean })[]) {
      log.shifts.push({ value: entry.value, hadRecentInput: entry.hadRecentInput, time: Math.round(entry.startTime) })
    }
  }).observe({ type: 'layout-shift', buffered: true })

  // Attribute changes only: reading them forces no style calculation.
  new MutationObserver((records) => {
    const targets = [...document.querySelectorAll('[data-reveal]')]
    for (const record of records) {
      const element = record.target as Element
      const index = targets.indexOf(element)
      log.revealStates[index] = [...(log.revealStates[index] ?? []), element.getAttribute('data-reveal-state') ?? 'none']
    }
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-reveal-state'] })

  const seen = new WeakSet<Animation>()
  const sample = (time: number) => {
    log.frames++
    const animations = document.getAnimations()
    log.maxAnimations = Math.max(log.maxAnimations, animations.length)
    for (const animation of animations) {
      if (seen.has(animation)) continue
      seen.add(animation)
      const effect = animation.effect as KeyframeEffect
      const timing = effect.getTiming()
      const transitionProperty = (animation as CSSTransition).transitionProperty
      const properties = transitionProperty
        ? [transitionProperty]
        : [...new Set(effect.getKeyframes().flatMap(frame => Object.keys(frame).filter(key => !['offset', 'computedOffset', 'easing', 'composite'].includes(key)).map(kebab)))]
      log.animations.push({
        kind: animation.constructor.name,
        name: (animation as CSSAnimation).animationName ?? null,
        properties,
        duration: Number(timing.duration),
        delay: timing.delay ?? 0,
        easing: timing.easing ?? '',
        target: describe(effect.target, effect.pseudoElement),
        time: Math.round(time),
      })
    }

    const card = document.querySelector('#stats ul')
    if (card) {
      const box = card.getBoundingClientRect()
      const countUps = [...card.querySelectorAll('.countup')]
      const shown = countUps.map((countUp) => {
        const counting = Number.parseFloat(getComputedStyle(countUp).getPropertyValue('--countup-on')) > 0.5
        return counting
          ? getComputedStyle(countUp.querySelector('.countup-live')!).getPropertyValue('--countup-value').trim()
          : countUp.querySelector('.countup-final')!.textContent!
      })
      const boxes = [...card.querySelectorAll(':scope > li > p:first-child')].map((value) => {
        const size = value.getBoundingClientRect()
        return `${Math.round(size.width * 100) / 100}x${Math.round(size.height * 100) / 100}`
      })
      log.counts.push({
        time: Math.round(time),
        onScreen: box.bottom > 0 && box.top < window.innerHeight,
        cardTop: Math.round(box.top),
        cardBottom: Math.round(box.bottom),
        shown,
        finalOpacity: Math.min(...countUps.map(countUp => Number.parseFloat(getComputedStyle(countUp.querySelector('.countup-final')!).opacity))),
        state: document.querySelector('#stats')!.getAttribute('data-countup-state'),
        boxes: boxes.join(' '),
      })
    }

    const hidden = [...document.querySelectorAll('[data-reveal-state="hidden"]')].filter((element) => {
      const box = element.getBoundingClientRect()
      return box.top < window.innerHeight && box.bottom > 0
    }).length
    if (hidden) log.hiddenOnScreen.push({ time: Math.round(time), count: hidden })
    requestAnimationFrame(sample)
  }

  let started = false
  new PerformanceObserver((list) => {
    const paint = list.getEntriesByName('first-contentful-paint')[0]
    if (started || !paint) return
    started = true
    log.fcp = Math.round(paint.startTime)
    requestAnimationFrame(sample)
  }).observe({ type: 'paint', buffered: true })
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/**
 * The HTML with the count-up switch set to `mode`. Only the start tag of <section id="stats"> is
 * edited, and it must be found exactly once (L-065): never a replace in the whole file.
 */
function withCountUpMode(html: string, mode: CountUpMode) {
  const tags = html.match(/<section\b[^>]*\sid="stats"[^>]*>/g) ?? []
  expect(tags, 'start tags of <section id="stats">').toHaveLength(1)
  const tag = tags[0]!
  const switchInBuild = ` data-countup-mode="${COUNTUP_MODE}"`
  expect(tag, 'the switch on <section id="stats">').toContain(switchInBuild)
  return html.replace(tag, tag.replace(switchInBuild, ` data-countup-mode="${mode}"`))
}

/**
 * Opens the page with count-up `mode`, recording its motion, and waits for the first contentful
 * paint and the web font.
 */
async function openPage(page: Page, mode: CountUpMode = COUNTUP_MODE) {
  if (mode !== COUNTUP_MODE) {
    const html = withCountUpMode(await (await page.request.get('./')).text(), mode)
    await page.route(url => url.pathname === basePath, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }))
  }
  await page.addInitScript(recordMotion)
  await page.goto('./')
  await waitForFirstPaint(page)
  expect(await page.locator('#stats').getAttribute('data-countup-mode')).toBe(mode)
}

async function waitForFirstPaint(page: Page) {
  await page.waitForFunction(() => window.__motion?.fcp !== null)
  await page.evaluate(async () => {
    await document.fonts.ready
  })
}

function motionLog(page: Page) {
  return page.evaluate(() => window.__motion)
}

/** Waits for two frames, so that the recorder has seen the latest state. */
function nextFrames(page: Page) {
  return page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
}

/** Waits for every count-up animation of the page to end (none: returns at once). */
async function waitForCountUp(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter(animation => (animation as CSSAnimation).animationName === 'countup')
    .map(animation => animation.finished.catch(() => undefined))))
  await nextFrames(page)
}

/** Waits for every transition of the page to end (reveal, hover, header shadow). */
async function waitForTransitions(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter(animation => animation instanceof CSSTransition)
    .map(animation => animation.finished.catch(() => undefined))))
}

/** Elements that still wait for reveal although their top edge is above the 90% line of the window. */
function hiddenAboveRevealLine() {
  return [...document.querySelectorAll('[data-reveal-state="hidden"]')]
    .filter((element) => {
      const box = element.getBoundingClientRect()
      return box.top < window.innerHeight * 0.9 && box.bottom > 0
    })
    .map(element => element.className || element.tagName)
}

/**
 * Scrolls the whole page down as a visitor would, 0.6 of the window at a time (instantly, so that
 * nothing is measured half way through a smooth scroll). After each step, what came above the 90%
 * line of the window must be revealed (design spec 10.4, DA15) and its fade must end.
 */
async function scrollThroughPage(page: Page) {
  const step = Math.round(page.viewportSize()!.height * 0.6)
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let top = 0; top <= pageHeight + step; top += step) {
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), top)
    await expect.poll(() => page.evaluate(hiddenAboveRevealLine), { timeout: 1000, intervals: [50] }).toEqual([])
    await waitForTransitions(page)
  }
}

async function scrollToTop(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await nextFrames(page)
  await waitForTransitions(page)
}

/** Scrolls so that `part` of the stats card (0 to 1) shows at the bottom of the window. */
async function showPartOfStatsCard(page: Page, part: number) {
  await page.evaluate((fraction) => {
    const card = document.querySelector('#stats ul')!.getBoundingClientRect()
    window.scrollBy({ top: card.top - window.innerHeight + card.height * fraction, behavior: 'instant' })
  }, part)
}

async function centreStatsCard(page: Page) {
  await page.evaluate(() => document.querySelector('#stats ul')!.scrollIntoView({ block: 'center', behavior: 'instant' }))
}

/** What the count-up looks like now: its state, its animations and the running values. */
function readCountUp() {
  const card = document.querySelector('#stats ul')!
  const box = card.getBoundingClientRect()
  return {
    visibleRatio: Math.round(Math.max(0, Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0)) / box.height * 100) / 100,
    state: document.querySelector('#stats')!.getAttribute('data-countup-state'),
    countUps: document.getAnimations().filter(animation => (animation as CSSAnimation).animationName === 'countup').map(animation => animation.playState),
    values: [...card.querySelectorAll('.countup-live')].map(layer => getComputedStyle(layer).getPropertyValue('--countup-value').trim()),
  }
}

/** Reveal targets and final numbers that are not fully shown (opacity 1, no transform). */
function notFullyShown() {
  return [...document.querySelectorAll('[data-reveal], .countup-final')]
    .filter((element) => {
      const style = getComputedStyle(element)
      return style.opacity !== '1' || style.transform !== 'none'
    })
    .map(element => element.className || element.tagName)
}

function headerShadowOpacity() {
  return getComputedStyle(document.querySelector('.site-header')!, '::after').opacity
}

/** Position (in the document) and size of every reveal target. */
function revealBoxes() {
  return [...document.querySelectorAll('[data-reveal]')].map((element) => {
    const box = element.getBoundingClientRect()
    return [box.left + window.scrollX, box.top + window.scrollY, box.width, box.height]
  })
}

/**
 * Presses `key` until the focus lands in an element that waits for reveal (or waited: it may have
 * been revealed just before), and reads that element right after the press that got there.
 */
async function focusWaitingElement(page: Page, key: 'Tab' | 'Shift+Tab') {
  for (let press = 0; press < 80; press++) {
    await page.keyboard.press(key)
    const reached = await page.evaluate(() => {
      const box = document.activeElement?.closest('[data-reveal]')
      if (!box || !box.hasAttribute('data-reveal-state')) return null
      const style = getComputedStyle(box)
      return {
        focused: `${document.activeElement!.tagName} ${document.activeElement!.textContent!.trim().slice(0, 30)}`,
        state: box.getAttribute('data-reveal-state'),
        opacity: style.opacity,
        transform: style.transform,
        runningAnimations: box.getAnimations().length,
      }
    })
    if (reached) return reached
  }
  return null
}

/** The shown values must count up: never down, from the first paint to the final value. */
function expectNeverDown(frames: CountFrame[]) {
  const downs = frames.flatMap((frame, index) => {
    if (index === 0) return []
    return frame.shown.flatMap((value, number) => {
      const before = Number.parseInt(frames[index - 1]!.shown[number]!, 10)
      return Number.parseInt(value, 10) < before ? [`number ${number + 1}: ${before} then ${value} at ${frame.time}ms`] : []
    })
  })
  expect(downs, 'a number that went down on screen').toEqual([])
}

/**
 * DA16 (D-031, D-034): a count on screen starts at 0, never goes down, takes 1000ms ±5% from its
 * first change on screen to its final value, and numbers 2 and 3 start 80 and 160ms after number 1
 * (±1 frame). The boxes of the numbers keep one size.
 */
function expectCountUp(frames: CountFrame[]) {
  const onScreen = frames.filter(frame => frame.onScreen)
  expect(onScreen.length, 'frames with the numbers on screen').toBeGreaterThan(30)
  const first = onScreen[0]!
  const numbers = FINAL_NUMBERS.map((finalText, index) => {
    const firstChange = onScreen.find(frame => frame.shown[index] !== first.shown[index])
    const finalAt = onScreen.find(frame => frame.shown[index] === finalText && frame.time >= (firstChange?.time ?? 0))
    return { finalText, firstShown: first.shown[index], firstChangeAt: firstChange?.time, spanMs: firstChange && finalAt ? finalAt.time - firstChange.time : null }
  })
  expect(numbers.map(number => number.firstShown), 'first value seen').toEqual(FINAL_NUMBERS.map(() => '0'))
  for (const number of numbers) {
    expect(number.spanMs, `${number.finalText}: first change to final value`).not.toBeNull()
    expect(number.spanMs!, `${number.finalText}: count-up on screen, ms`).toBeGreaterThanOrEqual(SPEC.countUpMinMs)
    expect(number.spanMs!, `${number.finalText}: count-up on screen, ms`).toBeLessThanOrEqual(SPEC.countUpMaxMs)
  }
  expectNeverDown(onScreen)
  const starts = numbers.map(number => number.firstChangeAt! - numbers[0]!.firstChangeAt!)
  starts.forEach((start, index) => {
    expect(Math.abs(start - index * SPEC.staggerMs), `number ${index + 1} starts ${start}ms after number 1`).toBeLessThanOrEqual(SPEC.frameMs)
  })
  expect(new Set(frames.map(frame => frame.boxes)).size, 'sizes of the number boxes').toBe(1)
  expect(onScreen.at(-1)!.shown, 'values at the end').toEqual(FINAL_NUMBERS)
}

/** Mode B with the numbers on screen (D-049 rule 2): the final values in every frame, nothing else. */
function expectFinalInEveryFrame(log: MotionLog) {
  expect(log.counts.length, 'recorded frames').toBeGreaterThan(30)
  const notFinal = log.counts.filter(frame => frame.shown.some((value, index) => value !== FINAL_NUMBERS[index]) || frame.finalOpacity !== 1)
  expect(notFinal[0] ?? null, 'first frame without the final values').toBeNull()
  expect(log.animations.filter(animation => animation.name === 'countup'), 'countup animations').toEqual([])
  expect([...new Set(log.counts.map(frame => frame.state))], 'data-countup-state').toEqual([null])
}

/**
 * DA22 (D-030 rule 2 and 3, D-034): every animation but the count-up moves transform or opacity
 * only (or fades a v1.0 hover colour), lasts 400ms or less and waits 300ms or less.
 */
function expectAnimationsWithinRules(animations: AnimationRecord[]) {
  const problems = animations.filter(animation => animation.name !== 'countup').flatMap((animation) => {
    const what = `${animation.kind} ${animation.name ?? ''} [${animation.properties.join(', ')}] ${animation.duration}ms delay ${animation.delay}ms on ${animation.target}`
    const moves = animation.properties.length > 0 && animation.properties.every(property => SPEC.moving.includes(property))
    const fadesColour = animation.properties.length > 0 && animation.properties.every(property => SPEC.v10Colours.includes(property))
    return [
      ...(moves || fadesColour ? [] : [`${what}: property other than transform / opacity`]),
      ...(animation.duration <= SPEC.maxDurationMs ? [] : [`${what}: longer than ${SPEC.maxDurationMs}ms`]),
      ...(animation.delay <= SPEC.maxDelayMs ? [] : [`${what}: waits longer than ${SPEC.maxDelayMs}ms`]),
    ]
  })
  expect(problems).toEqual([])
  const countUps = animations.filter(animation => animation.name === 'countup')
  expect(countUps.filter(animation => animation.duration !== SPEC.countUpMs), 'countup animations not 1000ms long').toEqual([])
}

function sumOfShifts(log: MotionLog, from = 0) {
  return log.shifts.filter(shift => !shift.hadRecentInput && shift.time >= from).reduce((sum, shift) => sum + shift.value, 0)
}

/**
 * D-029, D-031, DA22: no layout shift once the web font has loaded (plus 100ms for its reflow), so
 * none from the count-up, the reveal or the header.
 *
 * A shift before that is the web font replacing its fallback, not motion: on a fast load the page
 * can be painted before the font arrives. It is recorded on the test (annotation) rather than
 * judged here; Lighthouse judges the CLS of the whole load (D-029). Found in LP-018: the same shift
 * happens on the LP-017 build when anything forces a layout at the end of the body.
 */
function expectNoShiftAfterFontLoad(log: MotionLog) {
  const fontsDone = (log.fontsDoneAt ?? 0) + 100
  expect(sumOfShifts(log, fontsDone), 'layout shift after the web font loaded').toBe(0)
  const atLoad = sumOfShifts(log) - sumOfShifts(log, fontsDone)
  if (atLoad > 0) test.info().annotations.push({ type: 'layout shift while the web font loaded', description: `${atLoad.toFixed(5)} (first paint ${log.fcp}ms, font loaded ${log.fontsDoneAt}ms)` })
}

// ---------------------------------------------------------------------------------------------
// Reduced motion: nothing moves (D-030 rule 8)
// ---------------------------------------------------------------------------------------------

for (const viewport of VIEWPORTS) {
  test.describe(`with reduced motion, at ${viewport.width}px`, () => {
    test.use({ viewport, reducedMotion: 'reduce' })

    for (const mode of MODES) {
      test(`DA14 (D-030 rule 8) nothing animates while loading, scrolling, hovering and opening a question; nothing waits (count-up ${mode})`, async ({ page }) => {
        await openPage(page, mode)
        const atLoad = await page.evaluate(() => ({
          waiting: document.querySelectorAll('[data-reveal-state]').length,
          countUpState: document.querySelector('#stats')!.getAttribute('data-countup-state'),
          liveLayers: [...document.querySelectorAll('.countup-live')].map(layer => getComputedStyle(layer).display),
          scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
        }))
        expect(atLoad).toEqual({ waiting: 0, countUpState: null, liveLayers: stats.map(() => 'none'), scrollBehavior: 'auto' })
        expect(await page.evaluate(notFullyShown)).toEqual([])

        // Section by section, down to the footer.
        for (const part of PAGE_PARTS) {
          await page.locator(part).evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }))
          await nextFrames(page)
          expect(await page.evaluate(() => document.getAnimations().length), `animations at ${part}`).toBe(0)
        }
        // The header shadow shows at once.
        expect(await page.evaluate(headerShadowOpacity)).toBe('1')

        // Hover: the card does not lift (its shadow shows at once), nor do the buttons.
        await page.hover('#courses article')
        expect(await page.locator('#courses article').first().evaluate(card => ({
          transform: getComputedStyle(card).transform,
          shadow: getComputedStyle(card, '::after').opacity,
        }))).toEqual({ transform: 'none', shadow: '1' })
        await page.hover('#contact .contact-link')
        expect(await page.locator('#contact .contact-link').first().evaluate(link => getComputedStyle(link).transform)).toBe('none')
        await page.hover('#hero .btn')
        expect(await page.locator('#hero .btn').first().evaluate(button => getComputedStyle(button).transform)).toBe('none')

        // FAQ: opening another question shows its answer at once, with its arrow already turned.
        const questions = page.locator('#faq details')
        await questions.nth(1).locator('summary').click()
        await expect(questions.nth(1)).toHaveAttribute('open')
        expect(await questions.nth(1).locator('summary > span[aria-hidden="true"]').evaluate(arrow => getComputedStyle(arrow).rotate)).toBe('180deg')
        await questions.nth(1).locator('summary').click()
        await expect(questions.nth(1)).not.toHaveAttribute('open')
        await nextFrames(page)

        const log = await motionLog(page)
        expect(log.frames, 'recorded frames').toBeGreaterThan(30)
        expect(log.animations, 'animations seen in any frame').toEqual([])
        expect(log.maxAnimations).toBe(0)
      })
    }
  })
}

// ---------------------------------------------------------------------------------------------
// Without JavaScript: the page of v1.0 (D-030 rule 9, D-046 rule 3)
// ---------------------------------------------------------------------------------------------

for (const viewport of VIEWPORTS) {
  test.describe(`without JavaScript, with motion on, at ${viewport.width}px`, () => {
    test.use({ viewport, javaScriptEnabled: false, reducedMotion: 'no-preference' })

    test('DA20 (a) (D-030 rule 9) nothing is hidden, the numbers are final, the header has no shadow, and FAQ questions open and close', async ({ page }) => {
      await page.goto('./')
      const state = await page.evaluate(() => ({
        waiting: document.querySelectorAll('[data-reveal-state]').length,
        liveLayers: [...document.querySelectorAll('.countup-live')].map(layer => getComputedStyle(layer).display),
        finals: [...document.querySelectorAll('.countup-final')].map(final => final.textContent),
        countUps: document.getAnimations().filter(animation => (animation as CSSAnimation).animationName === 'countup').length,
      }))
      expect(state).toEqual({ waiting: 0, liveLayers: stats.map(() => 'none'), finals: FINAL_NUMBERS, countUps: 0 })
      expect(await page.evaluate(notFullyShown)).toEqual([])
      await expect(page.locator('#stats li > p:first-child')).toHaveText(FINAL_NUMBERS)
      expect(await page.evaluate(headerShadowOpacity)).toBe('0')

      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
      expect(await page.evaluate(notFullyShown)).toEqual([])
      expect(await page.evaluate(headerShadowOpacity)).toBe('0')

      const first = page.locator('#faq details').first()
      await expect(first).toHaveAttribute('open')
      await first.locator('summary').click()
      await expect(first).not.toHaveAttribute('open')
      await first.locator('summary').click()
      await expect(first).toHaveAttribute('open')
    })
  })
}

// ---------------------------------------------------------------------------------------------
// With motion on (no-preference), in the build's count-up mode
// ---------------------------------------------------------------------------------------------

for (const viewport of [PHONE, DESKTOP]) {
  test.describe(`with motion on, at ${viewport.width}px`, () => {
    test.use({ viewport, reducedMotion: 'no-preference' })

    test(`DA15, DA16, DA17, DA18, DA19, DA22 (D-030, D-031, D-034) load, scroll, hover and FAQ: nothing on screen blinks, numbers never go down, only transform / opacity moves, no layout shift, same end positions as reduced motion (count-up ${COUNTUP_MODE})`, async ({ page, browser }) => {
      await openPage(page)
      await waitForCountUp(page)
      const atLoad = await page.evaluate(() => ({
        // Only elements fully below the window wait for reveal.
        waitingInWindow: [...document.querySelectorAll('[data-reveal-state="hidden"]')].filter(element => element.getBoundingClientRect().top < window.innerHeight).length,
        waiting: document.querySelectorAll('[data-reveal-state="hidden"]').length,
        headerShadow: getComputedStyle(document.querySelector('.site-header')!, '::after').opacity,
        newTabStops: document.querySelectorAll('[tabindex]:not([tabindex="-1"])').length,
        // A focus ring is final at once (design spec 4.0, G-015): no transition covers outline.
        fadingFocusRings: [...document.querySelectorAll('a, button, summary, input, select, textarea')].filter((element) => {
          const style = getComputedStyle(element)
          const durations = style.transitionDuration.split(',').map(duration => Number.parseFloat(duration))
          return style.transitionProperty.split(',').map(property => property.trim()).some((property, index) => /^(all|outline(-[a-z]+)?)$/.test(property) && durations[index % durations.length]! > 0)
        }).length,
      }))
      expect(atLoad.waitingInWindow).toBe(0)
      expect(atLoad.waiting, 'elements below the first screen wait for reveal').toBeGreaterThan(0)
      expect(atLoad).toMatchObject({ headerShadow: '0', newTabStops: 0, fadingFocusRings: 0 })

      const scrollStart = await page.evaluate(() => Math.round(performance.now()))
      await scrollThroughPage(page)
      expect(await page.evaluate(() => document.querySelectorAll('[data-reveal-state="hidden"]').length), 'still waiting at the end').toBe(0)
      expect(await page.evaluate(notFullyShown)).toEqual([])
      expect(await page.evaluate(headerShadowOpacity)).toBe('1')
      expect(await page.evaluate(() => document.querySelector('.site-header')!.getBoundingClientRect().height)).toBe(65)
      const endBoxes = await page.evaluate(revealBoxes)

      // Hover (design spec 10.6, option A of D-047): cards lift 4px and show their shadow, buttons lift 2px.
      const hover = async (selector: string) => {
        await page.locator(selector).first().scrollIntoViewIfNeeded()
        await page.evaluate(() => window.scrollBy({ top: -120, behavior: 'instant' }))
        await page.hover(selector)
        await page.locator(selector).first().evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))))
        const read = await page.locator(selector).first().evaluate(element => ({ transform: getComputedStyle(element).transform, shadow: getComputedStyle(element, '::after').opacity }))
        await page.mouse.move(1, 1)
        return read
      }
      expect(await hover('#courses article')).toEqual({ transform: 'matrix(1, 0, 0, 1, 0, -4)', shadow: '1' })
      expect(await hover('#trainers article')).toEqual({ transform: 'matrix(1, 0, 0, 1, 0, -4)', shadow: '1' })
      expect((await hover('#hero .btn')).transform).toBe('matrix(1, 0, 0, 1, 0, -2)')
      expect((await hover('#contact .contact-link')).transform).toBe('matrix(1, 0, 0, 1, 0, -2)')

      // FAQ (design spec 10.7): the question open at load never animated; opening another one fades
      // its answer in once and closes the first; closing is instant.
      const faqAnimations = async () => (await motionLog(page)).animations.filter(animation => animation.name === 'faq-answer-in').length
      expect(await faqAnimations()).toBe(0)
      const questions = page.locator('#faq details')
      await questions.nth(1).locator('summary').click()
      await expect(questions.nth(1)).toHaveAttribute('open')
      await expect(questions.first()).not.toHaveAttribute('open')
      await page.locator('#faq').evaluate(faq => Promise.all(faq.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))))
      await nextFrames(page)
      expect(await faqAnimations()).toBe(1)
      await questions.nth(1).locator('summary').click()
      await expect(questions.nth(1)).not.toHaveAttribute('open')
      await nextFrames(page)
      expect(await faqAnimations()).toBe(1)
      await scrollToTop(page)
      expect(await page.evaluate(headerShadowOpacity)).toBe('0')

      const log = await motionLog(page)
      expect(log.hiddenOnScreen.filter(frame => frame.time < scrollStart), 'frames with a waiting element on the first screen').toEqual([])
      // Revealed once: an element waits at most once, and never waits again.
      const revealStories = Object.values(log.revealStates).map(states => states.join(' > '))
      expect(revealStories.filter(story => !['hidden > shown', 'hidden > instant'].includes(story))).toEqual([])
      expectAnimationsWithinRules(log.animations)
      expect(log.animations.find(animation => animation.properties.includes('height')) ?? null).toBeNull()
      expectNoShiftAfterFontLoad(log)
      expect(sumOfShifts(log, scrollStart), 'layout shift while scrolling').toBe(0)
      expectNeverDown(log.counts)
      expect(log.counts.at(-1)!.shown).toEqual(FINAL_NUMBERS)
      if (COUNTUP_MODE === 'load') expectCountUp(log.counts.filter(frame => frame.time < scrollStart))
      else expectFinalInEveryFrame(log)

      // The same page with reduced motion: every element ends where it is there.
      const reduced = await browser.newContext({ viewport, reducedMotion: 'reduce' })
      const reducedPage = await reduced.newPage()
      await reducedPage.goto('./')
      await reducedPage.evaluate(async () => {
        await document.fonts.ready
      })
      const reducedBoxes = await reducedPage.evaluate(revealBoxes)
      await reduced.close()
      expect(reducedBoxes).toHaveLength(endBoxes.length)
      const largestGap = Math.max(...endBoxes.flatMap((box, index) => box.map((value, side) => Math.abs(value - reducedBoxes[index]![side]!))))
      expect(largestGap, 'largest difference from the reduced-motion render, px').toBeLessThanOrEqual(SPEC.positionTolerancePx)
    })

    test('DA21 (D-030 rule 4, WCAG 2.4.7) keyboard focus on an element that waits for reveal shows it at once, with Tab and with Shift+Tab', async ({ page }) => {
      await openPage(page)
      const forward = await focusWaitingElement(page, 'Tab')
      expect(forward, 'Tab reached an element that waits for reveal').not.toBeNull()
      expect(forward).toMatchObject({ state: 'instant', opacity: '1', transform: 'none', runningAnimations: 0 })

      await page.reload()
      await waitForFirstPaint(page)
      await page.locator('footer a').first().evaluate(link => (link as HTMLElement).focus({ preventScroll: true }))
      const backward = await focusWaitingElement(page, 'Shift+Tab')
      expect(backward, 'Shift+Tab reached an element that waits for reveal').not.toBeNull()
      expect(backward).toMatchObject({ state: 'instant', opacity: '1', transform: 'none', runningAnimations: 0 })
    })
  })
}

// ---------------------------------------------------------------------------------------------
// Count-up, both modes (D-049, DA16)
// ---------------------------------------------------------------------------------------------

test.describe('count-up mode A (load)', () => {
  test.use({ reducedMotion: 'no-preference' })

  test.describe('at 375x812', () => {
    test.use({ viewport: PHONE })

    test('DA16 (D-031, D-034) the numbers on the first screen count from 0 after the first paint: 1000ms ±5%, never down, 0 / 80 / 160ms apart', async ({ page }) => {
      await openPage(page, 'load')
      await waitForCountUp(page)
      const log = await motionLog(page)
      expectCountUp(log.counts)
      expectNoShiftAfterFontLoad(log)
      expect([...new Set(log.counts.map(frame => frame.state))]).toEqual([null])
    })
  })

  test.describe('at 812x375', () => {
    test.use({ viewport: LANDSCAPE })

    test('DA16 (D-031) below the screen the numbers wait at 0 (paused), still wait with a quarter of the card in view, and count once it is in the middle', async ({ page }) => {
      await openPage(page, 'load')
      expect(await page.evaluate(readCountUp)).toMatchObject({ state: null, countUps: ['paused', 'paused', 'paused'], values: ['0', '0', '0'] })
      // The fallback delay (1200ms) must not start a paused count.
      await page.waitForTimeout(1500)
      expect(await page.evaluate(readCountUp)).toMatchObject({ countUps: ['paused', 'paused', 'paused'], values: ['0', '0', '0'] })

      await showPartOfStatsCard(page, 0.25)
      await page.waitForTimeout(600)
      const quarter = await page.evaluate(readCountUp)
      expect(quarter.visibleRatio).toBeGreaterThan(0.2)
      expect(quarter.visibleRatio).toBeLessThan(0.3)
      expect(quarter).toMatchObject({ countUps: ['paused', 'paused', 'paused'], values: ['0', '0', '0'] })

      const countStart = await page.evaluate(() => Math.round(performance.now()))
      await centreStatsCard(page)
      await expect.poll(async () => (await page.evaluate(readCountUp)).countUps).toEqual(['running', 'running', 'running'])
      await waitForCountUp(page)
      const log = await motionLog(page)
      expectCountUp(log.counts)
      expect(sumOfShifts(log, countStart), 'layout shift while counting').toBe(0)
      expectNoShiftAfterFontLoad(log)
    })
  })
})

test.describe('count-up mode B (scroll)', () => {
  test.use({ reducedMotion: 'no-preference' })

  for (const viewport of VIEWPORTS) {
    test.describe(`at ${viewport.width}x${viewport.height}`, () => {
      test.use({ viewport })

      test('DA16 (D-049 rule 2) numbers on the first screen show their final value in every frame, and never count: load, scroll to the end, back to the top', async ({ page }) => {
        await openPage(page, 'scroll')
        // Long enough for a count that should not happen: mode A would have finished by now.
        await page.waitForTimeout(1800)
        await scrollThroughPage(page)
        await scrollToTop(page)
        await page.waitForTimeout(1300)
        const log = await motionLog(page)
        expectFinalInEveryFrame(log)
        expectNoShiftAfterFontLoad(log)
      })
    })
  }

  test.describe('at 812x375', () => {
    test.use({ viewport: LANDSCAPE })

    test('DA16 (D-049 rule 2) below the screen the numbers wait at 0 (pending), still wait with a quarter of the card in view, and count like mode A once it is in the middle, with no fallback delay', async ({ page }) => {
      await openPage(page, 'scroll')
      expect(await page.evaluate(readCountUp)).toMatchObject({ state: 'pending', countUps: [], values: ['0', '0', '0'] })
      await page.waitForTimeout(1500)
      expect(await page.evaluate(readCountUp)).toMatchObject({ state: 'pending', countUps: [], values: ['0', '0', '0'] })

      await showPartOfStatsCard(page, 0.25)
      await page.waitForTimeout(600)
      const quarter = await page.evaluate(readCountUp)
      expect(quarter.visibleRatio).toBeGreaterThan(0.2)
      expect(quarter.visibleRatio).toBeLessThan(0.3)
      expect(quarter).toMatchObject({ state: 'pending', countUps: [], values: ['0', '0', '0'] })

      const countStart = await page.evaluate(() => Math.round(performance.now()))
      await centreStatsCard(page)
      await expect.poll(async () => (await page.evaluate(readCountUp)).countUps).toEqual(['running', 'running', 'running'])
      await waitForCountUp(page)
      const log = await motionLog(page)
      expectCountUp(log.counts)
      expect(sumOfShifts(log, countStart), 'layout shift while counting').toBe(0)
      expect(log.animations.filter(animation => animation.name === 'countup').map(animation => animation.delay), 'countup delays').toEqual([0, SPEC.staggerMs, 2 * SPEC.staggerMs])
      expect(await page.evaluate(() => document.querySelector('#stats')!.getAttribute('data-countup-state'))).toBe('run')
      expectNoShiftAfterFontLoad(log)
    })
  })

  test.describe('at 375x812, reloaded half way down', () => {
    test.use({ viewport: PHONE })

    test('DA16 (D-049 rule 2) after a reload with the card above the screen, the numbers show their final value and never count', async ({ page }) => {
      await openPage(page, 'scroll')
      await page.locator('#faq').evaluate(faq => faq.scrollIntoView({ behavior: 'instant' }))
      await nextFrames(page)
      await page.reload()
      await waitForFirstPaint(page)
      // The browser puts the page back where it was.
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
      await page.waitForTimeout(1300)
      const restored = await motionLog(page)
      expect(restored.counts.at(-1)!.cardBottom, 'the stats card is above the window').toBeLessThanOrEqual(0)
      await scrollToTop(page)
      await page.waitForTimeout(1300)
      expectFinalInEveryFrame(await motionLog(page))
    })
  })
})

// ---------------------------------------------------------------------------------------------
// When JavaScript fails (D-046)
// ---------------------------------------------------------------------------------------------

test.describe('when the page\'s JavaScript cannot load (/_nuxt/*.js), at 375x812', () => {
  test.use({ viewport: PHONE, reducedMotion: 'no-preference' })

  for (const mode of MODES) {
    test(`DA20 (b) (D-046 rule 1) motion still runs: everything is revealed on the way down, the numbers end on their values, focus shows a waiting element, the header gets its shadow (count-up ${mode})`, async ({ page }) => {
      const blocked: string[] = []
      await page.route('**/_nuxt/*.js', (route) => {
        blocked.push(route.request().url())
        return route.abort()
      })
      await openPage(page, mode)
      expect(blocked.length, 'blocked scripts').toBeGreaterThan(0)
      expect(await page.evaluate(() => '__vue_app__' in document.querySelector('#__nuxt')!), 'Vue never started').toBe(false)
      expect(await page.evaluate(headerShadowOpacity)).toBe('0')
      expect(await page.evaluate(() => document.querySelectorAll('[data-reveal-state="hidden"]').length), 'waiting below the first screen').toBeGreaterThan(0)

      await waitForCountUp(page)
      await scrollThroughPage(page)
      expect(await page.evaluate(() => document.querySelectorAll('[data-reveal-state="hidden"]').length)).toBe(0)
      expect(await page.evaluate(notFullyShown)).toEqual([])
      expect(await page.evaluate(headerShadowOpacity)).toBe('1')
      await centreStatsCard(page)
      await page.waitForTimeout(1300)
      const log = await motionLog(page)
      expectNeverDown(log.counts.filter(frame => frame.onScreen))
      expect(log.counts.at(-1)!.shown).toEqual(FINAL_NUMBERS)
      if (mode === 'load') expectCountUp(log.counts.filter(frame => frame.time < log.counts.find(frame => !frame.onScreen)!.time))
      else expectFinalInEveryFrame(log)
      await expect(page.locator('#stats li > p:first-child')).toHaveText(FINAL_NUMBERS)

      await page.reload()
      await waitForFirstPaint(page)
      const focused = await focusWaitingElement(page, 'Tab')
      expect(focused, 'Tab reached an element that waits for reveal').not.toBeNull()
      expect(focused).toMatchObject({ state: 'instant', opacity: '1', transform: 'none', runningAnimations: 0 })
    })
  }
})

/** Makes every IntersectionObserver fail, like a motion script that breaks half way. */
const INJECTED_ERROR = 'LP-018 test: observe fails on purpose'

for (const mode of MODES) {
  for (const viewport of [PHONE, LANDSCAPE]) {
    test.describe(`when the motion script fails half way, count-up ${mode}, at ${viewport.width}x${viewport.height}`, () => {
      test.use({ viewport, reducedMotion: 'no-preference' })

      test('DA20 (c) (D-046 rule 2) nothing stays hidden or at 0: every element shows, the numbers are final in every frame, and the error is reported', async ({ page }) => {
        const errors: string[] = []
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text())
        })
        await page.addInitScript((text) => {
          IntersectionObserver.prototype.observe = () => {
            throw new Error(text)
          }
        }, INJECTED_ERROR)
        await openPage(page, mode)

        const read = () => page.evaluate(() => ({
          waiting: document.querySelectorAll('[data-reveal-state="hidden"]').length,
          state: document.querySelector('#stats')!.getAttribute('data-countup-state'),
          countUps: document.getAnimations().filter(animation => (animation as CSSAnimation).animationName === 'countup').length,
        }))
        // The design check's timing (DA20 (c)): 1.5 seconds after load, then the whole page.
        await page.waitForTimeout(1500)
        expect(await read()).toEqual({ waiting: 0, state: 'done', countUps: 0 })
        await scrollThroughPage(page)
        await centreStatsCard(page)
        await page.waitForTimeout(1300)
        expect(await read()).toEqual({ waiting: 0, state: 'done', countUps: 0 })
        expect(await page.evaluate(notFullyShown)).toEqual([])

        const log = await motionLog(page)
        const onScreen = log.counts.filter(frame => frame.onScreen)
        expect(onScreen.length, 'frames with the numbers on screen').toBeGreaterThan(0)
        expect(onScreen.find(frame => frame.shown.some((value, index) => value !== FINAL_NUMBERS[index])) ?? null, 'first frame on screen without the final values').toBeNull()
        expect(log.animations.filter(animation => animation.name === 'countup')).toEqual([])
        expect(errors.filter(error => error.includes(INJECTED_ERROR)).length, 'the error is reported in the console').toBeGreaterThanOrEqual(1)
      })
    })
  }
}

// ---------------------------------------------------------------------------------------------
// Accessibility and the generated HTML
// ---------------------------------------------------------------------------------------------

test.describe('the numbers for screen readers, at 375x812', () => {
  test.use({ viewport: PHONE, reducedMotion: 'no-preference' })

  test('DA16, AC5 (D-031) the accessibility tree has the final numbers only, while counting too, and no live region; no new tab stop', async ({ browser }) => {
    // The page as written in the HTML (no JavaScript) is the reference.
    const noScript = await browser.newContext({ viewport: PHONE, javaScriptEnabled: false })
    const staticPage = await noScript.newPage()
    await staticPage.goto('./')
    const reference = await staticPage.locator('#stats').ariaSnapshot()
    await noScript.close()
    for (const finalText of FINAL_NUMBERS) expect(reference).toContain(finalText)

    for (const mode of MODES) {
      const context = await browser.newContext({ viewport: PHONE, reducedMotion: 'no-preference' })
      const page = await context.newPage()
      await openPage(page, mode)
      if (mode === 'load') {
        // Mid-count: a frame already shows a running value.
        await expect.poll(async () => (await motionLog(page)).counts.some(frame => frame.shown.some((value, index) => value !== '0' && value !== FINAL_NUMBERS[index]))).toBe(true)
      }
      expect(await page.locator('#stats').ariaSnapshot(), `accessibility tree, count-up ${mode}`).toBe(reference)
      expect(await page.locator('#stats [aria-live], #stats [role="status"], #stats [role="alert"]').count()).toBe(0)
      expect(await page.locator('[tabindex]:not([tabindex="-1"])').count(), 'new tab stops').toBe(0)
      await context.close()
    }
  })
})

test.describe('the generated HTML', () => {
  const html = () => readFileSync(join(projectRoot, '.output/public/index.html'), 'utf8')
  /** The HTML without its script elements: the motion script names the attributes it reads and writes. */
  const markup = () => html().replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')

  test('DA16 (D-049 rule 3) has the count-up switch once, on <section id="stats">, with the value of COUNTUP_MODE, and the final numbers as text', () => {
    const page = markup()
    expect(page).toContain('id="stats"')
    const switches = [...page.matchAll(/<([a-z]+)\b[^>]*\sdata-countup-mode="([^"]*)"/g)].map(([, tag, value]) => ({ tag, value }))
    expect(switches).toEqual([{ tag: 'section', value: COUNTUP_MODE }])
    expect(page.match(/<section\b[^>]*\sid="stats"[^>]*>/g)![0]).toContain(`data-countup-mode="${COUNTUP_MODE}"`)
    // The page script writes the state; the HTML never has it.
    expect(page).not.toContain('data-countup-state')
    for (const finalText of FINAL_NUMBERS) expect(page).toContain(`<span class="countup-final">${finalText}</span>`)
  })

  test('AC6 (D-045) has the motion script once, inline and as it is in app/motion/page-motion.js, and no JavaScript file has it', () => {
    const page = html()
    const script = readFileSync(join(projectRoot, 'app/motion/page-motion.js'), 'utf8')
    const inlineScripts = [...page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(([, body]) => body)
    expect(inlineScripts.filter(body => body === script)).toHaveLength(1)
    expect(page.split('whenHalfOnScreen(').length - 1, 'the script\'s own function, defined and called in the HTML').toBeGreaterThan(0)

    const scriptsDir = join(projectRoot, '.output/public/_nuxt')
    const files = readdirSync(scriptsDir).filter(name => name.endsWith('.js'))
    expect(files.length).toBeGreaterThan(0)
    expect(files.filter(name => readFileSync(join(scriptsDir, name), 'utf8').includes('whenHalfOnScreen'))).toEqual([])
  })
})
