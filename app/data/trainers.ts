import type { SectionHeading, Trainer } from '../types/content'

export const trainersSection = {
  heading: ['ทีมวิทยากร'],
  intro: 'วิทยากรมืออาชีพที่มีประสบการณ์ตรงในองค์กร พร้อมปรับเนื้อหาให้เข้ากับทีมของคุณ',
} satisfies SectionHeading

// Made-up people: the names are fictional and the avatars show initials, not photos.
// Names and roles are lists of phrases: a line may break only between two phrases
// (see ThaiText in types/content.ts).
export const trainers = [
  {
    id: 'ekachai',
    name: ['เอกชัย ', 'รุ่งเรืองศิริ'],
    role: ['วิทยากรด้าน', 'ภาวะผู้นำ', 'และการบริหารทีม'],
    expertise: ['ภาวะผู้นำ', 'การโค้ชทีม', 'การบริหารผลงาน'],
    initials: 'อร',
  },
  {
    id: 'natthida',
    name: ['ณัฐธิดา ', 'แสงอรุณวัฒน์'],
    role: ['วิทยากรด้าน', 'การสื่อสาร', 'และการนำเสนอ'],
    expertise: ['การสื่อสารในองค์กร', 'การนำเสนอ', 'บุคลิกภาพ'],
    initials: 'ณส',
  },
  {
    id: 'pongsakorn',
    name: ['พงศกร ', 'ศิริธรรมวงศ์'],
    role: ['วิทยากรด้าน', 'ข้อมูล', 'และทักษะดิจิทัล'],
    expertise: ['Excel', 'การวิเคราะห์ข้อมูล', 'Generative AI'],
    initials: 'พศ',
  },
  {
    id: 'orawan',
    name: ['อรวรรณ ', 'ทองประเสริฐสุข'],
    role: ['วิทยากรด้าน', 'งานบริการ', 'และประสบการณ์ลูกค้า'],
    expertise: ['Service Excellence', 'การรับมือข้อร้องเรียน', 'Customer Experience'],
    initials: 'อท',
  },
] satisfies Trainer[]
