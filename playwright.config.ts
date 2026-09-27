import { defineConfig, devices } from '@playwright/test'
import { site } from './app/data/site'

// `npm run preview` serves the generated site on this port under the same sub-path as
// GitHub Pages, e.g. http://localhost:4173/Landing-page/
const PREVIEW_PORT = 4173
const previewUrl = new URL(new URL(site.url).pathname, `http://localhost:${PREVIEW_PORT}`).href

const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? 'github' : 'list',
  use: {
    // Tests open pages with relative URLs such as './', which resolve under the sub-path.
    baseURL: previewUrl,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Tests run against the generated static site: run `npm run generate` first.
  webServer: {
    command: 'npm run preview',
    url: previewUrl,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
})
