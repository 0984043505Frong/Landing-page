<script setup lang="ts">
import type { Component } from 'vue'
import type { CourseIconName } from '~/types/content'
import IconChartColumn from './icons/IconChartColumn.vue'
import IconConciergeBell from './icons/IconConciergeBell.vue'
import IconLightbulb from './icons/IconLightbulb.vue'
import IconPresentation from './icons/IconPresentation.vue'
import IconSparkles from './icons/IconSparkles.vue'
import IconUsers from './icons/IconUsers.vue'

defineProps<{ name: CourseIconName }>()

// One icon component per name in CourseIconName. `satisfies` makes `npm run typecheck` fail
// when a name has no component here, or when a component is listed under an unknown name.
const icons = {
  'users': IconUsers,
  'presentation': IconPresentation,
  'concierge-bell': IconConciergeBell,
  'chart-column': IconChartColumn,
  'lightbulb': IconLightbulb,
  'sparkles': IconSparkles,
} satisfies Record<CourseIconName, Component>
</script>

<template>
  <component :is="icons[name]" />
</template>
