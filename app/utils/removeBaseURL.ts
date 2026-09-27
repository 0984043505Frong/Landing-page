/**
 * Removes the app base URL from the start of a path:
 * removeBaseURL('/Landing-page/#faq', '/Landing-page/') returns '/#faq'.
 * Paths outside the base URL are returned unchanged.
 */
export function removeBaseURL(path: string, baseURL: string): string {
  const base = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
  if (base === '' || !path.startsWith(base)) return path

  const rest = path.slice(base.length)
  if (rest === '') return '/'
  if (rest.startsWith('/')) return rest
  if (rest.startsWith('?') || rest.startsWith('#')) return `/${rest}`
  // e.g. '/Landing-pages/' is a different path, not one under '/Landing-page/'.
  return path
}
