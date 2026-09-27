import { expect, test } from '@playwright/test'
import { site } from '../../app/data/site'

test('menu links scroll to their section and keep a valid URL', async ({ page }) => {
  await page.goto('./')
  const pageUrl = page.url()

  // The default viewport (1280px) shows the full menu in the header (D-012).
  const menu = page.getByRole('navigation', { name: site.header.navLabel })

  for (const link of site.nav) {
    // By name: the header's "request a quote" button also links to #contact.
    await menu.getByRole('link', { name: link.label, exact: true }).click()

    await expect(page.locator(link.href)).toBeInViewport()
    // The URL must stay shareable, e.g. /Landing-page/#faq and never
    // /Landing-page/Landing-page/#faq (see app/plugins/router-base-fix.client.ts).
    await expect(page).toHaveURL(pageUrl + link.href)
  }

  await page.goBack()
  await expect(page).toHaveURL(pageUrl + site.nav.at(-2)!.href)
})
