<script setup lang="ts">
import { stats, statsSection } from '~/data/stats'
import { joinPhrases } from '~/utils/phrases'
</script>

<template>
  <!-- A white card that overlaps the bottom 64px of the hero (design spec 4.4). -->
  <section
    id="stats"
    class="relative z-1 -mt-16 pb-14 lg:pb-16"
    aria-labelledby="stats-heading"
  >
    <div class="page-container">
      <!-- The design shows no heading here: this one names the section for screen readers. -->
      <h2
        id="stats-heading"
        class="sr-only"
      >
        <PhraseText :text="statsSection.heading" />
      </h2>
      <ul
        role="list"
        class="grid grid-cols-3 rounded-card bg-surface px-1 py-4 shadow-card md:px-4 md:py-8"
      >
        <li
          v-for="stat in stats"
          :key="joinPhrases(stat.label)"
          class="border-border px-2 text-center not-first:border-l"
        >
          <p class="text-[28px] leading-[1.25] font-bold text-brand-900 md:text-[40px]">
            {{ stat.value }}{{ stat.suffix }}
          </p>
          <p class="mt-1 text-[14px] leading-[1.45] text-ink-muted md:text-[16px]">
            <PhraseText :text="stat.label" />
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>
