import type { SectionHeading, Stat } from '../types/content'

// Headings and labels are lists of phrases: a line may break only between two phrases
// (see ThaiText in types/content.ts).
export const statsSection = {
  // Read by screen readers only: the design shows the numbers without a visible heading.
  heading: ['ประสบการณ์', 'ที่องค์กรไว้วางใจ'],
} satisfies SectionHeading

export const stats = [
  { value: 120, suffix: '+', label: ['หลักสูตร', 'อบรม'] },
  { value: 85, suffix: '+', label: ['วิทยากร', 'ผู้เชี่ยวชาญ'] },
  { value: 12, label: ['ปีประสบการณ์'] },
] satisfies Stat[]
