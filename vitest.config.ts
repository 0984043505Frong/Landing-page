import { defineConfig } from 'vitest/config'

// Unit tests cover plain TypeScript (form logic and content data), so they run in
// Node without starting Nuxt. Browser tests live in tests/e2e and run with Playwright.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
})
