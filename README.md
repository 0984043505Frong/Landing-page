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
  [Playwright](https://playwright.dev) for the generated page at 375, 768 and 1440px.

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

All colours, the font, corner radii and shadows are tokens in **`app/assets/css/theme.css`**.
Change the values there and build again: every part of the page takes its colours from these
tokens, and Tailwind's own colour palette is switched off, so no other colour can slip in.

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
and no link to LINE.

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
