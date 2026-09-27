<script setup lang="ts">
import type { ThaiText } from '~/types/content'

/**
 * Heading block at the top of a section (design spec 4.5). The space below it depends on
 * the layout around it, so the section sets it with a class, e.g. class="mb-8 lg:mb-12".
 */
defineProps<{
  /** id of the <h2>: the section points its aria-labelledby at it. */
  headingId: string
  heading: ThaiText
  intro?: ThaiText
}>()
</script>

<template>
  <!-- The short orange bar above the heading is decoration (design spec 4.5). -->
  <div class="max-w-[720px] before:mb-4 before:block before:h-1 before:w-10 before:rounded-[2px] before:bg-accent-500">
    <h2
      :id="headingId"
      class="text-[28px] leading-[1.35] font-bold text-brand-900 md:text-[36px]"
    >
      <PhraseText :text="heading" />
    </h2>
    <p
      v-if="intro"
      class="mt-3 text-ink-muted"
    >
      <PhraseText :text="intro" />
    </p>
  </div>
</template>
