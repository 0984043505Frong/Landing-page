<script setup lang="ts">
import { trainers, trainersSection } from '~/data/trainers'
</script>

<template>
  <section
    id="trainers"
    class="bg-surface-muted py-16 lg:py-24"
    aria-labelledby="trainers-heading"
  >
    <div class="page-container">
      <SectionHeader
        heading-id="trainers-heading"
        :heading="trainersSection.heading"
        :intro="trainersSection.intro"
        class="mb-8 lg:mb-12"
      />
      <!-- 1 column on phones, 2 from 768px (design spec 4.8). -->
      <ul
        role="list"
        class="grid gap-5 md:grid-cols-2"
      >
        <li
          v-for="trainer in trainers"
          :key="trainer.id"
        >
          <TrainerCard :trainer="trainer" />
        </li>
      </ul>
    </div>
  </section>
</template>
