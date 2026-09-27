<script setup lang="ts">
import { faqSection, faqs } from '~/data/faqs'
</script>

<template>
  <section
    id="faq"
    aria-labelledby="faq-heading"
  >
    <h2 id="faq-heading">
      {{ faqSection.heading }}
    </h2>
    <details
      v-for="faq in faqs"
      :key="faq.id"
      name="faq"
    >
      <summary>{{ faq.question }}</summary>
      <p>{{ faq.answer }}</p>
    </details>
  </section>
</template>
