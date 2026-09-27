/** Attributes that make a link open in a new tab. */
export interface NewTabAttributes {
  target?: '_blank'
  rel?: 'noopener'
}

/**
 * Returns the attributes for a contact link: external web links (http:// or https://) open
 * in a new tab, while links to this page (#contact), phone numbers (tel:) and email
 * addresses (mailto:) open in place (D-006).
 *
 * The contact links read their href from app/data/contact.ts. When the template is reused
 * for a client, a real LINE link (https://…) set there opens in a new tab with no change here.
 *
 * Use it with v-bind: <a :href="href" v-bind="newTabAttributes(href)">.
 */
export function newTabAttributes(href: string): NewTabAttributes {
  return /^https?:\/\//i.test(href) ? { target: '_blank', rel: 'noopener' } : {}
}
