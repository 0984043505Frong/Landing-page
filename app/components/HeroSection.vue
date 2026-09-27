<script setup lang="ts">
import { site } from '~/data/site'

const { hero } = site
</script>

<template>
  <!-- `on-dark`: focus rings are orange on this navy background (main.css). -->
  <section
    id="hero"
    class="on-dark relative overflow-hidden bg-brand-900 pt-10 pb-24 text-white md:pt-14 md:pb-30 lg:pt-22 lg:pb-38"
    aria-labelledby="hero-heading"
  >
    <div class="page-container grid items-center gap-12 lg:grid-cols-[1.15fr_.85fr]">
      <div>
        <p class="inline-flex items-center gap-2 rounded-full bg-brand-800 px-3.5 py-1.5 text-[14px] leading-[1.5] text-brand-100">
          <span
            class="size-2 shrink-0 rounded-full bg-accent-500"
            aria-hidden="true"
          />
          <PhraseText :text="hero.eyebrow" />
        </p>
        <!-- The page's largest text (its LCP element): nothing in the hero is lazy-loaded. -->
        <h1
          id="hero-heading"
          class="mt-4 text-[32px] leading-[1.35] font-bold md:text-[44px] lg:text-[52px] lg:leading-[1.3]"
        >
          <PhraseText :text="hero.heading" />
        </h1>
        <p class="mt-4 max-w-[34em] text-[17px] leading-[1.7] text-brand-100 md:text-[18px] lg:text-[19px]">
          <PhraseText :text="hero.subheading" />
        </p>
        <!--
          The flex gap spaces the buttons. Spaces in the template would not: Vue drops the
          whitespace between tags, and the two labels would run together without the gap.
          Stacked full width on phones, side by side from 640px (design spec 4.3).
        -->
        <div class="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
          <BaseButton :href="hero.primaryCta.href">
            {{ hero.primaryCta.label }}
          </BaseButton>
          <BaseButton
            :href="hero.secondaryCta.href"
            variant="ghost-light"
          >
            {{ hero.secondaryCta.label }}
          </BaseButton>
        </div>
        <p class="mt-5 flex items-center gap-2 text-[15px] text-brand-100">
          <IconClock class="size-5 shrink-0 text-accent-500" />
          <PhraseText :text="hero.note" />
        </p>
      </div>
      <HeroIllustration class="hidden w-full max-w-[460px] justify-self-end lg:block" />
    </div>
  </section>
</template>
