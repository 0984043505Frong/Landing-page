import type { Site } from '../types/content'

// Besides the page, this file is loaded by nuxt.config.ts, playwright.config.ts and
// scripts/stage-preview.mjs (plain Node). Keep it free of runtime imports so that
// all of them can read it as it is.
export const site = {
  name: 'BrightPath Academy',
  // The one place for the site URL: its path ('/Landing-page/') becomes the Nuxt base URL.
  url: 'https://0984043505frong.github.io/Landing-page/',
  title: 'BrightPath Academy — หลักสูตรอบรมองค์กรและบริการจัดหาวิทยากร',
  description:
    'ศูนย์ฝึกอบรมองค์กรและบริการจัดหาวิทยากร หลักสูตร In-house ทั้ง Onsite และ Online ที่ปรับให้ตรงกับทีมของคุณ ขอใบเสนอราคาได้ทันที ทีมงานติดต่อกลับภายใน 1 วันทำการ',
  ogImage: 'og-image.png',
  ogImageAlt: 'BrightPath Academy — หลักสูตรอบรมองค์กรและบริการจัดหาวิทยากร',
  locale: 'th_TH',
  header: {
    navLabel: 'เมนูหลัก',
    menuButtonLabel: 'เมนู',
    skipLinkLabel: 'ข้ามไปที่เนื้อหาหลัก',
  },
  logo: {
    mark: 'BP',
    name: 'BrightPath',
    tagline: 'Academy',
  },
  nav: [
    { label: 'หลักสูตร', href: '#courses' },
    { label: 'จัดหาวิทยากร', href: '#trainer-service' },
    { label: 'วิทยากร', href: '#trainers' },
    { label: 'คำถามที่พบบ่อย', href: '#faq' },
    { label: 'ติดต่อเรา', href: '#contact' },
  ],
  // Lists of phrases: a line may break only between two phrases (see ThaiText in types/content.ts).
  // The hero was measured so that the stats card clears the floating LINE button on a 375×812
  // screen: after changing this text, check that first screen again.
  hero: {
    eyebrow: ['ศูนย์ฝึกอบรมองค์กร · ', 'บริการจัดหาวิทยากร'],
    heading: ['อบรมพนักงานให้', 'ได้ผลจริง ', 'ด้วยหลักสูตร', 'และวิทยากรที่ใช่'],
    subheading: [
      'หลักสูตรอบรมองค์กร',
      'ทั้งแบบ ',
      'Onsite ',
      'และ ',
      'Online ',
      'ปรับเนื้อหา',
      'ตามโจทย์',
      'ของทีมคุณ ',
      'พร้อม',
      'บริการ',
      'จัดหาวิทยากร',
      'เฉพาะทาง',
      'ในที่เดียว',
    ],
    primaryCta: { label: 'ขอใบเสนอราคา', href: '#contact' },
    secondaryCta: { label: 'ดูหลักสูตร', href: '#courses' },
    note: ['ทีมงานติดต่อกลับ', 'ภายใน 1 วันทำการ'],
  },
  footer: {
    about: 'ศูนย์ฝึกอบรมองค์กรและบริการจัดหาวิทยากร สำหรับทีม HR ที่ต้องการผลลัพธ์ที่วัดได้',
    navTitle: 'เมนู',
    contactTitle: 'ติดต่อ',
    copyright: '© 2026 BrightPath Academy',
    // The disclaimer that the footer must show (N11). Joined, the phrases give it back exactly.
    note: ['เว็บไซต์ตัวอย่าง', 'เพื่อแสดงผลงาน · ', 'แบรนด์และข้อมูล', 'เป็นสมมติ'],
  },
} satisfies Site
