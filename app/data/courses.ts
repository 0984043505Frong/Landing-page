import type { Course, CoursesSection } from '../types/content'

export const coursesSection = {
  heading: 'หลักสูตรยอดนิยม',
  intro: 'หลักสูตร In-house ที่ปรับเนื้อหาให้เข้ากับองค์กรของคุณได้ เลือกอบรมที่บริษัท (Onsite) หรือออนไลน์ (Online)',
  formatLabels: {
    onsite: 'Onsite',
    online: 'Online',
  },
} satisfies CoursesSection

// Add, edit or remove courses here. The course cards and the quote form's course
// select are both built from this list, so no component needs to change.
export const courses = [
  {
    id: 'leadership-essentials',
    title: 'ภาวะผู้นำสำหรับหัวหน้างานยุคใหม่',
    duration: '1 วัน (6 ชั่วโมง)',
    formats: ['onsite', 'online'],
    topics: [
      'บทบาทและความรับผิดชอบของหัวหน้างาน',
      'การมอบหมายงานและติดตามผล',
      'การให้ feedback เชิงสร้างสรรค์',
    ],
  },
  {
    id: 'effective-communication',
    title: 'การสื่อสารและการนำเสนออย่างมีประสิทธิภาพ',
    duration: '1 วัน (6 ชั่วโมง)',
    formats: ['onsite', 'online'],
    topics: [
      'การฟังเชิงรุกและการตั้งคำถาม',
      'การสื่อสารข้ามแผนกและข้ามรุ่น',
      'การนำเสนองานให้กระชับและน่าสนใจ',
    ],
  },
  {
    id: 'service-excellence',
    title: 'การบริการที่เป็นเลิศ (Service Excellence)',
    duration: '1 วัน (6 ชั่วโมง)',
    formats: ['onsite'],
    topics: [
      'หัวใจของการบริการที่ลูกค้าจดจำ',
      'การรับมือลูกค้าที่ไม่พึงพอใจ',
      'มาตรฐานการบริการที่ทีมทำได้จริง',
    ],
  },
  {
    id: 'excel-data-analysis',
    title: 'Excel สำหรับการวิเคราะห์ข้อมูลในงาน',
    duration: '2 วัน (12 ชั่วโมง)',
    formats: ['onsite', 'online'],
    topics: [
      'สูตรและฟังก์ชันที่ใช้บ่อยในงานจริง',
      'PivotTable และการสรุปข้อมูล',
      'Dashboard สำหรับรายงานผู้บริหาร',
    ],
  },
  {
    id: 'problem-solving',
    title: 'การคิดวิเคราะห์และแก้ปัญหาอย่างเป็นระบบ',
    duration: '1 วัน (6 ชั่วโมง)',
    formats: ['onsite', 'online'],
    topics: [
      'หาสาเหตุที่แท้จริงด้วย 5 Whys และ Fishbone',
      'จัดลำดับความสำคัญของปัญหา',
      'วางแผนแก้ไขและติดตามผล',
    ],
  },
  {
    id: 'generative-ai-at-work',
    title: 'ใช้ Generative AI ช่วยทำงานในองค์กร',
    duration: 'ครึ่งวัน (3 ชั่วโมง)',
    formats: ['online', 'onsite'],
    topics: [
      'เขียน prompt ให้ได้ผลลัพธ์ที่ใช้งานได้จริง',
      'ใช้ AI ช่วยสรุปเอกสารและร่างอีเมล',
      'แนวทางใช้ AI อย่างปลอดภัยต่อข้อมูลองค์กร',
    ],
  },
] satisfies Course[]
