import { removeBaseURL } from '~/utils/removeBaseURL'

/**
 * Workaround for a Nuxt bug in the small router it uses when there is no pages/ directory.
 *
 * On `popstate` (Back/Forward, or a click on an in-page link such as #faq) that router calls
 * `router.replace()` with the full path, base URL included, and then adds the base URL again:
 * /Landing-page/#faq becomes /Landing-page/Landing-page/#faq, which does not exist.
 * Here the base URL is removed first, so the address bar keeps the right URL.
 *
 * Fixed upstream in https://github.com/nuxt/nuxt/pull/36034 (not in Nuxt 4.5.2).
 * Remove this plugin after upgrading to a Nuxt release that includes that fix.
 */
export default defineNuxtPlugin(() => {
  const router = useRouter()
  const { baseURL } = useRuntimeConfig().app
  const replace = router.replace

  router.replace = to => replace(typeof to === 'string' ? removeBaseURL(to, baseURL) : to)
})
