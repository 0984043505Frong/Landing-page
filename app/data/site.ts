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
    openMenuLabel: 'เปิดเมนู',
    closeMenuLabel: 'ปิดเมนู',
  },
  nav: [
    { label: 'เกี่ยวกับเรา', href: '#stats' },
    { label: 'หลักสูตร', href: '#courses' },
    { label: 'จัดหาวิทยากร', href: '#trainer-service' },
    { label: 'วิทยากร', href: '#trainers' },
    { label: 'คำถามที่พบบ่อย', href: '#faq' },
    { label: 'ติดต่อเรา', href: '#contact' },
  ],
  hero: {
    heading: 'หลักสูตรอบรมองค์กรและวิทยากรมืออาชีพ ที่ออกแบบให้ตรงกับทีมของคุณ',
    subheading:
      'BrightPath Academy ช่วยฝ่าย HR วางแผนการอบรมพนักงานครบในที่เดียว ตั้งแต่เลือกหลักสูตร จัดหาวิทยากรที่เหมาะกับงาน จนถึงวันอบรมจริง ทั้งแบบ Onsite และ Online',
    primaryCta: { label: 'ขอใบเสนอราคา', href: '#contact' },
    secondaryCta: { label: 'ดูหลักสูตร', href: '#courses' },
  },
  footer: {
    note: 'เว็บไซต์ตัวอย่างเพื่อแสดงผลงาน · แบรนด์และข้อมูลเป็นสมมติ',
  },
} satisfies Site
