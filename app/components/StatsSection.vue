<script setup lang="ts">
import { stats, statsSection } from '~/data/stats'
</script>

<template>
  <section
    id="stats"
    aria-labelledby="stats-heading"
  >
    <h2 id="stats-heading">
      {{ statsSection.heading }}
    </h2>
    <dl>
      <div
        v-for="stat in stats"
        :key="stat.label"
      >
        <dt>{{ stat.label }}</dt>
        <dd>{{ stat.value }}{{ stat.suffix }}</dd>
      </div>
    </dl>
  </section>
</template>
