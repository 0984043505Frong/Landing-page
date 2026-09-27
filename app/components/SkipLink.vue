<script setup lang="ts">
import { site } from '~/data/site'
</script>

<template>
  <!--
    First link on the page: keyboard users can jump over the header to the main content.
    It stays above the top edge of the screen until it has focus (design spec 4.0).
  -->
  <a
    href="#main"
    class="absolute -top-25 left-3 z-100 rounded-button bg-brand-900 px-4 py-3 font-bold text-white focus:top-3"
  >{{ site.header.skipLinkLabel }}</a>
</template>
