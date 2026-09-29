// Measures how much JavaScript the generated page makes the browser load (decisions D-028, D-043):
//
// - M2: every script the browser loads when the page opens, before any scroll, tap or key press,
//       at 375x812 (the numbers that must go down) and at 1440x900 (reported).
// - M3: every script loaded after also scrolling slowly to the end of the page, opening the
//       mobile menu (below 1024px) and focusing the first field of the quote form.
//
// Sizes are the gzip size (Node zlib, default level) of the same file in .output/public, so two
// builds compare the same way on any server. Inline <script> tags that run are added to M2 / M3;
// data scripts (JSON, import map) are reported apart. 1 kB = 1000 bytes, as in the build log.
// "M2 with prefetch" also counts .js files that <link rel="prefetch"> downloads while the page
// opens (Chromium reports those as type 'other', so M2 as written in D-028 leaves them out).
// M1 is not measured here: it is the sum of the gzip sizes in the `npm run generate` log of the
// entry script and every file that index.html preloads with <link rel="modulepreload">. The
// build tool's gzip reads about 1% higher than Node's: compare M1 with M1 only.
//
// Usage: npm run generate, then npm run preview in another terminal, then:
//   npm run measure:js                        (table in the terminal)
//   npm run measure:js -- --json report.json  (also writes every request to a JSON file)
//   npm run measure:js -- --url http://localhost:4173/Landing-page/ --dir .output/public
//
// It uses the Chromium of @playwright/test (npx playwright install chromium) and nothing else.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { gzipSync } from 'node:zlib'
import { chromium } from '@playwright/test'
// Node 22.18+ strips TypeScript types on import, so this reads the same site URL as nuxt.config.ts.
import { site } from '../app/data/site.ts'

const basePath = new URL(site.url).pathname
const { values: options } = parseArgs({
  options: {
    url: { type: 'string', default: new URL(basePath, 'http://localhost:4173').href },
    dir: { type: 'string', default: '.output/public' },
    json: { type: 'string' },
  },
})
const publicDir = resolve(options.dir)

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1440, height: 900 },
]
/** The page counts as settled when no request has started for this long. */
const QUIET_MS = 2000
/** Scroll step and pause while scrolling to the end of the page. */
const SCROLL_STEP_PX = 200
const SCROLL_PAUSE_MS = 100
/** Types of <script> that hold data, not code. */
const DATA_SCRIPT_TYPES = new Set(['application/json', 'importmap', 'application/ld+json', 'speculationrules'])

const kB = bytes => (bytes / 1000).toFixed(2)
const gzipSize = content => gzipSync(content).length

/** Maps a URL of the served site to its file in the generated output. */
function fileOf(url) {
  const path = decodeURIComponent(new URL(url).pathname)
  if (!path.startsWith(basePath)) throw new Error(`${url} is outside the base path ${basePath}`)
  const file = join(publicDir, path.slice(basePath.length) || 'index.html')
  if (!existsSync(file)) throw new Error(`${url} has no file in ${publicDir}: was the page generated from this build?`)
  return file
}

/** Inline <script> tags of the HTML, split into code that runs and data. */
function inlineScripts(html) {
  const code = []
  const data = []
  for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc\s*=/.test(attributes)) continue
    const type = (attributes.match(/\btype\s*=\s*"([^"]*)"/)?.[1] ?? '').toLowerCase()
    const entry = { type: type || '(none)', bytes: Buffer.byteLength(body), gzip: gzipSize(body) }
    ;(DATA_SCRIPT_TYPES.has(type) ? data : code).push(entry)
  }
  return { code, data }
}

async function waitForQuiet(page, requests) {
  let count = -1
  let quietSince = Date.now()
  while (Date.now() - quietSince < QUIET_MS) {
    if (requests.length !== count) {
      count = requests.length
      quietSince = Date.now()
    }
    await page.waitForTimeout(100)
  }
}

async function measure(browser, viewport) {
  // A new context has an empty cache. Reduced motion stays at the browser default (no-preference).
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const requests = []
  // What the page was doing when each request started: 'open', then 'scroll to <scrollY>', 'menu', 'form'.
  let step = 'open'
  page.on('request', (request) => {
    requests.push({ step, url: request.url(), type: request.resourceType() })
  })

  const response = await page.goto(options.url, { waitUntil: 'load' })
  const html = await response.text()
  await waitForQuiet(page, requests)

  // M3: scroll to the end, open the menu, focus the form. Nothing here clicks a link or submits.
  for (;;) {
    const { scrollY, atEnd } = await page.evaluate((stepPx) => {
      window.scrollBy({ top: stepPx, behavior: 'instant' })
      return {
        scrollY: Math.round(window.scrollY),
        atEnd: window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1,
      }
    }, SCROLL_STEP_PX)
    step = `scroll to ${scrollY}`
    await page.waitForTimeout(SCROLL_PAUSE_MS)
    if (atEnd) break
  }
  const menuButton = page.locator('button[aria-controls="site-nav"]')
  if (await menuButton.isVisible()) {
    step = 'menu'
    await menuButton.click()
    await page.keyboard.press('Escape')
  }
  step = 'form'
  await page.locator('#quote-form input, #quote-form select, #quote-form textarea').first().focus()
  await waitForQuiet(page, requests)
  await context.close()

  const inline = inlineScripts(html)
  // Chromium reports a file fetched by <link rel="prefetch"> as type 'other', not 'script'. It is
  // still JavaScript downloaded while the page opens, so it is counted, and marked as prefetch.
  const isJs = request => new URL(request.url).pathname.endsWith('.js')
  const scripts = requests
    .filter(request => request.type === 'script' || (request.type === 'other' && isJs(request)))
    .map(request => ({
      ...request,
      prefetch: request.type !== 'script',
      file: new URL(request.url).pathname.slice(basePath.length),
      gzip: gzipSize(readFileSync(fileOf(request.url))),
    }))
  const inlineCode = inline.code.reduce((sum, script) => sum + script.gzip, 0)
  // A file that was prefetched and later imported is one download: each URL counts once.
  const sum = list => [...new Map(list.map(script => [script.url, script.gzip])).values()].reduce((total, gzip) => total + gzip, 0)
  const onOpen = scripts.filter(script => script.step === 'open')
  return {
    viewport: `${viewport.width}x${viewport.height}`,
    // D-028 as written: responses of type 'script' + inline code.
    m2: sum(onOpen.filter(script => !script.prefetch)) + inlineCode,
    // Everything downloaded, prefetched files included.
    m2WithPrefetch: sum(onOpen) + inlineCode,
    m3: sum(scripts) + inlineCode,
    inlineCode,
    inlineScripts: inline.code,
    dataScripts: inline.data,
    scripts,
    otherRequests: requests.filter(request => !['script', 'document', 'stylesheet', 'font'].includes(request.type)),
    requests,
  }
}

const browser = await chromium.launch()
const results = []
try {
  for (const viewport of VIEWPORTS) results.push(await measure(browser, viewport))
}
finally {
  await browser.close()
}

console.log(`JavaScript loaded by ${options.url} (gzip of the files in ${options.dir}; 1 kB = 1000 bytes)\n`)
console.log('| viewport | M2: on open | M2 with prefetch | M3: after scroll, menu, form | inline code | data scripts |')
console.log('|---|---|---|---|---|---|')
for (const result of results) {
  const data = result.dataScripts.map(script => `${script.type} ${kB(script.gzip)}`).join(', ')
  console.log(`| ${result.viewport} | ${kB(result.m2)} kB | ${kB(result.m2WithPrefetch)} kB | ${kB(result.m3)} kB | ${kB(result.inlineCode)} kB | ${data} |`)
}
for (const result of results) {
  console.log(`\nScripts at ${result.viewport}:`)
  for (const script of result.scripts) {
    console.log(`  ${script.file.padEnd(22)} ${kB(script.gzip).padStart(6)} kB  ${script.step}${script.prefetch ? ' (prefetch)' : ''}`)
  }
  const others = result.otherRequests.map(request => `${request.type} ${new URL(request.url).pathname}`)
  console.log(`  Requests other than document, script, stylesheet or font: ${others.length ? others.join(', ') : 'none'}`)
}
if (options.json) {
  writeFileSync(options.json, `${JSON.stringify({ url: options.url, dir: options.dir, results }, null, 2)}\n`)
  console.log(`\nWrote ${options.json}`)
}
