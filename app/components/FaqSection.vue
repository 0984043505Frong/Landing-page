<script setup lang="ts">
import { faqSection, faqs } from '~/data/faqs'
</script>

<template>
  <section
    id="faq"
    class="bg-surface py-16 lg:py-24"
    aria-labelledby="faq-heading"
  >
    <!-- From 1024px: heading left, questions right, in the same columns as the contact section (design spec 4.9). -->
    <div class="page-container lg:grid lg:grid-cols-[5fr_7fr] lg:items-start lg:gap-16">
      <!-- data-reveal (here and on the list): fades in when scrolled to, done by app/motion/page-motion.js (design spec 10.4). -->
      <SectionHeader
        data-reveal
        heading-id="faq-heading"
        :heading="faqSection.heading"
        class="mb-8 lg:mb-0"
      />
      <!--
        Native <details>: each question opens and closes without JavaScript, and the shared
        name keeps only one open at a time. The first question is open when the page loads.
        An answer fades in when a visitor opens its question; its height never animates, and it
        closes at once (design spec 10.7).
      -->
      <div
        class="faq-list grid gap-3"
        data-reveal
      >
        <details
          v-for="(faq, index) in faqs"
          :key="faq.id"
          name="faq"
          :open="index === 0"
          class="group/faq rounded-card border border-border bg-surface"
        >
          <summary class="group/question flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-card py-3.5 pr-4 pl-5 text-[17px] leading-[1.5] font-bold text-brand-900 hover:text-brand-700 md:py-4 md:pr-5 md:pl-6 [&::-webkit-details-marker]:hidden">
            <PhraseText :text="faq.question" />
            <!--
              Arrow in a circle (design spec 4.9): light when closed, navy and turned up when open.
              Hover and press restyle it in either state. It turns without animation for visitors
              who asked for less motion.
            -->
            <span
              class="grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700 transition-[rotate,background-color,color] duration-200 group-open/faq:rotate-180 group-open/faq:bg-brand-900 group-open/faq:text-white group-hover/question:bg-brand-100 group-hover/question:text-brand-700 group-active/question:bg-brand-700 group-active/question:text-white motion-reduce:transition-none"
              aria-hidden="true"
            >
              <IconChevronDown class="size-[18px]" />
            </span>
          </summary>
          <div class="faq-answer px-5 pb-5 text-ink-muted md:px-6 md:pb-6">
            <p>
              <PhraseText :text="faq.answer" />
            </p>
          </div>
        </details>
      </div>
    </div>
  </section>
</template>
