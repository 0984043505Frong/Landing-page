<script setup lang="ts">
import { courses, coursesSection } from '~/data/courses'
</script>

<template>
  <section
    id="courses"
    aria-labelledby="courses-heading"
  >
    <h2 id="courses-heading">
      {{ coursesSection.heading }}
    </h2>
    <p>{{ coursesSection.intro }}</p>
    <ul>
      <li
        v-for="course in courses"
        :key="course.id"
      >
        <h3>{{ course.title }}</h3>
        <p>{{ course.duration }}</p>
        <ul>
          <li
            v-for="format in course.formats"
            :key="format"
          >
            {{ coursesSection.formatLabels[format] }}
          </li>
        </ul>
        <ul>
          <li
            v-for="topic in course.topics"
            :key="topic"
          >
            {{ topic }}
          </li>
        </ul>
      </li>
    </ul>
  </section>
</template>
