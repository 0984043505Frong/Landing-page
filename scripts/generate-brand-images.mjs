// Makes the site's icons and link-preview image from the logo (design spec 4.1, D-002, D-011):
//
//   public/favicon.svg           browser tab icon: the logo mark
//   public/apple-touch-icon.png  180×180 home-screen icon for iPhone and iPad, fully opaque
//   public/og-image.png          1200×630 preview shown when a link to the page is shared
//
// Colours are read from app/assets/css/theme.css and text from app/data/site.ts. After changing
// the brand there, run `npm run brand-images`, look at the three files and commit them.
//
// The PNG files are rendered by the Chromium that the e2e tests use (@playwright/test; install it
// once with `npx playwright install chromium`). Rendering needs internet: the page loads the
// site's font, Noto Sans Thai, from Google Fonts. Only this script does that; the site itself
// serves its own copy of the font.
import { readFile, stat, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
// Node 22.18+ strips TypeScript types on import, so this reads the same data as the site.
import { site } from '../app/data/site.ts'
import { toPhraseParts } from '../app/utils/phrases.ts'

const publicDir = new URL('../public/', import.meta.url)
const themeCss = await readFile(new URL('../app/assets/css/theme.css', import.meta.url), 'utf8')

/** Reads a colour token, e.g. themeColor('brand-900') returns '#0b2545'. */
function themeColor(name) {
  const match = themeCss.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{3,8});`))
  if (!match) throw new Error(`--color-${name} is missing from app/assets/css/theme.css`)
  return match[1]
}

const color = {
  brand900: themeColor('brand-900'),
  brand800: themeColor('brand-800'),
  brand100: themeColor('brand-100'),
  accent500: themeColor('accent-500'),
  white: themeColor('white'),
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Thai text as nowrap phrases, the way <PhraseText> shows it (design spec 5.1). */
function phrasesHtml(text) {
  if (typeof text === 'string') return escapeHtml(text)
  return toPhraseParts(text)
    .map(part => `<span class="phrase">${escapeHtml(part.text)}</span>${part.space}${part.wbr ? '<wbr>' : ''}`)
    .join('')
}

// ---------------------------------------------------------------------------------------------
// favicon.svg
//
// Drawn like the logo mark in the header: a 38×38 rounded square with an orange dot on its top
// right corner. The ring around the dot is cut out of the square, so the colour of the browser
// tab shows through it, as the page colour does in the header. A favicon cannot load web fonts,
// so the letters use a bold system font, and are a little larger than in the header so that
// they stay readable at 16–32px.
// ---------------------------------------------------------------------------------------------
function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 42">
  <!-- ${escapeHtml(site.name)} logo mark. Made by scripts/generate-brand-images.mjs: change the script, not this file. -->
  <mask id="dot-ring">
    <rect width="42" height="42" fill="white"/>
    <circle cx="36" cy="6" r="6" fill="black"/>
  </mask>
  <rect y="4" width="38" height="38" rx="10" fill="${color.brand900}" mask="url(#dot-ring)"/>
  <text x="19" y="29.5" fill="${color.white}" font-family="'Noto Sans Thai', 'Noto Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif" font-size="18" font-weight="700" text-anchor="middle">${escapeHtml(site.logo.mark)}</text>
  <circle cx="36" cy="6" r="4" fill="${color.accent500}"/>
</svg>
`
}

// ---------------------------------------------------------------------------------------------
// PNG files: small HTML pages rendered by Chromium, with the site's font.
// ---------------------------------------------------------------------------------------------
const FONT_STYLESHEET = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;700&display=block'

function htmlPage(styles, body) {
  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="${FONT_STYLESHEET}">
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 100%; height: 100%; }
  body { font-family: 'Noto Sans Thai', sans-serif; background: ${color.brand900}; }
  .phrase { white-space: nowrap; }
  /* The logo mark of the header, scaled by --scale (1 = 38px). */
  .mark {
    position: relative; display: grid; place-items: center;
    width: calc(38px * var(--scale)); height: calc(38px * var(--scale));
    border-radius: calc(10px * var(--scale));
    font-size: calc(16px * var(--scale)); font-weight: 700; line-height: 1; letter-spacing: .02em;
  }
  .mark::after {
    content: ''; position: absolute;
    top: calc(-4px * var(--scale)); right: calc(-4px * var(--scale));
    width: calc(12px * var(--scale)); height: calc(12px * var(--scale));
    border: calc(2px * var(--scale)) solid ${color.brand900}; border-radius: 50%;
    background: ${color.accent500};
  }
  ${styles}
</style>
</head>
<body>${body}</body>
</html>`
}

// iOS rounds the corners of home-screen icons itself, and fills transparent pixels with black.
// So the icon is a full navy square: the letters of the mark in the middle and the orange dot
// towards the top right corner, inside the part that stays after rounding.
const appleTouchIcon = {
  file: 'apple-touch-icon.png',
  width: 180,
  height: 180,
  html: htmlPage(`
    body { display: grid; place-items: center; position: relative; }
    .letters { color: ${color.white}; font-size: 72px; font-weight: 700; line-height: 1; letter-spacing: .02em; }
    .dot { position: absolute; top: 30px; right: 30px; width: 28px; height: 28px; border-radius: 50%; background: ${color.accent500}; }
  `, `<span class="letters">${escapeHtml(site.logo.mark)}</span><span class="dot"></span>`),
}

// Link preview: the logo mark as in the footer (white on navy), the brand name and the label
// above the hero heading. Everything sits in the middle, because some apps crop the preview to
// a square. No people, phone numbers, LINE ID or QR code (N12, N16, D-006).
const ogImage = {
  file: 'og-image.png',
  width: 1200,
  height: 630,
  maxBytes: 300 * 1024,
  html: htmlPage(`
    body { display: grid; place-content: center; justify-items: center; gap: 36px; text-align: center; }
    .mark { --scale: 3; background: ${color.white}; color: ${color.brand900}; }
    .name { color: ${color.white}; font-size: 56px; font-weight: 700; line-height: 1.2; }
    .eyebrow {
      display: inline-flex; align-items: center; gap: 12px; max-width: 580px;
      padding: 10px 24px; border-radius: 999px;
      background: ${color.brand800}; color: ${color.brand100}; font-size: 26px; line-height: 1.5;
    }
    .eyebrow::before { content: ''; flex: none; width: 12px; height: 12px; border-radius: 50%; background: ${color.accent500}; }
  `, `
    <span class="mark">${escapeHtml(site.logo.mark)}</span>
    <h1 class="name">${escapeHtml(site.name)}</h1>
    <p class="eyebrow"><span>${phrasesHtml(site.hero.eyebrow)}</span></p>
  `),
}

/** Throws if Noto Sans Thai did not load, instead of saving an image in a fallback font. */
async function waitForFont(page) {
  const loaded = await page.evaluate(async (texts) => {
    await document.fonts.ready
    const faces = []
    for (const [font, text] of texts) faces.push(...await document.fonts.load(font, text))
    return faces.length > 0 && faces.every(face => face.status === 'loaded')
  }, [['700 16px "Noto Sans Thai"', site.name + site.logo.mark], ['400 16px "Noto Sans Thai"', 'ศูนย์ฝึกอบรม']])
  if (!loaded) throw new Error('Noto Sans Thai did not load from Google Fonts. Check the internet connection.')
}

async function renderPng(browser, image) {
  const page = await browser.newPage({ viewport: { width: image.width, height: image.height }, deviceScaleFactor: 1 })
  await page.setContent(image.html, { waitUntil: 'load' })
  await waitForFont(page)
  const png = await page.screenshot({ type: 'png' })
  await page.close()

  // A PNG of colour type 2 (RGB) has no alpha channel, so no pixel can be transparent.
  const colorType = png[25]
  if (colorType !== 2) throw new Error(`${image.file}: expected an RGB PNG without alpha (colour type 2), got ${colorType}`)
  if (image.maxBytes && png.length > image.maxBytes) throw new Error(`${image.file}: ${png.length} bytes, more than ${image.maxBytes}`)
  return png
}

async function save(file, content) {
  const url = new URL(file, publicDir)
  await writeFile(url, content)
  const { size } = await stat(url)
  console.log(`public/${file}  ${(size / 1024).toFixed(1)} kB`)
}

await save('favicon.svg', faviconSvg())

const browser = await chromium.launch()
try {
  for (const image of [appleTouchIcon, ogImage]) {
    await save(image.file, await renderPng(browser, image))
  }
}
finally {
  await browser.close()
}
