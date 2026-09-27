import type { SectionHeading, Step } from '../types/content'

export const stepsSection = {
  heading: ['บริการ', 'จัดหาวิทยากร'],
  intro: 'หาวิทยากรที่ตรงกับโจทย์ขององค์กรได้ใน 4 ขั้นตอน ทีมงานดูแลตั้งแต่วันแรกจนจบการอบรม',
} satisfies SectionHeading

// Shown in this order. Titles and descriptions are lists of phrases: a line may break
// only between two phrases (see ThaiText in types/content.ts).
export const steps = [
  {
    title: ['แจ้งความต้องการ'],
    description: [
      'บอกเป้าหมาย',
      'ของการอบรม ',
      'กลุ่มผู้เรียน ',
      'จำนวนคน ',
      'และช่วงเวลา',
      'ที่สะดวก ',
      'ผ่านฟอร์ม',
      'หรือโทรหาเรา',
    ],
  },
  {
    title: ['เสนอวิทยากร'],
    description: [
      'ทีมงานคัดเลือก',
      'วิทยากร',
      'ที่ตรงกับโจทย์ ',
      'แล้วส่ง',
      'ประวัติวิทยากร ',
      'โครงหลักสูตร ',
      'และใบเสนอราคา',
      'ให้พิจารณา',
    ],
  },
  {
    title: ['ยืนยัน'],
    description: [
      'เลือกวิทยากร',
      'และยืนยันวันอบรม ',
      'วิทยากรพูดคุย',
      'กับฝ่าย HR ',
      'เพื่อปรับเนื้อหา',
      'ให้เข้ากับ',
      'บริบทขององค์กร',
    ],
  },
  {
    title: ['จัดอบรม'],
    description: [
      'อบรมแบบ ',
      'Onsite ',
      'หรือ ',
      'Online ',
      'ตามที่เลือก ',
      'พร้อมแบบประเมิน',
      'และรายงาน',
      'สรุปผล',
      'หลังการอบรม',
    ],
  },
] satisfies Step[]
