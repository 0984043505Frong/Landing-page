<script setup lang="ts">
// The contact buttons and the quote form are added together with the final design.
import { contactSection } from '~/data/contact'
</script>

<template>
  <section
    id="contact"
    aria-labelledby="contact-heading"
  >
    <h2 id="contact-heading">
      {{ contactSection.heading }}
    </h2>
    <p>{{ contactSection.intro }}</p>
  </section>
</template>
