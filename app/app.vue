<script setup lang="ts">
import { site } from '~/data/site'

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
</script>

<template>
  <SkipLink />
  <SiteHeader />
  <main id="main">
    <HeroSection />
    <StatsSection />
    <CoursesSection />
    <TrainerServiceSection />
    <TrainersSection />
    <FaqSection />
    <ContactSection />
  </main>
  <SiteFooter />
</template>
