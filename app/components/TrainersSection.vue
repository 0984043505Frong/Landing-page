<script setup lang="ts">
import { trainers, trainersSection } from '~/data/trainers'
</script>

<template>
  <section
    id="trainers"
    aria-labelledby="trainers-heading"
  >
    <h2 id="trainers-heading">
      {{ trainersSection.heading }}
    </h2>
    <p>{{ trainersSection.intro }}</p>
    <ul>
      <li
        v-for="trainer in trainers"
        :key="trainer.id"
      >
        <span aria-hidden="true">{{ trainer.initials }}</span>
        <h3>{{ trainer.name }}</h3>
        <p>{{ trainer.role }}</p>
        <ul>
          <li
            v-for="skill in trainer.expertise"
            :key="skill"
          >
            {{ skill }}
          </li>
        </ul>
      </li>
    </ul>
  </section>
</template>
