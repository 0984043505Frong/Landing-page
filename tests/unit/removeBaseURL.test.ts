import { describe, expect, it } from 'vitest'
import { removeBaseURL } from '../../app/utils/removeBaseURL'

describe('removeBaseURL', () => {
  const base = '/Landing-page/'

  it.each([
    ['/Landing-page/#faq', '/#faq'],
    ['/Landing-page/', '/'],
    ['/Landing-page', '/'],
    ['/Landing-page#faq', '/#faq'],
    ['/Landing-page?ref=menu', '/?ref=menu'],
  ])('removes the base URL from %j', (path, expected) => {
    expect(removeBaseURL(path, base)).toBe(expected)
  })

  it.each([
    '/',
    '/#faq',
    '/Landing-pages/',
  ])('keeps %j, which is not under the base URL', (path) => {
    expect(removeBaseURL(path, base)).toBe(path)
  })

  it('changes nothing when the site is served from the domain root', () => {
    expect(removeBaseURL('/Landing-page/#faq', '/')).toBe('/Landing-page/#faq')
  })
})
