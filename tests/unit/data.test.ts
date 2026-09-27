import { describe, expect, it } from 'vitest'
import { contact } from '../../app/data/contact'
import { courses } from '../../app/data/courses'
import { faqs } from '../../app/data/faqs'
import { quoteForm } from '../../app/data/quoteForm'
import { site } from '../../app/data/site'
import { stats } from '../../app/data/stats'
import { steps } from '../../app/data/steps'
import { trainers } from '../../app/data/trainers'

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

  it('shows the exact disclaimer in the footer (N11)', () => {
    expect(site.footer.note).toBe('เว็บไซต์ตัวอย่างเพื่อแสดงผลงาน · แบรนด์และข้อมูลเป็นสมมติ')
  })
})

describe('stats', () => {
  it('has 3 numbers', () => {
    expect(stats).toHaveLength(3)
  })
})

describe('courses (N10)', () => {
  it('has 6 courses', () => {
    expect(courses).toHaveLength(6)
  })

  it('gives every course a title, a duration, at least one format and exactly 3 topics', () => {
    for (const course of courses) {
      expect(course.title.trim()).not.toBe('')
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
  it('lists the 4 steps of the trainer service in order', () => {
    expect(steps.map(step => step.title)).toEqual(['แจ้งความต้องการ', 'เสนอวิทยากร', 'ยืนยัน', 'จัดอบรม'])
  })
})

describe('trainers (N12)', () => {
  it('has 4 trainers with unique ids', () => {
    expect(trainers).toHaveLength(4)
    expect(unique(trainers.map(trainer => trainer.id))).toBe(true)
  })

  it('gives every trainer initials of 1–3 characters for the avatar', () => {
    for (const trainer of trainers) expect(trainer.initials).toMatch(/^\S{1,3}$/u)
  })
})

describe('faqs', () => {
  it('has 5 questions with unique ids', () => {
    expect(faqs).toHaveLength(5)
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

describe('quote form text', () => {
  it('has a message for every validation error', () => {
    for (const messages of Object.values(quoteForm.errors)) {
      for (const message of Object.values(messages)) expect(message.trim()).not.toBe('')
    }
  })

  it('shows the exact thank-you text after submitting (N13)', () => {
    expect(quoteForm.success.message).toBe('ขอบคุณที่สนใจ BrightPath Academy ทีมงานจะติดต่อกลับภายใน 1 วันทำการ')
    expect(quoteForm.success.note).toBe('(เว็บไซต์ตัวอย่าง — ข้อมูลในฟอร์มไม่ได้ถูกส่งจริง)')
  })
})
