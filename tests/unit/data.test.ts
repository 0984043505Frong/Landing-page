import { describe, expect, it } from 'vitest'
import { contact, contactSection } from '../../app/data/contact'
import { courses, coursesSection } from '../../app/data/courses'
import { faqSection, faqs } from '../../app/data/faqs'
import { quoteForm } from '../../app/data/quoteForm'
import { site } from '../../app/data/site'
import { stats, statsSection } from '../../app/data/stats'
import { steps, stepsSection } from '../../app/data/steps'
import { trainers, trainersSection } from '../../app/data/trainers'
import type { ThaiText } from '../../app/types/content'
import { joinPhrases } from '../../app/utils/phrases'

function unique<T>(values: T[]) {
  return new Set(values).size === values.length
}

describe('site', () => {
  it('is served from /Landing-page/ on GitHub Pages', () => {
    expect(site.url).toBe('https://0984043505frong.github.io/Landing-page/')
    expect(new URL(site.url).pathname).toBe('/Landing-page/')
  })

  it('resolves og:image to an absolute URL under the site URL', () => {
    expect(new URL(site.ogImage, site.url).href).toBe('https://0984043505frong.github.io/Landing-page/og-image.png')
  })

  it('links the menu to sections on the page, each once', () => {
    expect(site.nav.length).toBeGreaterThan(0)
    for (const link of site.nav) expect(link.href).toMatch(/^#[a-z][a-z-]*$/)
    expect(unique(site.nav.map(link => link.href))).toBe(true)
  })

  it('has the 5 menu items of the chosen design, without the stats section (D-014)', () => {
    expect(site.nav.map(link => link.href)).toEqual(['#courses', '#trainer-service', '#trainers', '#faq', '#contact'])
  })

  it('writes the logo so that its two lines read as the brand name', () => {
    expect(`${site.logo.name} ${site.logo.tagline}`).toBe(site.name)
  })

  it('gives the menu button one name for both states (D-010)', () => {
    expect(site.header.menuButtonLabel).toBe('เมนู')
  })

  // The stats card must clear the floating LINE button on the first 375×812 screen, and the
  // hero was measured with this text (D-013). After changing it, measure that screen again.
  it('keeps the hero text that the first mobile screen was measured with (D-013)', () => {
    expect(joinPhrases(site.hero.eyebrow)).toBe('ศูนย์ฝึกอบรมองค์กร · บริการจัดหาวิทยากร')
    expect(joinPhrases(site.hero.heading)).toBe('อบรมพนักงานให้ได้ผลจริง ด้วยหลักสูตรและวิทยากรที่ใช่')
    expect(joinPhrases(site.hero.subheading)).toBe(
      'หลักสูตรอบรมองค์กรทั้งแบบ Onsite และ Online ปรับเนื้อหาตามโจทย์ของทีมคุณ พร้อมบริการจัดหาวิทยากรเฉพาะทางในที่เดียว',
    )
    expect(joinPhrases(site.hero.note)).toBe('ทีมงานติดต่อกลับภายใน 1 วันทำการ')
  })

  it('shows the exact disclaimer in the footer (N11)', () => {
    expect(joinPhrases(site.footer.note)).toBe('เว็บไซต์ตัวอย่างเพื่อแสดงผลงาน · แบรนด์และข้อมูลเป็นสมมติ')
  })
})

// How many courses, trainers and questions there are is content: the page shows as many as
// app/data/ lists, so these tests check the rules every item must follow, not a count (D-017).
// The stats card and the trainer service steps are laid out for a fixed number of items.

describe('stats', () => {
  it('has 3 numbers, the columns of the stats card', () => {
    expect(stats).toHaveLength(3)
  })
})

describe('courses (N10)', () => {
  it('has at least one course', () => {
    expect(courses.length).toBeGreaterThan(0)
  })

  it('gives every course a title, a duration, at least one format and exactly 3 topics', () => {
    for (const course of courses) {
      expect(joinPhrases(course.title).trim()).not.toBe('')
      expect(course.duration.trim()).not.toBe('')
      expect(course.formats.length).toBeGreaterThan(0)
      expect(unique(course.formats)).toBe(true)
      expect(course.topics).toHaveLength(3)
      for (const topic of course.topics) expect(topic.trim()).not.toBe('')
    }
  })

  it('uses unique, URL-safe ids that cannot clash with the "not sure" option', () => {
    const ids = courses.map(course => course.id)
    expect(unique(ids)).toBe(true)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    expect(ids).not.toContain('not-sure')
  })
})

describe('steps', () => {
  // 4 steps: one row of 4 from 1024px, 2 × 2 at 768px (design spec 4.7).
  it('lists the 4 steps of the trainer service in order', () => {
    expect(steps.map(step => joinPhrases(step.title))).toEqual(['แจ้งความต้องการ', 'เสนอวิทยากร', 'ยืนยัน', 'จัดอบรม'])
  })
})

describe('trainers (N12)', () => {
  it('has at least one trainer, each with a unique id', () => {
    expect(trainers.length).toBeGreaterThan(0)
    expect(unique(trainers.map(trainer => trainer.id))).toBe(true)
  })

  it('gives every trainer initials of 1–3 characters for the avatar', () => {
    for (const trainer of trainers) expect(trainer.initials).toMatch(/^\S{1,3}$/u)
  })
})

describe('faqs', () => {
  it('has at least one question, each with a unique id', () => {
    expect(faqs.length).toBeGreaterThan(0)
    expect(unique(faqs.map(faq => faq.id))).toBe(true)
  })
})

describe('contact (N16)', () => {
  it('uses an email address on the reserved .example domain', () => {
    expect(contact.email).toMatch(/^[^@\s]+@[^@\s]+\.example$/)
  })

  it('dials the same number that it shows', () => {
    const localDigits = contact.phoneDisplay.replace(/\D/g, '')
    expect(contact.phoneHref).toBe(`tel:+66${localDigits.slice(1)}`)
  })

  it('keeps the LINE buttons on this page instead of linking to a LINE ID (D-006)', () => {
    expect(contact.line).toEqual({
      floatingHref: '#contact',
      contactHref: '#quote-form',
      label: 'LINE (ตัวอย่าง)',
      floatingAriaLabel: 'LINE (ตัวอย่าง): ไปที่ส่วนติดต่อเรา',
      contactAriaLabel: 'LINE (ตัวอย่าง): ไปที่ฟอร์มขอใบเสนอราคา',
    })
  })
})

// Text whose line breaks are controlled, stored as lists of phrases (D-009, design spec 5.2).
const phraseLists: [string, ThaiText][] = [
  ['site.hero.eyebrow', site.hero.eyebrow],
  ['site.hero.heading', site.hero.heading],
  ['site.hero.subheading', site.hero.subheading],
  ['site.hero.note', site.hero.note],
  ['statsSection.heading', statsSection.heading],
  ...stats.map((stat, index): [string, ThaiText] => [`stats[${index}].label`, stat.label]),
  ['coursesSection.heading', coursesSection.heading],
  ...courses.map((course): [string, ThaiText] => [`courses[${course.id}].title`, course.title]),
  ['stepsSection.heading', stepsSection.heading],
  ...steps.flatMap((step, index): [string, ThaiText][] => [
    [`steps[${index}].title`, step.title],
    [`steps[${index}].description`, step.description],
  ]),
  ['trainersSection.heading', trainersSection.heading],
  ...trainers.flatMap((trainer): [string, ThaiText][] => [
    [`trainers[${trainer.id}].name`, trainer.name],
    [`trainers[${trainer.id}].role`, trainer.role],
  ]),
  ['faqSection.heading', faqSection.heading],
  ...faqs.flatMap((faq): [string, ThaiText][] => [
    [`faqs[${faq.id}].question`, faq.question],
    [`faqs[${faq.id}].answer`, faq.answer],
  ]),
  ['contactSection.heading', contactSection.heading],
  ['contactSection.intro', contactSection.intro],
  ...contactSection.highlights.map((highlight, index): [string, ThaiText] => [`contactSection.highlights[${index}]`, highlight]),
  ['quoteForm.title', quoteForm.title],
  ['quoteForm.errors.phone.invalid', quoteForm.errors.phone.invalid],
  ['quoteForm.success.message', quoteForm.success.message],
  ['quoteForm.success.note', quoteForm.success.note],
  ['site.footer.note', site.footer.note],
]

describe('phrase lists (D-009)', () => {
  it.each(phraseLists)('%s is a list of phrases with each space at the end of a phrase', (_field, text) => {
    expect(Array.isArray(text)).toBe(true)
    const phrases = text as readonly string[]
    expect(phrases.length).toBeGreaterThan(0)
    for (const phrase of phrases) {
      expect(phrase.trim()).not.toBe('')
      // A space between two phrases belongs at the end of the first one, and only one.
      expect(phrase).not.toMatch(/^\s/)
      expect(phrase).not.toMatch(/\s\s$/)
    }
    expect(phrases.at(-1)).not.toMatch(/\s$/)
  })
})

describe('quote form text', () => {
  it('has a message for every validation error', () => {
    for (const messages of Object.values(quoteForm.errors)) {
      for (const message of Object.values<ThaiText>(messages)) expect(joinPhrases(message).trim()).not.toBe('')
    }
  })

  it('shows the exact thank-you text after submitting (N13)', () => {
    expect(joinPhrases(quoteForm.success.message)).toBe('ขอบคุณที่สนใจ BrightPath Academy ทีมงานจะติดต่อกลับภายใน 1 วันทำการ')
    expect(joinPhrases(quoteForm.success.note)).toBe('(เว็บไซต์ตัวอย่าง — ข้อมูลในฟอร์มไม่ได้ถูกส่งจริง)')
  })
})
