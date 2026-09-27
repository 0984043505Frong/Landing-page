<script setup lang="ts">
import { site } from '~/data/site'

/**
 * The logo (design spec 4.1, 4.13): the square mark with an orange dot, then the brand name
 * on two lines. It renders the two parts side by side without a wrapper, so the element around
 * it sets the layout: the header puts it in its home link, the footer in a plain element.
 * The words take their colour from that element.
 */
withDefaults(defineProps<{
  /** True on a navy background (the footer): the mark turns white and the tagline light. */
  onDark?: boolean
}>(), {
  onDark: false,
})
</script>

<template>
  <!-- The mark repeats the name in letters, so screen readers skip it and read the words. -->
  <span
    class="relative grid size-[38px] shrink-0 place-items-center rounded-button text-[16px] leading-none font-bold tracking-[.02em]"
    :class="onDark ? 'bg-white text-brand-900' : 'bg-brand-900 text-white'"
    aria-hidden="true"
  >
    {{ site.logo.mark }}
    <!-- The dot's border has the colour of the background, so it looks cut out of the mark. -->
    <span
      class="absolute -top-1 -right-1 size-3 rounded-full border-2 bg-accent-500"
      :class="onDark ? 'border-brand-900' : 'border-surface'"
    />
  </span>
  <span class="grid leading-[1.15]">
    <span class="text-[18px] font-bold">{{ site.logo.name }}</span>
    <!-- Keeps the two words apart in the accessible name, e.g. of the header's home link. -->
    {{ ' ' }}
    <span
      class="text-[12px] tracking-[.14em] uppercase"
      :class="onDark ? 'text-brand-100' : 'text-ink-muted'"
    >{{ site.logo.tagline }}</span>
  </span>
</template>
