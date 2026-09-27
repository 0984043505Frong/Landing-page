<script setup lang="ts">
import { steps, stepsSection } from '~/data/steps'
</script>

<template>
  <section
    id="trainer-service"
    aria-labelledby="trainer-service-heading"
  >
    <h2 id="trainer-service-heading">
      {{ stepsSection.heading }}
    </h2>
    <p>{{ stepsSection.intro }}</p>
    <ol>
      <li
        v-for="step in steps"
        :key="step.title"
      >
        <h3>{{ step.title }}</h3>
        <p>{{ step.description }}</p>
      </li>
    </ol>
  </section>
</template>
