import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import type { APIResponse, Browser, Page, Route } from '@playwright/test'
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
 *
 * The motion script starts on the frame after the first contentful paint (D-050). The recorder
 * notes its first layout / style read and its first change to the page (DA23 (a)): tests use that
 * moment as "the script started", and check that nothing happened before the first paint. The one
 * change allowed earlier is the count-up arm of mode A (data-countup-armed, D-053): it is recorded
 * on its own and never counts as the start.
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
  /** Mode A: the CSS counts by itself this long after its first style calculation (--countup-fallback-delay). */
  fallbackDelayMs: 1200,
  /** Fallback (b) of the start: load + 1000ms (design spec 10.1 item 6). */
  fallbackBMs: 1000,
  /** D-057: an armed count starts by arm + 5000ms (watchdog); on this build, within 5500ms (D-057 note 1). */
  armWatchdogMs: 5000,
  armWatchdogMaxMs: 5500,
  /** DA24 (a) / (b): the main thread is kept busy until FCP + 1300ms (D-053 rule 4). */
  busyAfterFcpMs: 1300,
  /** DA24 (e): the HTML reaches the motion script only after this long. */
  lateParseMs: 2000,
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
  /** Computed clip-path of the final values (mode B hides them with it while counting). */
  finalClips: string[]
  /** data-countup-state of #stats. */
  state: string | null
  /** Size of each number's box, to see that it never changes. */
  boxes: string
}

/** A moment the motion script did something, and what it was. */
interface ScriptMark {
  time: number
  what: string
}

interface MotionLog {
  fcp: number | null
  /** The first contentful paint, not rounded: compared with the script's start (DA23 (a)). */
  fcpExact: number | null
  /** When the web fonts first finished loading (the first document.fonts 'loadingdone' - DA22). */
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
  /** The motion script's first layout / style read and first change to the page (DA23 (a)). */
  firstScriptRead: ScriptMark | null
  firstMotionChange: ScriptMark | null
  /** What the script hid, paused or set pending, and whether it was on screen then (D-050 rule 3). */
  atStart: (ScriptMark & { onScreen: boolean })[]
  /** Elements seen on screen that were hidden afterwards. */
  blinks: string[]
  /** Count-up timing (Web Animations) in the first frame in which number 1 counts (DA16, D-052). */
  countupTiming: { startTime: number, delay: number }[] | null
  /** Every write (set) and removal of the count-up arm, data-countup-armed (D-053, DA23 (a)). */
  arm: { time: number, set: boolean, target: string }[]
  /** When the motion script ran (its first observe() call; it arms just before it), or null. */
  pageScriptRanAt: number | null
}

declare global {
  interface Window {
    __motion: MotionLog
    __fontsFirstPaint?: () => void
    /** DA24 (a) / (b): the busy period after the first paint, and when the paint was handed to the page. */
    __busy?: { fcp: number, from: number, end: number, pageWaiting: boolean, handedAt: number | null } | null
    /** DA24 (e): when the test script that holds the parser up ran (the motion script runs right after). */
    __lateParseAt?: number
  }
}

/**
 * Runs in the page before any of its scripts (page.addInitScript), so it passes nothing from this
 * file. It starts sampling on the first frame after the first contentful paint, so it never forces
 * a style calculation before the page is painted.
 *
 * It also watches the motion script's start (D-050, DA23 (a)): every API that makes the browser
 * compute style or layout is wrapped, and the first call made from the page's own inline script
 * (its stack names the page URL) is noted; the script's attribute changes, the header sentinel and
 * count-up pauses are noted too. The recorder's own reads never count.
 */
function recordMotion() {
  const log: MotionLog = {
    fcp: null, fcpExact: null, fontsDoneAt: null, frames: 0, maxAnimations: 0, animations: [], counts: [], shifts: [],
    hiddenOnScreen: [], revealStates: {}, firstScriptRead: null, firstMotionChange: null, atStart: [], blinks: [], countupTiming: null,
    arm: [], pageScriptRanAt: null,
  }
  window.__motion = log

  const describe = (element: Element | null, pseudo?: string | null) => {
    if (!element) return 'none'
    const id = element.id ? `#${element.id}` : ''
    const classes = element.classList.length ? `.${[...element.classList].slice(0, 2).join('.')}` : ''
    const section = element.closest('section[id]')
    return `${element.tagName.toLowerCase()}${id}${classes}${pseudo ?? ''}${section && section !== element ? ` in #${section.id}` : ''}`
  }
  const kebab = (name: string) => (name.startsWith('--') ? name : name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`))

  // --- The motion script's first layout / style read. Only calls whose stack has a frame of the
  // page itself (the inline script: "…/Landing-page/:line:column") count.
  const pageUrl = `${location.origin}${location.pathname}:`
  let quiet = false
  const scriptRead = (api: string) => {
    if (quiet || log.firstScriptRead) return
    const stack = new Error('stack').stack ?? ''
    if (stack.split('\n').some(line => line.includes(pageUrl))) log.firstScriptRead = { time: performance.now(), what: api }
  }
  const wrapMethod = (target: object, name: string, label: string) => {
    const owner = target as Record<string, (...args: unknown[]) => unknown>
    const original = owner[name]!
    owner[name] = function (this: unknown, ...args: unknown[]) {
      scriptRead(label)
      return original.apply(this, args)
    }
  }
  const wrapGetter = (target: object, name: string, label: string) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, name)
    if (!descriptor?.get || !descriptor.configurable) return
    const get = descriptor.get
    Object.defineProperty(target, name, {
      ...descriptor,
      get() {
        scriptRead(label)
        return get.call(this)
      },
    })
  }
  const rawRect = Element.prototype.getBoundingClientRect
  wrapMethod(Element.prototype, 'getBoundingClientRect', 'getBoundingClientRect')
  wrapMethod(Element.prototype, 'getClientRects', 'getClientRects')
  wrapMethod(Document.prototype, 'getAnimations', 'document.getAnimations')
  wrapMethod(Element.prototype, 'getAnimations', 'element.getAnimations')
  wrapMethod(window, 'getComputedStyle', 'getComputedStyle')
  for (const name of ['offsetTop', 'offsetLeft', 'offsetWidth', 'offsetHeight', 'offsetParent']) wrapGetter(HTMLElement.prototype, name, name)
  for (const name of ['clientTop', 'clientLeft', 'clientWidth', 'clientHeight', 'scrollTop', 'scrollLeft', 'scrollWidth', 'scrollHeight']) wrapGetter(Element.prototype, name, name)
  for (const name of ['innerWidth', 'innerHeight', 'scrollX', 'scrollY']) wrapGetter(window, name, `window.${name}`)

  // --- The motion script's changes: attributes (no layout needed to watch them), the sentinel of the
  // header shadow, and count-up pauses. Whether a hidden / pending / paused thing was on screen is
  // read with the unwrapped getBoundingClientRect.
  const onScreen = (element: Element | null) => {
    if (!element) return false
    const box = rawRect.call(element)
    return box.bottom > 0 && box.top < window.innerHeight && box.right > 0 && box.left < window.innerWidth
  }
  const changed = (what: string) => {
    if (!log.firstMotionChange) log.firstMotionChange = { time: performance.now(), what }
  }
  new MutationObserver((records) => {
    quiet = true
    const targets = [...document.querySelectorAll('[data-reveal]')]
    for (const record of records) {
      const element = record.target as Element
      const value = element.getAttribute(record.attributeName!)
      changed(`${record.attributeName}=${value ?? '(removed)'}`)
      if (record.attributeName === 'data-reveal-state') {
        const index = targets.indexOf(element)
        log.revealStates[index] = [...(log.revealStates[index] ?? []), value ?? 'none']
        if (value === 'hidden') log.atStart.push({ time: performance.now(), what: `hidden ${describe(element)}`, onScreen: onScreen(element) })
      }
      if (record.attributeName === 'data-countup-state' && value === 'pending') {
        log.atStart.push({ time: performance.now(), what: 'pending #stats', onScreen: onScreen(element.querySelector('ul')) })
      }
    }
    quiet = false
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-reveal-state', 'data-reveal-step', 'data-countup-state', 'data-scrolled', 'data-faq-motion'] })
  // The count-up arm (D-053): the one change allowed before the start, so it is kept apart from the
  // changes above and never counts as the start - every write and removal, with its time and target.
  new MutationObserver((records) => {
    for (const record of records) {
      const element = record.target as Element
      log.arm.push({ time: performance.now(), set: element.hasAttribute(record.attributeName!), target: describe(element) })
    }
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-countup-armed'] })
  // When the motion script ran: it arms, then registers its paint wait in the same task, so its first
  // observe() call dates it (the arm is due only if that was before 1200ms - D-053 rule 3 (b)).
  const observePaint = PerformanceObserver.prototype.observe
  PerformanceObserver.prototype.observe = function (this: PerformanceObserver, options?: PerformanceObserverInit) {
    if (log.pageScriptRanAt === null && (new Error('stack').stack ?? '').split('\n').some(line => line.includes(pageUrl))) log.pageScriptRanAt = performance.now()
    return observePaint.call(this, options)
  }
  const prepend = Element.prototype.prepend
  Element.prototype.prepend = function (this: Element, ...nodes: (Node | string)[]) {
    if (nodes.some(node => node instanceof Element && node.classList.contains('scroll-sentinel'))) changed('prepend .scroll-sentinel')
    return prepend.apply(this, nodes)
  }
  const pause = Animation.prototype.pause
  Animation.prototype.pause = function (this: Animation) {
    if ((this as CSSAnimation).animationName === 'countup') {
      quiet = true
      changed('pause countup')
      log.atStart.push({ time: performance.now(), what: 'pause countup', onScreen: onScreen(document.querySelector('#stats ul')) })
      quiet = false
    }
    return pause.apply(this)
  }

  // Text reflows once when the web fonts replace their fallback. Shifts after this cannot come from them.
  document.fonts.addEventListener('loadingdone', () => {
    if (log.fontsDoneAt === null) log.fontsDoneAt = Math.round(performance.now())
  })

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & { value: number, hadRecentInput: boolean })[]) {
      log.shifts.push({ value: entry.value, hadRecentInput: entry.hadRecentInput, time: Math.round(entry.startTime) })
    }
  }).observe({ type: 'layout-shift', buffered: true })

  const seen = new WeakSet<Animation>()
  const shownOnce = new WeakSet<Element>()
  const blinked = new WeakSet<Element>()
  const sample = (time: number) => {
    quiet = true
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

    // D-052: the count-up's own timing, read in the first frame in which number 1 counts (past its
    // delay): one start time for all three, delays 0 / 80 / 160ms.
    if (!log.countupTiming) {
      const counting = animations.filter(animation => (animation as CSSAnimation).animationName === 'countup')
      const delayOf = (animation: Animation) => (animation.effect as KeyframeEffect).getTiming().delay ?? 0
      if (counting.length === 3 && counting.every(animation => animation.startTime !== null && animation.playState === 'running')
        && Number(counting[0]!.currentTime) > delayOf(counting[0]!)) {
        log.countupTiming = counting.map(animation => ({ startTime: Number(animation.startTime), delay: delayOf(animation) }))
      }
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
      const finals = countUps.map(countUp => getComputedStyle(countUp.querySelector('.countup-final')!))
      log.counts.push({
        time: Math.round(time),
        onScreen: box.bottom > 0 && box.top < window.innerHeight,
        cardTop: Math.round(box.top),
        cardBottom: Math.round(box.bottom),
        shown,
        finalOpacity: Math.min(...finals.map(style => Number.parseFloat(style.opacity))),
        finalClips: [...new Set(finals.map(style => style.clipPath))],
        state: document.querySelector('#stats')!.getAttribute('data-countup-state'),
        boxes: boxes.join(' '),
      })
    }

    let hidden = 0
    for (const element of document.querySelectorAll('[data-reveal]')) {
      const box = element.getBoundingClientRect()
      const inWindow = box.top < window.innerHeight && box.bottom > 0
      const waiting = element.getAttribute('data-reveal-state') === 'hidden'
      if (inWindow && waiting) hidden++
      if (inWindow && !waiting) shownOnce.add(element)
      if (waiting && shownOnce.has(element) && !blinked.has(element)) {
        blinked.add(element)
        log.blinks.push(`${describe(element)} at ${Math.round(time)}ms`)
      }
    }
    if (hidden) log.hiddenOnScreen.push({ time: Math.round(time), count: hidden })
    quiet = false
    requestAnimationFrame(sample)
  }

  let started = false
  new PerformanceObserver((list) => {
    const paint = list.getEntriesByName('first-contentful-paint')[0]
    if (started || !paint) return
    started = true
    log.fcpExact = paint.startTime
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

/** Serves the page with count-up `mode` (rewriting the switch in the HTML), from the next navigation on. */
async function serveInMode(page: Page, mode: CountUpMode) {
  if (mode === COUNTUP_MODE) return
  const html = withCountUpMode(await (await page.request.get('./')).text(), mode)
  await page.route(url => url.pathname === basePath, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }))
}

/**
 * Opens the page with count-up `mode`, recording its motion, and waits for the first contentful
 * paint, the web font, and the motion script's start (the header sentinel it adds last) - or only
 * for the paint and the font (`waitFor: 'paint'`, when the test itself judges the start).
 */
async function openPage(page: Page, mode: CountUpMode = COUNTUP_MODE, { waitFor = 'start' }: { waitFor?: 'start' | 'paint' } = {}) {
  await serveInMode(page, mode)
  await page.addInitScript(recordMotion)
  await page.goto('./')
  await waitForFirstPaint(page, { waitFor })
  expect(await page.locator('#stats').getAttribute('data-countup-mode')).toBe(mode)
}

async function waitForFirstPaint(page: Page, { waitFor = 'start' }: { waitFor?: 'start' | 'paint' } = {}) {
  await page.waitForFunction(() => window.__motion?.fcp !== null)
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  if (waitFor === 'start') await page.waitForFunction(() => document.querySelector('.scroll-sentinel') !== null)
}

/** When the motion script started: its first layout read or its first change, whichever came first (DA23 (a)). */
function scriptStart(log: MotionLog) {
  const times = [log.firstScriptRead?.time, log.firstMotionChange?.time].filter((time): time is number => typeof time === 'number')
  return times.length ? Math.min(...times) : null
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
 * line of the window must be revealed (design spec 10.4, DA15) and its fade must end. A test that
 * judges hidden elements itself passes `checkReveal: false`.
 */
async function scrollThroughPage(page: Page, { checkReveal = true } = {}) {
  const step = Math.round(page.viewportSize()!.height * 0.6)
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let top = 0; top <= pageHeight + step; top += step) {
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), top)
    if (checkReveal) await expect.poll(() => page.evaluate(hiddenAboveRevealLine), { timeout: 1000, intervals: [50] }).toEqual([])
    else await nextFrames(page)
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

/** Every step down of a shown value, from one frame to the next. */
function stepsDown(frames: CountFrame[]) {
  return frames.flatMap((frame, index) => {
    if (index === 0) return []
    return frame.shown.flatMap((value, number) => {
      const before = Number.parseInt(frames[index - 1]!.shown[number]!, 10)
      return Number.parseInt(value, 10) < before ? [`number ${number + 1}: ${before} then ${value} at ${frame.time}ms`] : []
    })
  })
}

/** The shown values must count up: never down, from the first paint to the final value. */
function expectNeverDown(frames: CountFrame[]) {
  expect(stepsDown(frames), 'a number that went down on screen').toEqual([])
}

/**
 * Per number, over the frames given (numbers on screen): what it showed first, when it first
 * changed, and how long it took from there to its final value.
 */
function countSpans(onScreen: CountFrame[]) {
  const first = onScreen[0]
  return FINAL_NUMBERS.map((finalText, index) => {
    const firstChange = onScreen.find(frame => frame.shown[index] !== first?.shown[index])
    const finalAt = onScreen.find(frame => frame.shown[index] === finalText && frame.time >= (firstChange?.time ?? 0))
    return { finalText, firstShown: first?.shown[index], firstChangeAt: firstChange?.time, spanMs: firstChange && finalAt ? finalAt.time - firstChange.time : null }
  })
}

/** When the count-up arm was written and removed (D-053), as recorded. */
function armOf(log: MotionLog) {
  const writes = log.arm.filter(entry => entry.set)
  const removals = log.arm.filter(entry => !entry.set)
  return { writes: writes.length, removals: removals.length, target: writes[0]?.target ?? null, writtenAt: writes[0]?.time ?? null, removedAt: removals[0]?.time ?? null }
}

/**
 * DA16 (D-031, D-034, D-052): a count on screen starts at 0, never goes down, and takes 1000ms ±5%
 * from its first change on screen to its final value. Stagger, two ways (soft checks, so a wrong
 * build reports both): (a) the Web Animations timing in the first frame number 1 counts - one start
 * time (±1ms), delays 0 / 80 / 160ms (±1ms); (b) on screen, numbers 2 and 3 first change 80 and
 * 160ms after number 1 (±2 frames). The boxes of the numbers keep one size.
 */
function expectCountUp(log: MotionLog, frames: CountFrame[] = log.counts) {
  const onScreen = frames.filter(frame => frame.onScreen)
  expect(onScreen.length, 'frames with the numbers on screen').toBeGreaterThan(30)
  const numbers = countSpans(onScreen)
  expect(numbers.map(number => number.firstShown), 'first value seen').toEqual(FINAL_NUMBERS.map(() => '0'))
  for (const number of numbers) {
    expect(number.spanMs, `${number.finalText}: first change to final value`).not.toBeNull()
    expect(number.spanMs!, `${number.finalText}: count-up on screen, ms`).toBeGreaterThanOrEqual(SPEC.countUpMinMs)
    expect(number.spanMs!, `${number.finalText}: count-up on screen, ms`).toBeLessThanOrEqual(SPEC.countUpMaxMs)
  }
  expectNeverDown(onScreen)
  const timing = log.countupTiming
  expect.soft(timing, 'count-up timing read while number 1 counts').not.toBeNull()
  if (timing) {
    const startTimes = timing.map(entry => entry.startTime)
    expect.soft(Math.max(...startTimes) - Math.min(...startTimes), `(a) one start time for the three numbers: ${startTimes.join(' / ')}`).toBeLessThanOrEqual(1)
    timing.forEach((entry, index) => {
      expect.soft(Math.abs(entry.delay - index * SPEC.staggerMs), `(a) delay of number ${index + 1} is ${entry.delay}ms, expected ${index * SPEC.staggerMs}ms`).toBeLessThanOrEqual(1)
    })
  }
  const starts = numbers.map(number => number.firstChangeAt! - numbers[0]!.firstChangeAt!)
  starts.forEach((start, index) => {
    expect.soft(Math.abs(start - index * SPEC.staggerMs), `(b) number ${index + 1} first changes ${start}ms after number 1`).toBeLessThanOrEqual(2 * SPEC.frameMs)
  })
  expect(new Set(frames.map(frame => frame.boxes)).size, 'sizes of the number boxes').toBe(1)
  expect(onScreen.at(-1)!.shown, 'values at the end').toEqual(FINAL_NUMBERS)
}

/**
 * Mode B with the numbers on screen (D-049 rule 2): the final values in every frame, nothing else.
 * Soft checks: a broken build reports every rule it breaks, not only the first.
 */
function expectFinalInEveryFrame(log: MotionLog) {
  expect(log.counts.length, 'recorded frames').toBeGreaterThan(30)
  const notFinal = log.counts.filter(frame => frame.shown.some((value, index) => value !== FINAL_NUMBERS[index]) || frame.finalOpacity !== 1)
  expect.soft(notFinal[0] ?? null, 'first frame without the final values').toBeNull()
  // Mode B clips the final values away only while counting; not counting it computes to inset(0%).
  const clips = [...new Set(log.counts.flatMap(frame => frame.finalClips))]
  expect.soft(clips.filter(clip => clip !== 'none' && clip !== 'inset(0%)'), 'clip-path of the final values that cuts them').toEqual([])
  expect.soft(log.animations.filter(animation => animation.name === 'countup'), 'countup animations').toEqual([])
  expect.soft([...new Set(log.counts.map(frame => frame.state))], 'data-countup-state').toEqual([null])
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
      expectNeverDown(log.counts.filter(frame => frame.onScreen))
      expect(log.counts.at(-1)!.shown).toEqual(FINAL_NUMBERS)
      if (COUNTUP_MODE === 'load') expectCountUp(log, log.counts.filter(frame => frame.time < scrollStart))
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
      expectCountUp(log)
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
      expectCountUp(log)
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
      expectCountUp(log)
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
      if (mode === 'load') expectCountUp(log, log.counts.filter(frame => frame.time < log.counts.find(frame => !frame.onScreen)!.time))
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

      test('DA20 (c) (D-046 rule 2, D-050 rule 3) nothing stays hidden or at 0: every element shows, the numbers are final from the start on, and the error is reported', async ({ page }) => {
        const errors: string[] = []
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text())
        })
        await page.addInitScript((text) => {
          IntersectionObserver.prototype.observe = () => {
            throw new Error(text)
          }
        }, INJECTED_ERROR)
        await openPage(page, mode, { waitFor: 'paint' })

        const read = () => page.evaluate(() => ({
          waiting: document.querySelectorAll('[data-reveal-state="hidden"]').length,
          state: document.querySelector('#stats')!.getAttribute('data-countup-state'),
          countUps: document.getAnimations().filter(animation => (animation as CSSAnimation).animationName === 'countup').length,
        }))
        // The design check's timing (DA20 (c)): 1.5 seconds after load, then the whole page.
        // Soft checks: a broken error path reports every rule it breaks, not only the first.
        await page.waitForTimeout(1500)
        expect.soft(await read(), '1.5 seconds after load').toEqual({ waiting: 0, state: 'done', countUps: 0 })
        await scrollThroughPage(page, { checkReveal: false })
        await centreStatsCard(page)
        await page.waitForTimeout(1300)
        expect.soft(await read(), 'after scrolling through the page').toEqual({ waiting: 0, state: 'done', countUps: 0 })
        expect.soft(await page.evaluate(notFullyShown), 'not fully shown').toEqual([])

        const log = await motionLog(page)
        const started = scriptStart(log)
        expect.soft(started, 'the motion script started').not.toBeNull()
        const onScreen = log.counts.filter(frame => frame.onScreen)
        expect(onScreen.length, 'frames with the numbers on screen').toBeGreaterThan(0)
        const isFinal = (frame: CountFrame) => frame.shown.every((value, index) => value === FINAL_NUMBERS[index])
        const isZero = (frame: CountFrame) => frame.shown.every(value => value === '0')
        if (mode === 'load' && viewport === PHONE) {
          // D-050 rule 3: mode A on the first screen shows 0 until the script starts (the CSS holds
          // it), never a value in between, and the final values from the start on.
          const before = onScreen.filter(frame => started !== null && frame.time < started)
          const after = onScreen.filter(frame => started === null || frame.time >= started)
          expect.soft(before.find(frame => !isZero(frame) && !isFinal(frame)) ?? null, 'a frame before the start with a value between 0 and final').toBeNull()
          expect.soft(after.find(frame => !isFinal(frame)) ?? null, 'first frame from the start on without the final values').toBeNull()
        }
        else {
          expect.soft(onScreen.find(frame => !isFinal(frame)) ?? null, 'first frame on screen without the final values').toBeNull()
        }
        // Mode A has its countup animations (holding 0) until the script starts; mode B never has one.
        if (mode === 'scroll') expect.soft(log.animations.filter(animation => animation.name === 'countup'), 'countup animations').toEqual([])
        expect.soft(errors.filter(error => error.includes(INJECTED_ERROR)).length, 'the error is reported in the console').toBeGreaterThanOrEqual(1)
      })
    })
  }
}

// ---------------------------------------------------------------------------------------------
// When the motion script starts (D-050), and the web fonts after the first paint
// ---------------------------------------------------------------------------------------------

/** Makes the browser report no paint timing (fallback (a) of the start, design spec 10.1 item 6). */
const NO_PAINT_TIMING = () => {
  const types = PerformanceObserver.supportedEntryTypes.filter(type => type !== 'paint')
  Object.defineProperty(PerformanceObserver, 'supportedEntryTypes', { configurable: true, get: () => types })
}

/**
 * Paint timing that never reports to the page's own script (fallback (b)): its observe() of 'paint'
 * does nothing. The recorder's observer, added before the page, still gets the paint.
 */
const PAINT_NEVER_REPORTED = () => {
  const observe = PerformanceObserver.prototype.observe
  const pageUrl = `${location.origin}${location.pathname}:`
  PerformanceObserver.prototype.observe = function (this: PerformanceObserver, options?: PerformanceObserverInit) {
    const paint = options && (options.type === 'paint' || (options.entryTypes ?? []).includes('paint'))
    if (paint && (new Error('stack').stack ?? '').includes(pageUrl)) return
    return observe.call(this, options)
  }
}

/**
 * Holds the web fonts (/_fonts/) of `page` until it has its first contentful paint (+ `afterMs`),
 * then releases them one file at a time, in URL order, 300ms apart (D-050 note (3), L-071): the
 * files are downloaded while held, so each one swaps at a known moment and the result does not
 * depend on how they happened to arrive. Call before page.goto(); `released` resolves with the
 * number of font requests held.
 */
async function holdFontsUntilFirstPaint(page: Page, afterMs = 0) {
  let firstPaint!: () => void
  const painted = new Promise<void>((resolve) => {
    firstPaint = resolve
  })
  await page.exposeBinding('__fontsFirstPaint', () => firstPaint())
  await page.addInitScript(() => {
    new PerformanceObserver((list, observer) => {
      if (!list.getEntriesByName('first-contentful-paint').length) return
      observer.disconnect()
      window.__fontsFirstPaint!()
    }).observe({ type: 'paint', buffered: true })
  })
  const downloads: Promise<{ route: Route, response: APIResponse }>[] = []
  let releasing = false
  await page.route('**/_fonts/**', async (route) => {
    const download = route.fetch().then(response => ({ route, response }))
    downloads.push(download)
    if (releasing) await route.fulfill({ response: (await download).response })
  })
  const released = painted.then(async () => {
    if (afterMs) await new Promise(resolve => setTimeout(resolve, afterMs))
    const held = (await Promise.all(downloads)).sort((a, b) => a.route.request().url().localeCompare(b.route.request().url()))
    releasing = true
    for (const { route, response } of held) {
      await route.fulfill({ response })
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    return held.length
  })
  return { released }
}

interface LoadRecord {
  fcp: number | null
  /** document.fonts.status at the first contentful paint. */
  fontsAtFcp: string | null
  /** The first document.fonts 'loadingdone'. */
  fontsDoneAt: number | null
  shifts: { value: number, hadRecentInput: boolean, time: number, sources: string[] }[]
}

declare global {
  interface Window {
    __load: LoadRecord
  }
}

/** What a load-shift run records (DA23 (b)): the paint, the fonts, and every layout shift with its sources. */
function recordLoad() {
  const load: LoadRecord = { fcp: null, fontsAtFcp: null, fontsDoneAt: null, shifts: [] }
  window.__load = load
  const describe = (node: Node | null | undefined): string => {
    if (!node) return 'none'
    if (node.nodeType === Node.TEXT_NODE) return `#text in ${describe(node.parentElement)}`
    const element = node as Element
    return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${element.classList.length ? `.${[...element.classList].slice(0, 2).join('.')}` : ''}`
  }
  document.fonts.addEventListener('loadingdone', () => {
    if (load.fontsDoneAt === null) load.fontsDoneAt = performance.now()
  })
  type Shift = PerformanceEntry & { value: number, hadRecentInput: boolean, sources: { node: Node | null, previousRect: DOMRectReadOnly, currentRect: DOMRectReadOnly }[] }
  const rect = (box: DOMRectReadOnly) => [box.x, box.y, box.width, box.height].map(Math.round).join(',')
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as Shift[]) {
      load.shifts.push({
        value: entry.value,
        hadRecentInput: entry.hadRecentInput,
        time: Math.round(entry.startTime),
        sources: (entry.sources ?? []).map(source => `${describe(source.node)} ${rect(source.previousRect)} -> ${rect(source.currentRect)}`),
      })
    }
  }).observe({ type: 'layout-shift', buffered: true })
  new PerformanceObserver((list, observer) => {
    const paint = list.getEntriesByName('first-contentful-paint')[0]
    if (!paint) return
    observer.disconnect()
    load.fcp = paint.startTime
    load.fontsAtFcp = document.fonts.status
  }).observe({ type: 'paint', buffered: true })
}

/** The HTML without the inline motion script, which must be found exactly once (G-039). */
function withoutMotionScript(html: string) {
  const scripts = html.match(/<script data-hid="page-motion">[\s\S]*?<\/script>/g) ?? []
  expect(scripts, 'inline motion scripts in the HTML').toHaveLength(1)
  return html.replace(scripts[0]!, '')
}

/**
 * One load with the web fonts held until the first paint (DA23 (b)): the whole layout shift (no
 * input), and whether the run is valid - at least one font request held, fonts still loading at the
 * first contentful paint, and done after it. `html` replaces the page (null: as served).
 */
async function loadShiftRun(browser: Browser, viewport: { width: number, height: number }, html: string | null) {
  const context = await browser.newContext({ viewport, reducedMotion: 'no-preference' })
  try {
    const page = await context.newPage()
    if (html !== null) await page.route(url => url.pathname === basePath, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }))
    const fonts = await holdFontsUntilFirstPaint(page)
    await page.addInitScript(recordLoad)
    await page.goto('./')
    const held = await fonts.released
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    // DA23 (b): the fonts ready, then one more second.
    await page.waitForTimeout(1000)
    const load = await page.evaluate(() => window.__load)
    const counted = load.shifts.filter(shift => !shift.hadRecentInput)
    const shift = counted.reduce((sum, entry) => sum + entry.value, 0)
    const largest = counted.reduce<typeof counted[number] | null>((top, entry) => (!top || entry.value > top.value ? entry : top), null)
    const valid = held > 0 && load.fontsAtFcp === 'loading' && load.fcp !== null && load.fontsDoneAt !== null && load.fontsDoneAt > load.fcp
    return { valid, held, fcp: load.fcp, fontsAtFcp: load.fontsAtFcp, fontsDoneAt: load.fontsDoneAt, shift, largest }
  }
  finally {
    await context.close()
  }
}

for (const viewport of [PHONE, DESKTOP]) {
  test.describe(`when the motion script starts, at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, reducedMotion: 'no-preference' })

    for (const mode of MODES) {
      test(`DA23 (a) (D-050 rules 1 and 3, D-053) the motion script reads layout and changes the page only after the first contentful paint - but for the count-up arm of mode A - and what it hides, pauses or sets pending is off screen (count-up ${mode})`, async ({ page }) => {
        await openPage(page, mode)
        await nextFrames(page)
        const log = await motionLog(page)
        expect(log.fcpExact, 'first contentful paint').not.toBeNull()
        expect(log.firstScriptRead, 'the motion script read layout').not.toBeNull()
        expect(log.firstMotionChange, 'the motion script changed the page').not.toBeNull()
        expect(log.firstScriptRead!.time, `first read (${log.firstScriptRead!.what}) after the first contentful paint`).toBeGreaterThanOrEqual(log.fcpExact!)
        expect(log.firstMotionChange!.time, `first change (${log.firstMotionChange!.what}) after the first contentful paint`).toBeGreaterThanOrEqual(log.fcpExact!)
        expect(log.atStart.length, 'something waits below the screen').toBeGreaterThan(0)
        expect(log.atStart.filter(mark => mark.onScreen), 'hidden, paused or set pending while on screen').toEqual([])
        expect(log.hiddenOnScreen, 'frames with a waiting element on screen').toEqual([])
        expect(log.blinks, 'elements seen on screen, then hidden').toEqual([])

        // The count-up arm (D-053, DA23 (a) as amended): recorded apart, never the first change. Mode A
        // writes it once, on <section id="stats">, while the script is parsed (before 1200ms and before
        // the start), and removes it once, at the start; mode B never writes it.
        const arm = armOf(log)
        expect(log.firstMotionChange!.what, 'the start is not the arm').not.toContain('data-countup-armed')
        if (mode === 'load') {
          expect(log.pageScriptRanAt, 'invalid run: when the motion script ran was not recorded').not.toBeNull()
          expect(log.pageScriptRanAt!, 'invalid run: the motion script ran after 1200ms, so it must not arm (D-053 rule 3 (b)) - this test needs it earlier').toBeLessThan(SPEC.fallbackDelayMs)
          expect(arm.writes, `arm writes (${JSON.stringify(arm)})`).toBe(1)
          expect(arm.target, 'the arm is on <section id="stats">').toMatch(/^section#stats/)
          expect(arm.writtenAt!, 'arm written before 1200ms').toBeLessThan(SPEC.fallbackDelayMs)
          expect(arm.writtenAt!, 'arm written before the start').toBeLessThanOrEqual(scriptStart(log)!)
          expect(arm.removals, `arm removals (${JSON.stringify(arm)})`).toBe(1)
          expect(arm.removedAt!, 'arm removed at the start, after the first contentful paint').toBeGreaterThanOrEqual(log.fcpExact!)
          test.info().annotations.push({ type: 'arm', description: `script ran ${log.pageScriptRanAt!.toFixed(1)}ms, written ${arm.writtenAt!.toFixed(1)}ms, removed ${(arm.removedAt! - log.fcpExact!).toFixed(1)}ms after the first contentful paint` })
        }
        else {
          expect(arm.writes, 'mode B never arms').toBe(0)
        }
        test.info().annotations.push({ type: 'start after the first contentful paint', description: `${(scriptStart(log)! - log.fcpExact!).toFixed(1)}ms (${log.firstScriptRead!.what})` })
      })
    }
  })
}

for (const [label, fallback] of [['(a) no paint timing', NO_PAINT_TIMING], ['(b) paint never reported to the page', PAINT_NEVER_REPORTED]] as const) {
  test.describe(`when the start falls back: ${label}, at 375x812`, () => {
    test.use({ viewport: PHONE, reducedMotion: 'no-preference' })

    test('DA23 (a) (D-050 rule 1) the motion script still starts: things below the screen wait and reveal once scrolled to, the header shadow comes on, the numbers never go down', async ({ page }) => {
      await page.addInitScript(fallback)
      await openPage(page)
      // The design check's timing: 2 seconds after load (fallback (b) starts 1 second after load).
      await page.waitForFunction(() => performance.now() >= (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).loadEventEnd + 2000)
      const atTwoSeconds = await page.evaluate(() => ({
        sentinels: document.querySelectorAll('.scroll-sentinel').length,
        waiting: document.querySelectorAll('[data-reveal-state="hidden"]').length,
        headerShadow: getComputedStyle(document.querySelector('.site-header')!, '::after').opacity,
      }))
      expect(atTwoSeconds.sentinels, 'the script started (header sentinel)').toBe(1)
      expect(atTwoSeconds.waiting, 'elements below the screen wait').toBeGreaterThan(0)
      expect(atTwoSeconds.headerShadow).toBe('0')
      // Information, not a criterion: fallback (a) starts two frames after the script ran, so the
      // first frame has been drawn; Chromium dates the first contentful paint when that frame is
      // presented, which can be a few ms after the next frame begins.
      const log = await motionLog(page)
      test.info().annotations.push({ type: 'start after the first contentful paint', description: `${(scriptStart(log)! - log.fcpExact!).toFixed(1)}ms` })

      await scrollThroughPage(page)
      expect(await page.evaluate(() => document.querySelectorAll('[data-reveal-state="hidden"]').length)).toBe(0)
      expect(await page.evaluate(notFullyShown)).toEqual([])
      expect(await page.evaluate(headerShadowOpacity)).toBe('1')
      await centreStatsCard(page)
      await waitForCountUp(page)
      const counts = (await motionLog(page)).counts.filter(frame => frame.onScreen)
      expectNeverDown(counts)
      expect(counts.at(-1)!.shown).toEqual(FINAL_NUMBERS)
    })
  })
}

for (const mode of MODES) {
  test.describe(`with the web fonts arriving after the motion script started, count-up ${mode}, at 812x375`, () => {
    test.use({ viewport: LANDSCAPE, reducedMotion: 'no-preference' })

    test('DA22 (D-050, L-069) nothing shifts while the numbers count, although the fonts swapped while they waited below the screen', async ({ page }) => {
      await serveInMode(page, mode)
      const fonts = await holdFontsUntilFirstPaint(page, 300)
      await page.addInitScript(recordMotion)
      await page.goto('./')
      const held = await fonts.released
      await page.evaluate(async () => {
        await document.fonts.ready
      })
      const atLoad = await motionLog(page)
      const waitSet = atLoad.atStart.find(mark => mark.what === (mode === 'load' ? 'pause countup' : 'pending #stats'))
      expect(held, 'invalid run: no font request was held').toBeGreaterThan(0)
      expect(waitSet !== undefined && atLoad.fontsDoneAt !== null && atLoad.fontsDoneAt > waitSet.time,
        `invalid run: the fonts must finish after the numbers start waiting (${waitSet?.what} at ${waitSet?.time.toFixed(0)}ms, fonts done at ${atLoad.fontsDoneAt}ms)`).toBe(true)

      // The design check's timing (DA22): fonts + 1 second, a quarter of the card for 600ms, then
      // the middle of the screen for 1.6 seconds.
      await page.waitForTimeout(1000)
      await showPartOfStatsCard(page, 0.25)
      await page.waitForTimeout(600)
      const countStart = await page.evaluate(() => performance.now())
      await centreStatsCard(page)
      await page.waitForTimeout(1600)
      const log = await motionLog(page)
      const shifted = log.shifts.filter(shift => !shift.hadRecentInput && shift.time >= countStart)
      expect(shifted, 'layout shift while counting').toEqual([])
      expect(log.counts.at(-1)!.shown, 'counted to the final values').toEqual(FINAL_NUMBERS)
      expect(log.animations.filter(animation => animation.name === 'countup').length, 'countup animations').toBe(3)
    })
  })
}

for (const viewport of [PHONE, DESKTOP, LANDSCAPE]) {
  test.describe(`with the web fonts arriving after the first paint, at ${viewport.width}x${viewport.height}`, () => {
    test('DA23 (b) (D-050 rule 6) the load shifts the page no more than the same page without its motion script (+0.001)', async ({ browser, request }) => {
      const html = await (await request.get('./')).text()
      const withScript = await loadShiftRun(browser, viewport, null)
      const withoutScript = await loadShiftRun(browser, viewport, withoutMotionScript(html))
      for (const [name, run] of [['with the motion script', withScript], ['without it', withoutScript]] as const) {
        expect(run.valid, `invalid run (${name}): fonts held ${run.held}, status at the first paint ${run.fontsAtFcp}, first paint ${run.fcp?.toFixed(0)}ms, fonts done ${run.fontsDoneAt?.toFixed(0)}ms`).toBe(true)
      }
      test.info().annotations.push({ type: 'load shift', description: `with the motion script ${withScript.shift.toFixed(5)}, without it ${withoutScript.shift.toFixed(5)}` })
      expect(withScript.shift, `load shift with the motion script (largest: ${JSON.stringify(withScript.largest)}) vs without it ${withoutScript.shift.toFixed(5)}`).toBeLessThanOrEqual(withoutScript.shift + 0.001)
    })
  })
}

// ---------------------------------------------------------------------------------------------
// Count-up mode A when the motion script starts late, and every way out of the arm (D-053, D-057,
// DA24). Each delay comes from the test (a busy main thread, a held response, a paint that is never
// reported), not from the speed of the machine, so the result is the same on every run and in CI.
// DA24 is about mode A, so it runs in mode A whatever the switch says. Its checks are soft and named
// after the case: a broken build reports every rule it breaks, and a negative test can show that it
// failed by the rule it targets (D-056 rule 3). A run that does not set up its case fails as an
// "invalid run" - it never passes quietly.
// ---------------------------------------------------------------------------------------------

/** Serves the page in count-up mode A, with `rewrite` applied to its HTML, from the next navigation on. */
async function serveModeA(page: Page, rewrite?: (html: string) => string) {
  if (!rewrite && COUNTUP_MODE === 'load') return
  const html = withCountUpMode(await (await page.request.get('./')).text(), 'load')
  const body = rewrite ? rewrite(html) : html
  await page.route(url => url.pathname === basePath, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }))
}

/**
 * DA24 (a) / (b): the main thread stays busy from the first contentful paint until FCP + 1300ms,
 * like the long framework frame on a slow phone (LP-018 AC11 (c)); without the arm, the CSS
 * fallback (1200ms after the first style calculation) would begin to count meanwhile. The motion
 * script's paint observer is held back and handed the paint two frames after the busy period: the
 * first frame after a long task may still use the animation clock of the frame before it, and the
 * result would then be down to luck (L-078). Added after the recorder, which keeps its own observer.
 */
const BUSY_AFTER_FCP = () => {
  const Native = window.PerformanceObserver
  const pageUrl = `${location.origin}${location.pathname}:`
  let pageWait: { observer: PerformanceObserver, callback: PerformanceObserverCallback } | null = null
  window.PerformanceObserver = class extends Native {
    readonly heldCallback: PerformanceObserverCallback
    constructor(callback: PerformanceObserverCallback) {
      super(callback)
      this.heldCallback = callback
    }

    override observe(options?: PerformanceObserverInit) {
      const paint = options && (options.type === 'paint' || (options.entryTypes ?? []).includes('paint'))
      if (paint && (new Error('stack').stack ?? '').includes(pageUrl)) {
        pageWait = { observer: this, callback: this.heldCallback }
        return
      }
      return super.observe(options)
    }
  }
  window.__busy = null
  new Native((list, observer) => {
    const paint = list.getEntriesByName('first-contentful-paint')[0]
    if (!paint) return
    observer.disconnect()
    const from = performance.now()
    const pageWaiting = pageWait !== null
    while (performance.now() < paint.startTime + 1300) {
      // Busy: no frame and no other task until FCP + 1300ms (SPEC.busyAfterFcpMs).
    }
    const busy = { fcp: paint.startTime, from, end: performance.now(), pageWaiting, handedAt: null as number | null }
    window.__busy = busy
    requestAnimationFrame(() => requestAnimationFrame(() => {
      busy.handedAt = performance.now()
      if (pageWait) pageWait.callback.call(pageWait.observer, list, pageWait.observer)
    }))
  }).observe({ type: 'paint', buffered: true })
}

/** DA24 (d2): the motion script's requestAnimationFrame throws, so its paint callback fails before it schedules the start. */
const RAF_ERROR = 'LP-018 test: requestAnimationFrame fails on purpose'
const RAF_THROWS = (message: string) => {
  const requestFrame = window.requestAnimationFrame
  const pageUrl = `${location.origin}${location.pathname}:`
  window.requestAnimationFrame = function (callback: FrameRequestCallback) {
    if ((new Error('stack').stack ?? '').includes(pageUrl)) throw new Error(message)
    return requestFrame.call(window, callback)
  }
}

/** DA24 (e): a test script, answered only after SPEC.lateParseMs, holds the parser up just before the motion script. */
const LATE_PARSE_SCRIPT = '__lp018-late-parse.js'
function withLateParse(html: string) {
  const tags = html.match(/<script data-hid="page-motion">/g) ?? []
  expect(tags, 'inline motion scripts in the HTML').toHaveLength(1)
  return html.replace(tags[0]!, `<script src="${basePath}${LATE_PARSE_SCRIPT}"></script>${tags[0]!}`)
}

/** Resolves once the page's clock reaches `ms` after the end of its load event. */
function waitAfterLoad(page: Page, ms: number) {
  return page.waitForFunction((after) => {
    const loadEnd = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).loadEventEnd
    return loadEnd > 0 && performance.now() >= loadEnd + after
  }, ms)
}

function loadEventEnd(page: Page) {
  return page.evaluate(() => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).loadEventEnd)
}

/** DA24: each number on screen counts 950-1050ms as seen (soft, named after the case). */
function expectSpans(label: string, numbers: ReturnType<typeof countSpans>) {
  const outside = numbers.filter(number => number.spanMs === null || number.spanMs < SPEC.countUpMinMs || number.spanMs > SPEC.countUpMaxMs)
  expect.soft(outside.map(number => `${number.finalText}: ${number.spanMs}ms`), `${label}: count-up span outside ${SPEC.countUpMinMs}-${SPEC.countUpMaxMs}ms`).toEqual([])
}

/**
 * DA24: the numbers on screen show 0 in every frame before the motion script starts (the arm holds
 * them), then each counts 950-1050ms as seen, never goes down and ends on its final value.
 * `notBefore`: no number may change before this moment.
 */
function expectHeldThenCounted(label: string, log: MotionLog, { notBefore = null }: { notBefore?: number | null } = {}) {
  const started = scriptStart(log)
  const onScreen = log.counts.filter(frame => frame.onScreen)
  expect(onScreen.length, `${label}: frames with the numbers on screen`).toBeGreaterThan(0)
  expect.soft(started, `${label}: the motion script never started`).not.toBeNull()
  const beforeStart = onScreen.filter(frame => started === null || frame.time < started)
  expect.soft(beforeStart.find(frame => frame.shown.some(value => value !== '0')) ?? null, `${label}: a number on screen was not 0 before the motion script started`).toBeNull()
  const numbers = countSpans(onScreen)
  if (notBefore !== null) {
    const firstChange = Math.min(...numbers.map(number => number.firstChangeAt ?? Number.POSITIVE_INFINITY))
    expect.soft(firstChange, `${label}: a number changed before the motion script was handed the paint (${notBefore.toFixed(0)}ms)`).toBeGreaterThanOrEqual(notBefore)
  }
  expectSpans(label, numbers)
  expect.soft(stepsDown(onScreen), `${label}: a number went down on screen`).toEqual([])
  expect.soft(onScreen.at(-1)!.shown, `${label}: the numbers did not end on their final values`).toEqual(FINAL_NUMBERS)
  test.info().annotations.push({ type: label, description: `start ${started === null ? 'none' : `${(started - log.fcpExact!).toFixed(1)}ms after the first contentful paint`}; frames before it ${beforeStart.length}; spans ${numbers.map(number => number.spanMs).join(' / ')}ms` })
}

test.describe('count-up mode A when the motion script starts late, and every way out of the arm (DA24)', () => {
  test.use({ reducedMotion: 'no-preference' })

  test.describe('at 375x812', () => {
    test.use({ viewport: PHONE })

    test('DA24 (a) (D-053) the main thread is busy until FCP + 1300ms: the numbers wait at 0 until the script starts, then count the whole 1000ms', async ({ page }) => {
      await serveModeA(page)
      await page.addInitScript(recordMotion)
      await page.addInitScript(BUSY_AFTER_FCP)
      await page.goto('./')
      await page.waitForFunction(() => window.__busy?.handedAt != null && performance.now() >= window.__busy.end + 2000)
      const log = await motionLog(page)
      const busy = (await page.evaluate(() => window.__busy))!
      const started = scriptStart(log)
      expect(busy.pageWaiting && busy.end - busy.fcp >= SPEC.busyAfterFcpMs && busy.handedAt !== null && (started === null || started >= busy.handedAt),
        `invalid run: busy from FCP + ${(busy.from - busy.fcp).toFixed(0)} to + ${(busy.end - busy.fcp).toFixed(0)}ms, script waiting ${busy.pageWaiting}, handed at ${busy.handedAt?.toFixed(0)}ms, started ${started?.toFixed(0)}ms`).toBe(true)
      expectHeldThenCounted('DA24 (a)', log, { notBefore: busy.handedAt })
    })

    test('DA24 (c) (D-053 rule 1) when the motion script never ran, nothing arms: the CSS counts by itself after 1200ms and ends on the final values', async ({ page }) => {
      await serveModeA(page, withoutMotionScript)
      await page.addInitScript(recordMotion)
      await page.goto('./')
      await waitAfterLoad(page, 3000)
      const log = await motionLog(page)
      const onScreen = log.counts.filter(frame => frame.onScreen)
      expect(onScreen.length, 'DA24 (c): frames with the numbers on screen').toBeGreaterThan(0)
      const numbers = countSpans(onScreen)
      const delays = log.animations.filter(animation => animation.name === 'countup').map(animation => animation.delay)
      const expected = [0, 1, 2].map(index => SPEC.fallbackDelayMs + index * SPEC.staggerMs)
      const firstChange = Math.min(...numbers.map(number => number.firstChangeAt ?? Number.POSITIVE_INFINITY))
      expect.soft(armOf(log).writes, 'DA24 (c): the arm was written although the motion script never ran').toBe(0)
      expect.soft(delays.length === 3 && delays.every((delay, index) => Math.abs(delay - expected[index]!) <= 1), `DA24 (c): CSS fallback not 3 countup animations delayed 1200 / 1280 / 1360ms (${delays.join(' / ')})`).toBe(true)
      expect.soft(firstChange, 'DA24 (c): a number changed before the 1200ms fallback delay').toBeGreaterThanOrEqual(SPEC.fallbackDelayMs)
      expectSpans('DA24 (c)', numbers)
      expect.soft(stepsDown(onScreen), 'DA24 (c): a number went down on screen').toEqual([])
      expect.soft(onScreen.at(-1)!.shown, 'DA24 (c): the numbers did not end on their final values').toEqual(FINAL_NUMBERS)
      test.info().annotations.push({ type: 'DA24 (c)', description: `delays ${delays.join(' / ')}ms; first change ${firstChange}ms; spans ${numbers.map(number => number.spanMs).join(' / ')}ms` })
    })

    test('DA24 (d1) (D-053 rule 3, D-057) armed, and the first contentful paint never reported: the script starts via fallback (b), load + 1000ms, before the watchdog could; 0 until then, then the whole count', async ({ page }) => {
      await serveModeA(page)
      await page.addInitScript(PAINT_NEVER_REPORTED)
      await page.addInitScript(recordMotion)
      await page.goto('./')
      // Long enough for the watchdog too (arm + 5000ms): a page without fallback (b) would start then,
      // and must still fail - by the way it started, not by the time the test waited (L-085).
      await page.waitForFunction(() => {
        const loadEnd = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).loadEventEnd
        const armAt = window.__motion.arm.find(entry => entry.set)?.time ?? 0
        return loadEnd > 0 && performance.now() >= Math.max(loadEnd + 3500, armAt + 6500)
      })
      const log = await motionLog(page)
      const loadEnd = await loadEventEnd(page)
      const arm = armOf(log)
      expect(arm.writes === 1 && loadEnd + 1500 < arm.writtenAt! + SPEC.armWatchdogMs,
        `invalid run: armed ${arm.writes} time(s) at ${arm.writtenAt?.toFixed(0)}ms, load ended ${loadEnd.toFixed(0)}ms (load + 1500 must come before arm + 5000)`).toBe(true)
      const started = scriptStart(log)
      const viaFallbackB = started !== null && started - loadEnd >= SPEC.fallbackBMs && started < arm.writtenAt! + SPEC.armWatchdogMs
      const way = `load + ${started === null ? '-' : (started - loadEnd).toFixed(1)}ms (at least ${SPEC.fallbackBMs}), arm + ${started === null ? '-' : (started - arm.writtenAt!).toFixed(1)}ms (under ${SPEC.armWatchdogMs})`
      expect.soft(viaFallbackB, `DA24 (d1) started via fallback (b): ${way}`).toBe(true)
      test.info().annotations.push({ type: 'DA24 (d1) start', description: way })
      expectHeldThenCounted('DA24 (d1)', log)
    })

    test('DA24 (d2) (D-046 rule 2, D-053 rule 3) armed, then an error before the start: released - 0 before it, the final values after it, never a value in between', async ({ page }) => {
      const errors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      await serveModeA(page)
      await page.addInitScript(RAF_THROWS, RAF_ERROR)
      await page.addInitScript(recordMotion)
      await page.goto('./')
      await waitAfterLoad(page, 2500)
      const log = await motionLog(page)
      expect(armOf(log).writes, 'invalid run: the count-up was not armed once').toBe(1)
      const end = await page.evaluate(() => ({
        state: document.querySelector('#stats')!.getAttribute('data-countup-state'),
        countUps: document.getAnimations().filter(animation => (animation as CSSAnimation).animationName === 'countup').length,
      }))
      const onScreen = log.counts.filter(frame => frame.onScreen)
      expect(onScreen.length, 'DA24 (d2): frames with the numbers on screen').toBeGreaterThan(0)
      const isFinal = (frame: CountFrame) => frame.shown.every((value, index) => value === FINAL_NUMBERS[index])
      const isZero = (frame: CountFrame) => frame.shown.every(value => value === '0')
      const backToZero = onScreen.filter((frame, index) => index > 0 && isZero(frame) && isFinal(onScreen[index - 1]!))
      expect.soft(end, 'DA24 (d2): the error before the start was not released (done, no countup)').toEqual({ state: 'done', countUps: 0 })
      expect.soft(onScreen.find(frame => !isZero(frame) && !isFinal(frame)) ?? null, 'DA24 (d2): a number on screen was half way (neither 0 nor final)').toBeNull()
      expect.soft(backToZero[0] ?? null, 'DA24 (d2): a number went from its final value back to 0').toBeNull()
      expect.soft(onScreen.at(-1)!.shown, 'DA24 (d2): the numbers did not end on their final values').toEqual(FINAL_NUMBERS)
      expect.soft(errors.filter(error => error.includes(RAF_ERROR)).length, 'DA24 (d2): the error was not reported in the console').toBeGreaterThanOrEqual(1)
      test.info().annotations.push({ type: 'DA24 (d2)', description: `frames on screen ${onScreen.length}: at 0 ${onScreen.filter(isZero).length}, final ${onScreen.filter(isFinal).length}; end ${JSON.stringify(end)}` })
    })

    test('DA24 (d3) (D-057) armed, the first contentful paint never reported and load never fires: the watchdog starts the count 5000-5500ms after the arm; 0 until then, then the whole count', async ({ page }) => {
      await serveModeA(page)
      // One web font file is never answered, so the load event never fires (L-086): the page is opened
      // up to DOMContentLoaded only, and nothing here waits for load or document.fonts.ready.
      const held: Route[] = []
      await page.route('**/_fonts/**', (route) => {
        if (held.length) return route.continue()
        held.push(route)
      })
      await page.addInitScript(PAINT_NEVER_REPORTED)
      await page.addInitScript(recordMotion)
      await page.goto('./', { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => performance.now() >= 7500)
      const log = await motionLog(page)
      const loadEventStart = await page.evaluate(() => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).loadEventStart)
      const arm = armOf(log)
      expect(arm.writes === 1 && loadEventStart === 0 && held.length >= 1,
        `invalid run: armed ${arm.writes} time(s), load event start ${loadEventStart}, font requests held ${held.length}`).toBe(true)
      const started = scriptStart(log)
      const afterArm = started === null ? null : started - arm.writtenAt!
      expect.soft(afterArm !== null && afterArm >= SPEC.armWatchdogMs && afterArm <= SPEC.armWatchdogMaxMs,
        `DA24 (d3): the watchdog did not start the count ${SPEC.armWatchdogMs}-${SPEC.armWatchdogMaxMs}ms after the arm (arm + ${afterArm?.toFixed(0)}ms)`).toBe(true)
      test.info().annotations.push({ type: 'DA24 (d3) start', description: `arm + ${afterArm?.toFixed(1)}ms; load event start ${loadEventStart}; font requests held ${held.length}` })
      expectHeldThenCounted('DA24 (d3)', log)
      // Let the held request go before the page closes (G-045).
      await Promise.all(held.map(route => route.abort().catch(() => undefined)))
    })

    test('DA24 (e) (D-053 rule 3 (b)) the HTML reaches the motion script after 1200ms, when the CSS count has begun: no arm, and the running count is neither paused nor restarted', async ({ page }) => {
      await serveModeA(page, withLateParse)
      await page.route(url => url.pathname.endsWith(`/${LATE_PARSE_SCRIPT}`), async (route) => {
        await new Promise(resolve => setTimeout(resolve, SPEC.lateParseMs))
        await route.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.__lateParseAt = performance.now()' })
      })
      // The start then comes via fallback (b), well after the CSS count began: a script that paused
      // that count would show it (a start right away could hide a pause of a frame or two).
      await page.addInitScript(PAINT_NEVER_REPORTED)
      await page.addInitScript(recordMotion)
      await page.goto('./')
      await waitAfterLoad(page, 3500)
      const log = await motionLog(page)
      const lateParseAt = await page.evaluate(() => window.__lateParseAt ?? null)
      const onScreen = log.counts.filter(frame => frame.onScreen)
      const numbers = countSpans(onScreen)
      const firstChange = Math.min(...numbers.map(number => number.firstChangeAt ?? Number.POSITIVE_INFINITY))
      expect(lateParseAt !== null && lateParseAt >= SPEC.fallbackDelayMs && firstChange < lateParseAt,
        `invalid run: the motion script ran at ${lateParseAt?.toFixed(0)}ms (must be 1200ms or later), the numbers first changed at ${firstChange}ms (must be before it)`).toBe(true)
      expect.soft(armOf(log).writes, 'DA24 (e): the arm was written after 1200ms').toBe(0)
      expect.soft(scriptStart(log), 'DA24 (e): the motion script never started').not.toBeNull()
      expectSpans('DA24 (e)', numbers)
      expect.soft(stepsDown(onScreen), 'DA24 (e): a number went down on screen').toEqual([])
      expect.soft(onScreen.at(-1)!.shown, 'DA24 (e): the numbers did not end on their final values').toEqual(FINAL_NUMBERS)
      test.info().annotations.push({ type: 'DA24 (e)', description: `script ran ${lateParseAt?.toFixed(0)}ms, first change ${firstChange}ms, spans ${numbers.map(number => number.spanMs).join(' / ')}ms` })
    })
  })

  test.describe('at 812x375', () => {
    test.use({ viewport: LANDSCAPE })

    test('DA24 (b) (D-053) the main thread is busy until FCP + 1300ms: below the screen the numbers wait paused at 0, still with a quarter of the card in view, and count once it is in the middle', async ({ page }) => {
      await serveModeA(page)
      await page.addInitScript(recordMotion)
      await page.addInitScript(BUSY_AFTER_FCP)
      await page.goto('./')
      await page.waitForFunction(() => window.__busy != null && performance.now() >= window.__busy.end + 500)
      const held = await page.evaluate(readCountUp)
      const busy = (await page.evaluate(() => window.__busy))!
      const started = scriptStart(await motionLog(page))
      expect(busy.pageWaiting && busy.end - busy.fcp >= SPEC.busyAfterFcpMs && busy.handedAt !== null && (started === null || started >= busy.handedAt),
        `invalid run: busy until FCP + ${(busy.end - busy.fcp).toFixed(0)}ms, script waiting ${busy.pageWaiting}, handed at ${busy.handedAt?.toFixed(0)}ms, started ${started?.toFixed(0)}ms`).toBe(true)
      expect.soft(held, 'DA24 (b): numbers below the screen not paused at 0 after the late start').toMatchObject({ countUps: ['paused', 'paused', 'paused'], values: ['0', '0', '0'] })

      await showPartOfStatsCard(page, 0.25)
      await page.waitForTimeout(600)
      const quarter = await page.evaluate(readCountUp)
      expect(quarter.visibleRatio, 'a quarter of the card in view').toBeGreaterThan(0.2)
      expect(quarter.visibleRatio, 'a quarter of the card in view').toBeLessThan(0.3)
      expect.soft(quarter, 'DA24 (b): the count started before half of the card was on screen').toMatchObject({ countUps: ['paused', 'paused', 'paused'], values: ['0', '0', '0'] })

      await centreStatsCard(page)
      await page.waitForTimeout(1600)
      const log = await motionLog(page)
      const onScreen = log.counts.filter(frame => frame.onScreen)
      expect(onScreen.length, 'DA24 (b): frames with the numbers on screen').toBeGreaterThan(0)
      expectSpans('DA24 (b)', countSpans(onScreen))
      expect.soft(stepsDown(onScreen), 'DA24 (b): a number went down on screen').toEqual([])
      expect.soft(onScreen.at(-1)!.shown, 'DA24 (b): the numbers did not end on their final values').toEqual(FINAL_NUMBERS)
    })
  })
})

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
    // The page script writes the state and the arm; the HTML never has them.
    expect(page).not.toContain('data-countup-state')
    expect(page).not.toContain('data-countup-armed')
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
