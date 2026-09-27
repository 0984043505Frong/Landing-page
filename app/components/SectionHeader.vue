<script setup lang="ts">
import type { ThaiText } from '~/types/content'

defineProps<{
  /** id of the <h2>: the section points its aria-labelledby at it. */
  headingId: string
  heading: ThaiText
  intro?: string
}>()
</script>

<template>
  <!-- The short orange bar above the heading is decoration (design spec 4.5). -->
  <div class="mb-8 max-w-[720px] before:mb-4 before:block before:h-1 before:w-10 before:rounded-[2px] before:bg-accent-500 lg:mb-12">
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
      {{ intro }}
    </p>
  </div>
</template>
