import tailwindcss from '@tailwindcss/vite'
import { site } from './app/data/site'

// GitHub Pages serves this project under a sub-path, e.g. '/Landing-page/'.
// It is taken from the site URL and set here on purpose, not through NUXT_APP_BASE_URL:
// Git Bash on Windows rewrites environment values that start with '/' into Windows paths.
const baseURL = new URL(site.url).pathname

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/fonts'],
  components: [
    // Icon components go by their file name (IconMenu), without the folder prefix (IconsIconMenu).
    { path: '~/components/icons', pathPrefix: false },
    '~/components',
  ],
  devtools: { enabled: true },
  app: {
    baseURL,
    head: {
      htmlAttrs: { lang: 'th' },
      link: [
        // Nuxt does not add the base URL to files in public/, so join it by hand.
        // Without the apple-touch-icon link, iOS looks for the icon at the root of the domain,
        // outside this site's sub-path. Both images come from scripts/generate-brand-images.mjs.
        { rel: 'icon', type: 'image/svg+xml', href: `${baseURL}favicon.svg` },
        { rel: 'apple-touch-icon', href: `${baseURL}apple-touch-icon.png` },
      ],
    },
  },
  css: ['~/assets/css/main.css'],
  experimental: {
    // One static page without data fetching: skip the separate _payload.json request.
    payloadExtraction: false,
  },
  compatibilityDate: '2026-09-27',
  vite: {
    plugins: [tailwindcss()],
  },
  typescript: {
    // `npm run typecheck` also checks the tests and the test runner configs.
    nodeTsConfig: {
      include: ['../tests/**/*', '../vitest.config.ts', '../playwright.config.ts'],
    },
  },
  hooks: {
    // No <link rel="prefetch"> for any chunk. Nuxt 4.5.2 prefetches every lazily hydrated
    // component, hydrate-never ones included (in production builds it cannot match them to
    // their files), so the browser would still download their JavaScript after the page loads.
    // The page needs only the entry at load; a lazy chunk is fetched when its component hydrates.
    'build:manifest': (manifest) => {
      for (const chunk of Object.values(manifest)) chunk.prefetch = false
    },
  },
  eslint: {
    // Also check formatting (2-space indent, single quotes, no semicolons).
    config: { stylistic: true },
  },
  fonts: {
    // Self-hosted at build time, so visitors never connect to Google Fonts.
    defaults: {
      weights: [400, 700],
      styles: ['normal'],
      subsets: ['thai', 'latin'],
      preload: true,
    },
  },
})
