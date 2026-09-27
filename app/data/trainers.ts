import type { SectionHeading, Trainer } from '../types/content'

export const trainersSection = {
  heading: 'ทีมวิทยากร',
  intro: 'วิทยากรมืออาชีพที่มีประสบการณ์ตรงในองค์กร พร้อมปรับเนื้อหาให้เข้ากับทีมของคุณ',
} satisfies SectionHeading

// Made-up people: the names are fictional and the avatars show initials, not photos.
export const trainers = [
  {
    id: 'ekachai',
    name: 'เอกชัย รุ่งเรืองศิริ',
    role: 'วิทยากรด้านภาวะผู้นำและการบริหารทีม',
    expertise: ['ภาวะผู้นำ', 'การโค้ชทีม', 'การบริหารผลงาน'],
    initials: 'อร',
  },
  {
    id: 'natthida',
    name: 'ณัฐธิดา แสงอรุณวัฒน์',
    role: 'วิทยากรด้านการสื่อสารและการนำเสนอ',
    expertise: ['การสื่อสารในองค์กร', 'การนำเสนอ', 'บุคลิกภาพ'],
    initials: 'ณส',
  },
  {
    id: 'pongsakorn',
    name: 'พงศกร ศิริธรรมวงศ์',
    role: 'วิทยากรด้านข้อมูลและทักษะดิจิทัล',
    expertise: ['Excel', 'การวิเคราะห์ข้อมูล', 'Generative AI'],
    initials: 'พศ',
  },
  {
    id: 'orawan',
    name: 'อรวรรณ ทองประเสริฐสุข',
    role: 'วิทยากรด้านงานบริการและประสบการณ์ลูกค้า',
    expertise: ['Service Excellence', 'การรับมือข้อร้องเรียน', 'Customer Experience'],
    initials: 'อท',
  },
] satisfies Trainer[]
