<script setup lang="ts">
import { site } from '~/data/site'
import pageMotion from '~/motion/page-motion.js?raw'

// Link previews need an absolute image URL, so resolve the file name against the site URL.
const ogImageUrl = new URL(site.ogImage, site.url).href

useSeoMeta({
  title: site.title,
  description: site.description,
  ogType: 'website',
  ogSiteName: site.name,
  ogTitle: site.title,
  ogDescription: site.description,
  ogUrl: site.url,
  ogLocale: site.locale,
  ogImage: ogImageUrl,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: site.ogImageAlt,
  twitterCard: 'summary_large_image',
})

useHead({
  link: [{ rel: 'canonical', href: site.url }],
})

// Motion (design spec 10, D-045): the page-level motion script goes into the generated HTML as it
// is, as an inline <script> at the end of <body>. It runs once, as soon as the page is parsed, and
// never waits for this app's JavaScript or for a section to hydrate. Server only, so the text of the
// script is written into the HTML once and stays out of the JavaScript sent to the browser.
if (import.meta.server) {
  useHead({ script: [{ key: 'page-motion', innerHTML: pageMotion, tagPosition: 'bodyClose' }] })
}
</script>

<template>
  <!--
    Lazy hydration (D-039). Every section is rendered into the generated HTML as before; only the
    time its JavaScript runs changes.
    - SkipLink and SiteHeader hydrate with the page: the menu button must work on the first tap.
    - The contact section hydrates when it comes into view: the quote form needs Vue.
    - The other sections have nothing to run in the browser, so they never hydrate and their
      JavaScript is never downloaded.
    Rules when adding or changing a component here:
    - A component that needs Vue in the browser (event handlers, state, lifecycle hooks) must not
      be hydrate-never: its markup would still show, but nothing would react, and no error says so.
    - A section with nothing to run in the browser uses hydrate-never.
    - Pass no prop that can change to a lazy component: Nuxt hydrates it as soon as a prop changes.
  -->
  <SkipLink />
  <SiteHeader />
  <main id="main">
    <LazyHeroSection hydrate-never />
    <LazyStatsSection hydrate-never />
    <LazyCoursesSection hydrate-never />
    <LazyTrainerServiceSection hydrate-never />
    <LazyTrainersSection hydrate-never />
    <LazyFaqSection hydrate-never />
    <LazyContactSection hydrate-on-visible />
  </main>
  <LazySiteFooter hydrate-never />
  <!-- Last in the page, so keyboard users reach it after the footer (design spec 4.12). -->
  <LazyFloatingLineButton hydrate-never />
</template>
