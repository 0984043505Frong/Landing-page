<script setup lang="ts">
import { site } from '~/data/site'
</script>

<template>
  <footer id="site-footer">
    <p>{{ site.name }}</p>
    <p>{{ site.footer.note }}</p>
  </footer>
</template>
