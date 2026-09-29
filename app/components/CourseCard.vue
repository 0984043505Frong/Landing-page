<script setup lang="ts">
import { coursesSection } from '~/data/courses'
import type { Course } from '~/types/content'

defineProps<{ course: Course }>()
</script>

<template>
  <!-- course-card: lifts on hover (design spec 10.6, assets/css/motion.css). -->
  <article class="course-card flex h-full flex-col gap-4 rounded-card border border-t-4 border-border border-t-accent-500 bg-surface p-6">
    <div class="flex items-center justify-between gap-3">
      <span
        class="grid size-12 shrink-0 place-items-center rounded-card bg-brand-50 text-brand-700"
        aria-hidden="true"
      >
        <CourseIcon
          :name="course.icon"
          class="size-6"
        />
      </span>
      <ul
        role="list"
        class="flex flex-wrap justify-end gap-1.5"
      >
        <li
          v-for="format in course.formats"
          :key="format"
          class="rounded-full bg-brand-50 px-2.5 py-0.5 text-[14px] leading-[1.6] font-bold whitespace-nowrap text-brand-700"
        >
          {{ coursesSection.formatLabels[format] }}
        </li>
      </ul>
    </div>
    <!-- At least two lines from 768px, so the cards in a row line up below their titles. -->
    <h3 class="text-[20px] leading-[1.4] font-bold text-brand-900 md:min-h-[2.8em]">
      <PhraseText :text="course.title" />
    </h3>
    <p class="-mt-2 flex items-center gap-2 text-[15px] text-ink-muted">
      <IconClock class="size-[18px] shrink-0" />
      <span class="whitespace-nowrap">{{ course.duration }}</span>
    </p>
    <ul
      role="list"
      class="grid gap-2.5 border-t border-border pt-4 text-[15px] leading-[1.6]"
    >
      <li
        v-for="topic in course.topics"
        :key="topic"
        class="flex items-start gap-2.5"
      >
        <IconCheck class="mt-[3px] size-[18px] shrink-0 stroke-[2.5] text-accent-700" />
        <span>{{ topic }}</span>
      </li>
    </ul>
  </article>
</template>
