<script setup lang="ts">
import { site } from '~/data/site'
</script>

<template>
  <header id="site-header">
    <a href="#hero">{{ site.name }}</a>
    <nav :aria-label="site.header.navLabel">
      <ul>
        <li
          v-for="link in site.nav"
          :key="link.href"
        >
          <a :href="link.href">{{ link.label }}</a>
        </li>
      </ul>
    </nav>
  </header>
</template>
