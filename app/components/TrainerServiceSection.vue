<script setup lang="ts">
import { steps, stepsSection } from '~/data/steps'
import { joinPhrases } from '~/utils/phrases'
</script>

<template>
  <section
    id="trainer-service"
    class="bg-surface py-16 lg:py-24"
    aria-labelledby="trainer-service-heading"
  >
    <div class="page-container">
      <!-- data-reveal (here and on each card): fades in when scrolled to, done by app/motion/page-motion.js (design spec 10.4). -->
      <SectionHeader
        data-reveal
        heading-id="trainer-service-heading"
        :heading="stepsSection.heading"
        :intro="stepsSection.intro"
        class="mb-8 lg:mb-12"
      />
      <!-- 1 column on phones, 2 × 2 from 768px, 4 in a row from 1024px (design spec 4.7). -->
      <ol
        role="list"
        class="grid gap-6 md:grid-cols-2 md:gap-x-8 md:gap-y-10 lg:grid-cols-4 lg:gap-8"
      >
        <li
          v-for="(step, index) in steps"
          :key="joinPhrases(step.title)"
          data-reveal
          class="relative grid grid-cols-[48px_1fr] content-start gap-4 md:grid-cols-1"
        >
          <span class="relative z-1 grid size-12 place-items-center rounded-full bg-brand-900 text-[20px] leading-none font-bold text-white">
            {{ index + 1 }}
          </span>
          <div>
            <h3 class="pt-2.5 text-[20px] leading-[1.4] font-bold text-brand-900 md:pt-0">
              <PhraseText :text="step.title" />
            </h3>
            <p class="mt-1 text-ink-muted">
              <PhraseText :text="step.description" />
            </p>
          </div>
          <!-- Line to the next step: down the left side on phones, none in the 2 × 2 grid, across from 1024px. -->
          <span
            v-if="index < steps.length - 1"
            class="absolute top-14 -bottom-4 left-[23px] w-0.5 rounded-[1px] bg-border md:hidden lg:-right-5 lg:bottom-auto lg:left-15 lg:top-[23px] lg:block lg:h-0.5 lg:w-auto"
            aria-hidden="true"
          />
        </li>
      </ol>
    </div>
  </section>
</template>
