import type { QuoteFormContent } from '../types/content'

// Text of the "request a quote" form. The validation rules are in app/utils/validateQuote.ts.
export const quoteForm = {
  requiredNote: 'ช่องที่มีเครื่องหมาย * จำเป็นต้องกรอก',
  optionalLabel: 'ไม่บังคับ',
  fields: {
    name: { label: 'ชื่อ-นามสกุล' },
    company: { label: 'บริษัท / องค์กร' },
    phone: { label: 'เบอร์โทร' },
    course: { label: 'หลักสูตรที่สนใจ', placeholder: 'เลือกหลักสูตร' },
    message: {
      label: 'ข้อความ',
      placeholder: 'เช่น จำนวนผู้เข้าอบรม ช่วงเวลาที่สะดวก หรือหัวข้อที่อยากเพิ่ม',
    },
  },
  notSureCourseLabel: 'ยังไม่แน่ใจ — ขอคำแนะนำ',
  errors: {
    name: {
      required: 'กรุณากรอกชื่อ-นามสกุล',
      tooShort: 'ชื่อ-นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร',
      tooLong: 'ชื่อ-นามสกุลต้องไม่เกิน 100 ตัวอักษร',
    },
    company: {
      required: 'กรุณากรอกชื่อบริษัทหรือองค์กร',
      tooShort: 'ชื่อบริษัทหรือองค์กรต้องมีอย่างน้อย 2 ตัวอักษร',
      tooLong: 'ชื่อบริษัทหรือองค์กรต้องไม่เกิน 150 ตัวอักษร',
    },
    phone: {
      required: 'กรุณากรอกเบอร์โทร',
      invalid: 'กรุณากรอกเบอร์โทรให้ถูกต้อง เช่น 08x-xxx-xxxx หรือ 02-xxx-xxxx',
    },
    course: {
      required: 'กรุณาเลือกหลักสูตรที่สนใจ',
      invalid: 'กรุณาเลือกหลักสูตรจากรายการ',
    },
    message: {
      tooLong: 'ข้อความต้องไม่เกิน 1,000 ตัวอักษร',
    },
  },
  submitLabel: 'ส่งคำขอใบเสนอราคา',
  success: {
    message: 'ขอบคุณที่สนใจ BrightPath Academy ทีมงานจะติดต่อกลับภายใน 1 วันทำการ',
    note: '(เว็บไซต์ตัวอย่าง — ข้อมูลในฟอร์มไม่ได้ถูกส่งจริง)',
    resetLabel: 'ส่งคำขออีกครั้ง',
  },
} satisfies QuoteFormContent
