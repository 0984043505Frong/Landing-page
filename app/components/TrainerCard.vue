<script setup lang="ts">
import type { Trainer } from '~/types/content'

defineProps<{ trainer: Trainer }>()
</script>

<template>
  <!-- trainer-card: lifts on hover (design spec 10.6, assets/css/motion.css). -->
  <article class="trainer-card flex h-full items-start gap-4 rounded-card border border-border bg-surface p-6">
    <!-- Initials instead of a photo: the trainers are made up (N12). The name follows as the heading. -->
    <span
      class="grid size-16 shrink-0 place-items-center rounded-full bg-brand-900 text-[22px] leading-none font-bold text-white"
      aria-hidden="true"
    >
      {{ trainer.initials }}
    </span>
    <div>
      <h3 class="text-[20px] leading-[1.4] font-bold text-brand-900">
        <PhraseText :text="trainer.name" />
      </h3>
      <p class="mt-0.5 text-[15px] leading-[1.6] text-ink-muted">
        <PhraseText :text="trainer.role" />
      </p>
      <ul
        role="list"
        class="mt-3 flex flex-wrap gap-2"
      >
        <li
          v-for="skill in trainer.expertise"
          :key="skill"
          class="rounded-full border border-border px-2.5 py-0.5 text-[14px] leading-[1.6] whitespace-nowrap text-ink"
        >
          {{ skill }}
        </li>
      </ul>
    </div>
  </article>
</template>
