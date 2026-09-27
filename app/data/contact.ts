import type { Contact, ContactSection } from '../types/content'

export const contactSection = {
  heading: 'ติดต่อขอใบเสนอราคา',
  intro: 'บอกเราว่าทีมของคุณอยากพัฒนาทักษะด้านไหน ทีมงานจะติดต่อกลับพร้อมใบเสนอราคาภายใน 1 วันทำการ',
  phoneLabel: 'โทร',
  emailLabel: 'อีเมล',
} satisfies ContactSection

// All contact details of the site live in this file only.
// They are placeholders for a fictional brand: the phone number is not a real line and
// `.example` is a reserved domain (RFC 2606). Replace them with the client's own details.
export const contact = {
  phoneDisplay: '02-000-0000',
  phoneHref: 'tel:+6620000000',
  email: 'contact@brightpath.example',
  // TODO(line): Demo brand with no LINE account, so LINE buttons must not link to any LINE ID (D-006).
  // When reusing this template for a client, set `floatingHref` and `contactHref` to the client's own
  // LINE Official Account link and replace `label` and both aria-labels (e.g. 'แชทกับเราทาง LINE').
  // Components already open external (http) links in a new tab.
  line: {
    floatingHref: '#contact',
    contactHref: '#quote-form',
    label: 'LINE (ตัวอย่าง)',
    floatingAriaLabel: 'LINE (ตัวอย่าง): ไปที่ส่วนติดต่อเรา',
    contactAriaLabel: 'LINE (ตัวอย่าง): ไปที่ฟอร์มขอใบเสนอราคา',
  },
} satisfies Contact
