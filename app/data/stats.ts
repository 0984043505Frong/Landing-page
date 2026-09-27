import type { SectionHeading, Stat } from '../types/content'

export const statsSection = {
  heading: 'ประสบการณ์ที่องค์กรไว้วางใจ',
} satisfies SectionHeading

export const stats = [
  { value: 120, suffix: '+', label: 'หลักสูตรอบรม' },
  { value: 85, suffix: '+', label: 'วิทยากรผู้เชี่ยวชาญ' },
  { value: 12, label: 'ปีประสบการณ์' },
] satisfies Stat[]
