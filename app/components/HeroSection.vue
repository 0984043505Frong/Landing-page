<script setup lang="ts">
import { site } from '~/data/site'

const { hero } = site
</script>

<template>
  <section
    id="hero"
    aria-labelledby="hero-heading"
  >
    <h1 id="hero-heading">
      {{ hero.heading }}
    </h1>
    <p>{{ hero.subheading }}</p>
    <a :href="hero.primaryCta.href">{{ hero.primaryCta.label }}</a>
    <a :href="hero.secondaryCta.href">{{ hero.secondaryCta.label }}</a>
  </section>
</template>
