import { describe, expect, it } from 'vitest'
import { contact } from '../../app/data/contact'
import { newTabAttributes } from '../../app/utils/links'

describe('newTabAttributes (D-006)', () => {
  it('opens web links in a new tab', () => {
    expect(newTabAttributes('https://example.com/')).toEqual({ target: '_blank', rel: 'noopener' })
    expect(newTabAttributes('http://example.com/')).toEqual({ target: '_blank', rel: 'noopener' })
  })

  it('opens links to this page, phone numbers and email addresses in place', () => {
    expect(newTabAttributes('#quote-form')).toEqual({})
    expect(newTabAttributes('tel:+6620000000')).toEqual({})
    expect(newTabAttributes('mailto:contact@brightpath.example')).toEqual({})
  })

  it('gives none of the demo contact links a target', () => {
    for (const href of [contact.line.floatingHref, contact.line.contactHref, contact.phoneHref, `mailto:${contact.email}`]) {
      expect(newTabAttributes(href)).toEqual({})
    }
  })
})
