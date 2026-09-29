<script setup lang="ts">
import { courses, coursesSection } from '~/data/courses'
</script>

<template>
  <section
    id="courses"
    class="bg-surface-muted py-16 lg:py-24"
    aria-labelledby="courses-heading"
  >
    <div class="page-container">
      <!-- data-reveal (here and on each card): fades in when scrolled to, done by app/motion/page-motion.js (design spec 10.4). -->
      <SectionHeader
        data-reveal
        heading-id="courses-heading"
        :heading="coursesSection.heading"
        :intro="coursesSection.intro"
        class="mb-8 lg:mb-12"
      />
      <!-- One card per course in app/data/courses.ts: 1, 2 or 3 columns (design spec 4.6). -->
      <ul
        role="list"
        class="grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6"
      >
        <li
          v-for="course in courses"
          :key="course.id"
          data-reveal
        >
          <CourseCard :course="course" />
        </li>
      </ul>
    </div>
  </section>
</template>
