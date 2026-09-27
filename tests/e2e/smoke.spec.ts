import { expect, test } from '@playwright/test'

test('the page loads under the base path without failed requests', async ({ page }) => {
  const failedResponses: string[] = []
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
  })

  // './' resolves against baseURL, e.g. http://localhost:4173/Landing-page/
  const response = await page.goto('./')
  expect(response?.status()).toBe(200)

  // A wrong base URL renders a "Redirecting..." page instead of the content.
  await expect(page.locator('h1')).toBeVisible()
  await page.waitForLoadState('networkidle')

  // The browser may not request the favicon on its own, so check its URL directly.
  const faviconHref = await page.locator('link[rel="icon"]').getAttribute('href')
  expect(faviconHref).toBeTruthy()
  const favicon = await page.request.get(new URL(faviconHref!, page.url()).href)
  expect(favicon.status()).toBe(200)

  expect(failedResponses).toEqual([])
})
