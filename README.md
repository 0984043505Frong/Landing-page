# BrightPath Academy — landing page (demo)

A one-page website in Thai for **BrightPath Academy**, a made-up corporate training centre that
also finds trainers for companies. It is a portfolio piece and a template: the brand, the colours
and every piece of text can be changed without touching a component.

> **This is a demo.** The brand, its courses, trainers, numbers and contact details are
> fictional, and the quote form sends nothing anywhere. The page says so in its footer:
> "เว็บไซต์ตัวอย่างเพื่อแสดงผลงาน · แบรนด์และข้อมูลเป็นสมมติ" (a demo website to show work;
> the brand and its data are fictional).

Live site: <https://0984043505frong.github.io/Landing-page/>

- **Sections:** sticky header with an anchor menu (a "เมนู" button and panel below 1024px), hero,
  stats, courses, trainer service in 4 steps, trainers, FAQ, contact buttons with a quote form,
  footer, and a floating LINE button on phones.
- **Stack:** [Nuxt 4](https://nuxt.com) generated as static files, [Tailwind CSS 4](https://tailwindcss.com),
  [`@nuxt/fonts`](https://fonts.nuxt.com), TypeScript. No UI library, no jQuery, no slider.
- **Tests:** [Vitest](https://vitest.dev) for the form rules and the content data,
  [Playwright](https://playwright.dev) for the generated page at 375, 768 and 1440px wide, and at
  812×375 (a phone on its side).

## Performance techniques

What keeps the page fast, and the numbers before and after v1.1.

- **Static generation (D-027).** `npm run generate` renders every section, with all of its text,
  into `index.html`: the browser fetches no data and builds nothing itself to show the page.
- **Lazy hydration (D-039, D-040).** In `app/app.vue`, `SkipLink` and `SiteHeader` hydrate with the
  page, because the menu button must work on the first tap; `ContactSection` is
  `hydrate-on-visible`, because the quote form needs Vue; the other 8 components are
  `hydrate-never`, because they have nothing to run, so their JavaScript is never downloaded. A
  `build:manifest` hook in `nuxt.config.ts` turns off `<link rel="prefetch">`, because Nuxt 4.5.2
  still prefetches the chunks of `hydrate-never` components.
- **The quote form before it hydrates (D-041).** What is typed before the contact section hydrates
  is kept (`QuoteForm.vue` reads the fields in `onBeforeMount`), and a submit made meanwhile is held
  by `app/plugins/pending-submit.client.ts` and sent once the form hydrates. The form has
  `method="dialog"`, so a submit that Vue does not handle does nothing instead of putting the typed
  values in the URL; when a form service such as Formspree is connected, change it to
  `method="post"` with the service's `action`.
- **No image files (D-027).** The page loads no raster image: the icons and the hero illustration
  are inline SVG that take their colours from the theme tokens, so there is nothing to lazy-load.
  An `<img>` or `<iframe>` added below the hero must have `loading="lazy"` (with `width`, `height`
  and, on an image, `decoding="async"`), or the browser tests "c (D-027) every image or frame below
  the hero is lazy-loaded and sized; none in the hero or above it is lazy"
  (`tests/e2e/lazy-hydration.spec.ts`) and "14 (N7) images are SVG or WebP, and lazy-loaded below
  the hero" (`tests/e2e/landing.spec.ts`) fail.
- **Self-hosted font.** `@nuxt/fonts` downloads Noto Sans Thai while the site builds and the site
  serves its own copy, so visitors never connect to Google Fonts; `index.html` preloads one font
  file, the Thai subset that both weights use.
- **Motion with CSS and one small inline script (D-045, D-050, D-030, D-031, D-034).**
  - `app/app.vue` writes `app/motion/page-motion.js` into the generated HTML as an inline script.
    It drives CSS transitions and animations with IntersectionObserver, and never waits for the
    page's JavaScript or for a section to hydrate (D-045).
  - It starts on the frame after the first contentful paint and reads no layout before then: a
    build that read layout while the page was still being parsed scored 97 instead of 99 in
    Lighthouse (LP-018, D-050).
  - Only `transform` and `opacity` move, for 400 ms or less, except the count-up of the stats, which
    lasts about 1 s (D-030, D-034); the timings are tokens in `app/assets/css/theme.css`.
  - A counting number is drawn in an `aria-hidden` layer over its final value, which stays in the
    HTML for search engines and screen readers and holds the box at its final width (D-031).
  - With reduced motion nothing animates; without JavaScript, or if the script never runs, nothing
    is hidden; and there is no animation library.
  - The count-up is never left at 0: the script "arms" it as soon as it runs
    (`data-countup-armed`), so the CSS fallback that counts by itself after 1.2 s is only for a page
    where the script never runs, and a 5 s watchdog (`ARM_WATCHDOG_MS`) starts an armed count if
    neither the first-paint report nor `load` ever comes (D-053, D-057).
- **Count-up modes (D-049).** This build uses mode A, `COUNTUP_MODE = 'load'` in
  `app/motion/countup-mode.ts`: the numbers on the first screen count up right after the first
  paint. In a Lighthouse comparison of v1.0.0, mode A and mode B run back to back (LP-018), all
  three scored a median of 99, so mode A costs nothing; to switch to mode B (the first screen shows
  the final values at once, and only numbers scrolled to later count), change that line to
  `'scroll'`.
- **Size-adjusted Thai fallback (D-058, D-061).**
  - Until Noto Sans Thai arrives, the browser draws Thai in a system font at that font's own size
    (on Windows, Tahoma, 7–13% wider), and the size-adjusted fallbacks that `@nuxt/fonts` adds are
    Latin fonts only, so the hero heading wrapped differently and the page jumped when the web font
    came in.
  - `app/assets/css/main.css` adds an `@font-face` "Thai Fallback: Tahoma" per weight, scaled with
    `size-adjust` (97% for 400, 91.09% for 700) and limited to Thai letters with `unicode-range`;
    `--font-sans` in `theme.css` lists it after Noto Sans Thai, which replaces it once loaded.
  - When the web font arrives after the first paint, the layout shift goes **0.27 → 0.0006** at
    1440×900 and **0.25 → 0.003** at 812×375 (Chromium on Windows, font files held back until the
    first paint, largest of 5 loads); once the font has loaded, the page is identical to the pixel.
  - Lighthouse already reports CLS 0 for both versions, because there the font arrives before the
    first paint: these numbers are the slow-network case.
  - Limits: it helps only where Tahoma is installed, which is Windows (measured) and probably macOS
    (not measured); iOS and Android behave as v1.0.0 did. During the fallback, 88 of 1601 window
    widths (320 to 1920px) still wrap the hero text differently, against 1134 in v1.0.0.

**Before and after**

| | [v1.0.0](https://github.com/0984043505Frong/Landing-page/tree/v1.0.0) | v1.1 (this build) |
|---|---|---|
| M1: the entry script and its `modulepreload` files, gzip | 68.48 kB | 58.06 kB |
| M2: JavaScript downloaded when the page opens at 375×812, gzip | 73.47 kB | 62.60 kB |
| Lighthouse Performance, median of 5 runs | 99 | 99 |
| Lighthouse CLS, every run | 0 | 0 |
| Layout shift when the web font arrives after the first paint, 1440×900 / 812×375 | 0.27 / 0.25 | 0.0006 / 0.003 |

- M2 counts every script the page downloads as it opens, inline scripts and `<link rel="prefetch">`
  downloads included: v1.0.0 prefetched the chunks of its two error pages (404 and 500), without
  which its M2 is 68.02 kB.
- Lighthouse 13.5.0, mobile preset, on a local build at `http://localhost:4173/Landing-page/`,
  5 runs per build back to back on one machine (v1.0.0 first), 2026-10-02 (UTC). These are not
  numbers from the live site. The layout shift is measured as described in the Thai fallback item
  above.

**Measure it yourself**

```bash
npm run generate     # M1: add up the gzip sizes this log shows for the entry script and for each
                     # file that .output/public/index.html loads with <link rel="modulepreload">
npm run preview      # in a second terminal
npm run measure:js   # M2 (and M3, after scrolling and using the menu and the form)
```

To measure another build, such as the v1.0.0 tag, generate and preview that build, then run this
repository's script on its files: `npm run measure:js -- --dir <that build>/.output/public`;
`--url` measures another address. The header of `scripts/measure-js.mjs` explains the options; the
script uses the Chromium of Playwright (`npx playwright install chromium`).

## Run it

You need [Node.js](https://nodejs.org) 22.19 or later and npm; `node -v` shows which Node you
have. 22.19 is the minimum, set in `engines` in `package.json`. `.nvmrc` holds only `22`: a
version manager such as nvm, and the deploy workflow, take the latest release of Node 22 from it,
which meets that minimum.

```bash
npm ci               # install the exact versions from package-lock.json
npm run dev          # development server: http://localhost:3000/Landing-page/
npm run generate     # build the static site into .output/public/
npm run preview      # serve that build: http://localhost:4173/Landing-page/
npm run test:unit    # unit tests (Vitest)
npm run test:e2e     # browser tests of the generated site (Playwright)
npm run measure:js   # JavaScript the page loads: generate first, and keep preview running
npm run lint         # ESLint, formatting included
npm run typecheck    # TypeScript and Vue templates
```

- **The first build after an install needs internet.** `@nuxt/fonts` downloads the font,
  Noto Sans Thai, while it builds, and keeps it in `node_modules/.cache` (which `npm ci` clears).
  If `npm run generate` stops with `ENOTFOUND` or `fetch failed`, check the connection and run it
  again.
- The site lives under `/Landing-page/` locally too, as on GitHub Pages, so a wrong path shows up
  before it is deployed.
- `npm run test:e2e` tests the last `npm run generate`, so generate first. It starts
  `npm run preview` by itself, or uses a server that already listens on port 4173: stop any
  other preview there, or the tests check that one. The first time, install the browser with
  `npx playwright install chromium`.

## Change the colours

All colours, the font, corner radii, shadows and motion timings are tokens in
**`app/assets/css/theme.css`**. Change the values there and build again: every part of the page
takes its colours from these tokens, and Tailwind's own colour palette is switched off, so no other
colour can slip in. The font token, `--font-sans`, also lists "Thai Fallback: Tahoma", a fallback
face sized to Noto Sans Thai (see Performance techniques): after changing the font, measure its
`size-adjust` again (see "The hero text" below).

Three files outside the CSS show the brand too, and have to be made again after a change of
colours or name: `public/favicon.svg`, `public/apple-touch-icon.png` and `public/og-image.png`
(the picture shown when a link to the page is shared).

```bash
npx playwright install chromium   # once: the browser that draws the images
npm run brand-images
```

- `scripts/generate-brand-images.mjs` reads the colours from `theme.css` (`brand-900`,
  `brand-800`, `brand-100`, `accent-500`, `white`) and the text from `app/data/site.ts`
  (`site.logo.mark`, `site.name`, `site.hero.eyebrow`).
- It needs internet: the two PNG files are drawn with Noto Sans Thai loaded from Google Fonts.
  If the font does not load, the script stops instead of saving images in another font. The
  favicon's letters use a bold system font, since a favicon cannot load a web font.
- **Look at all three images before you commit them.** Running the script again does not always
  give byte-identical files.

## Edit the content

Every piece of text on the page is in **`app/data/`**; the components hold no text of their own.

| File | Content |
|---|---|
| `site.ts` | page title and description, site URL, menu, hero, footer |
| `stats.ts` | the three numbers under the hero |
| `courses.ts` | the courses (cards, and the course list of the quote form) |
| `steps.ts` | the four steps of the trainer service |
| `trainers.ts` | the trainers |
| `faqs.ts` | questions and answers |
| `contact.ts` | contact section text, phone, email and the LINE buttons |
| `quoteForm.ts` | labels, error messages and the thank-you message of the quote form |

**Courses** are in `app/data/courses.ts`. Add, change or remove entries there: the cards and the
form's course list follow, with no component to edit. Each course has an `id` (unique, lowercase
letters, digits and dashes, and not `not-sure`, which the form uses for "not sure yet"), a
`title`, an `icon`, a `duration`, its `formats` (`onsite`, `online`) and exactly three `topics`.

**Course icons:** `icon` is the name of a [Lucide](https://lucide.dev/icons) icon from the set
that has a component: `users`, `presentation`, `concierge-bell`, `chart-column`, `lightbulb`,
`sparkles` (`CourseIconName` in `app/types/content.ts`). `npm run typecheck` fails on any other
name. To offer another icon, copy its SVG from the `lucide-static` package into a component in
`app/components/icons/` like the others, add it to `app/components/CourseIcon.vue` and its name
to `CourseIconName`. If the Lucide licence lists the icon as derived from Feather, add its name to
`THIRD-PARTY-NOTICES.md` as well.

**Thai text that must not break mid-word** is written as a list of phrases (D-009):

```ts
heading: ['อบรมพนักงานให้', 'ได้ผลจริง ', 'ด้วยหลักสูตร', 'และวิทยากรที่ใช่'],
```

- One item is one phrase. A line can break between two phrases, never inside one.
- A space between two phrases goes at the end of the first phrase, as in `'ได้ผลจริง '`.
- Each phrase must fit on one line of a 375px-wide phone, or the page scrolls sideways.
- A plain string (`'…'`) is also allowed where no list is required: the browser then breaks the
  line wherever its Thai dictionary allows, sometimes inside a compound word. The fields that must
  stay lists are listed in `phraseLists` in `tests/unit/data.test.ts`.
- After changing text, look at the page 375px wide.

**The hero text** (`site.hero`) sets how far down the stats card sits on a phone. After changing
it, check the first screen at 375×812: the floating LINE button must not cover the stats card.
`npm run test:e2e` checks this (test DA8), and a unit test holds the current hero text (below).
The `size-adjust` values of "Thai Fallback: Tahoma" in `app/assets/css/main.css` were measured for
this hero text, so after changing the hero text or the font, measure them again as the comment
above them explains. `tests/e2e/font-fallback.spec.ts` checks at 4 window sizes that the hero text
wraps the same in the fallback as in Noto Sans Thai, but only on Windows; elsewhere, CI included,
it checks only the CSS rules (D-060).

**A new section** follows the rules of the others:

- Its text goes in a file in `app/data/`; the component holds none.
- In `app/app.vue`, pick its hydration as the comment there explains: `hydrate-never` if it has
  nothing to run in the browser, `hydrate-on-visible` if it needs Vue below the first screen, and
  no lazy hydration if it must work on the first tap, like the header. Pass a lazy component no
  prop that can change.
- To fade it in when it is scrolled to, give its heading block and each card the `data-reveal`
  attribute, as `app/components/CoursesSection.vue` does; `app/motion/page-motion.js` does the rest.
- An `<img>` or `<iframe>` below the hero needs `loading="lazy"`, `width` and `height`, and an image
  also `decoding="async"`, or the browser tests c (D-027) and 14 (N7) fail (see Performance
  techniques).

## Tests that hold the demo's text

How many courses, trainers and questions there are is up to the content: add or remove them
without touching a test. The browser tests count what `app/data/` lists. Two parts are laid out
for a fixed number of items: the stats card (3 numbers) and the trainer service (4 steps).

These tests in `tests/unit/data.test.ts` compare the data with the exact text or values of this
demo. Change them together with the data when the template is used for a client:

| Test (`describe` › `it`) | Holds |
|---|---|
| site › is served from /Landing-page/ on GitHub Pages | `site.url` |
| site › resolves og:image to an absolute URL under the site URL | the `og:image` URL (`site.url` + `site.ogImage`) |
| site › has the 5 menu items of the chosen design, without the stats section (D-014) | `site.nav` |
| site › gives the menu button one name for both states (D-010) | `site.header.menuButtonLabel` ("เมนู") |
| site › keeps the hero text that the first mobile screen was measured with (D-013) | `site.hero` eyebrow, heading, subheading and note |
| site › shows the exact disclaimer in the footer (N11) | `site.footer.note` |
| stats › has 3 numbers, the columns of the stats card | 3 entries in `stats` |
| steps › lists the 4 steps of the trainer service in order | the 4 step titles |
| contact (N16) › uses an email address on the reserved .example domain | `contact.email` |
| contact (N16) › keeps the LINE buttons on this page instead of linking to a LINE ID (D-006) | `contact.line` (`TODO(line)`) |
| quote form text › shows the exact thank-you text after submitting (N13) | `quoteForm.success` |

The other tests in that file check rules that hold for any content: unique ids, three topics per
course, trainer initials, a phone link that dials the number shown, a message for every form
error, and the fields that must stay phrase lists.

Some browser tests in `tests/e2e/landing.spec.ts` describe what this demo does and change with it:
the tests numbered **8 (N13)** expect that the form sends nothing and that `TODO(formspree)` is
still there, and the tests numbered **10** and **11** expect LINE buttons that lead to this page
and no link to LINE. In `tests/e2e/lazy-hydration.spec.ts`, test **g (D-041)** expects a submit
without JavaScript to send nothing.

## Use it for a client

- **Contact details are in one file:** `app/data/contact.ts`. They are placeholders: the phone
  number is not a real line and the email address uses the reserved `.example` domain. Replace
  them, and the test that expects an `.example` address.
- **LINE buttons:** follow `TODO(line)` in `app/data/contact.ts`. Set `floatingHref` and
  `contactHref` to the client's LINE Official Account link and replace `label` and both
  aria-labels. Links that start with `http` open in a new tab without any other change
  (`app/utils/links.ts`). In this demo the buttons only lead to the contact section and the
  quote form (D-006).
- **Quote form:** follow `TODO(formspree)` in `app/utils/submitQuote.ts` to send the requests to
  a form service such as [Formspree](https://formspree.io). Today the form only checks the
  fields and shows the thank-you message; nothing is sent (N13). Once it sends, change the
  thank-you message's second line, "(เว็บไซต์ตัวอย่าง — ข้อมูลในฟอร์มไม่ได้ถูกส่งจริง)"
  (`quoteForm.success.note` in `app/data/quoteForm.ts`), and its test (N13). Change the unit
  test "resolves without sending anything over the network" in
  `tests/unit/submitQuote.test.ts` as well: it expects `submitQuote()` never to call `fetch`.
  To let the form send without JavaScript too, change its `method="dialog"` in
  `app/components/QuoteForm.vue` to `method="post"` with the service's form URL as `action`, and
  change the browser test g (D-041), which expects such a submit to send nothing.
- **Site address:** `site.url` in `app/data/site.ts` is the only place for it. Its path
  (`/Landing-page/`) becomes `app.baseURL` in `nuxt.config.ts`, so every file of the site is
  requested under that path, and `og:url`, the canonical link and `og:image` are built from it.
  GitHub Pages serves a repository at `https://<user>.github.io/<repository>/`: after renaming
  the repository, or moving the site to its own domain, change `site.url` and its two tests.
- **Brand and text:** everything else is in `app/data/` (see above), including the footer's demo
  disclaimer (`site.footer.note`), which a real client's site does not need.

## Deploy

The site is published to GitHub Pages by **GitHub Actions**, with one workflow:
`.github/workflows/deploy.yml`. It needs no secrets.

- **Every push and pull request** is checked: `npm ci` with the Node version from `.nvmrc`, then
  `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run generate`, and
  `npm run test:e2e` on the generated site (with Chromium installed first).
- **A push to `main`** that passes all of them is deployed: `.output/public` goes live at
  <https://0984043505frong.github.io/Landing-page/>. Pull requests are never deployed.
- To deploy `main` again without a new commit, run the workflow by hand: Actions → "CI and deploy"
  → "Run workflow".

In the repository settings, **Pages → Source must be "GitHub Actions"**. Do not switch it to
"Deploy from a branch": that source publishes files committed to a branch, so the built site would
have to be committed, and it would go live without the checks above. Jekyll, which that source
runs, is not the problem: `npm run generate` writes a `.nojekyll` file, so `_nuxt/` and `_fonts/`
would be kept.

## A workaround to remove later

`app/plugins/router-base-fix.client.ts` works around a Nuxt bug. Without a `pages/` folder, Nuxt
4.5.2 uses a small router that adds the base path twice when the URL changes through the browser
(a click on an in-page link such as `#faq`, or Back / Forward): `/Landing-page/#faq` became
`/Landing-page/Landing-page/#faq`, an address that does not exist. The plugin removes the base
path before that router adds it again. It is fixed upstream in
[nuxt/nuxt#36034](https://github.com/nuxt/nuxt/pull/36034), which is not in a release yet
(4.5.2 is the latest in September 2026). After upgrading to a Nuxt release that includes it,
delete the plugin and check that `tests/e2e/navigation.spec.ts` still passes (planned as task
LP-013 in the project records).

## Licence

© 2026 0984043505Frong. All rights reserved.

There is no LICENSE file in this repository, on purpose: you are welcome to read the code, but
using, copying or selling it needs the author's permission. The third-party parts below keep
their own licences.

## Credits

- **Icons:** [Lucide](https://lucide.dev) (ISC licence), copied as inline SVG from `lucide-static`
  1.48.0 into `app/components/icons/`. Some of them come from [Feather](https://feathericons.com)
  (MIT licence, © Cole Bemis). Full licence texts and the list of Feather icons:
  [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
- **LINE icon:** [Simple Icons](https://simpleicons.org) (CC0 1.0). The LINE name and logo are
  trademarks of their owner; this demo shows the logo only where a client's LINE button would go.
- **Font:** [Noto Sans Thai](https://github.com/notofonts/thai), SIL Open Font License 1.1
  ([openfontlicense.org](https://openfontlicense.org)). Its official `OFL.txt` reads:
  "Copyright 2022 The Noto Project Authors (https://github.com/notofonts/thai)". The font files
  are not in this repository: `@nuxt/fonts` downloads them from Google Fonts during the build, and
  the built site serves its own copy, so visitors never connect to Google Fonts.
- **Hero illustration:** drawn for this project (`app/components/HeroIllustration.vue`).
