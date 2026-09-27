import { describe, expect, it } from 'vitest'
import { courses } from '../../app/data/courses'
import type { QuoteRequest } from '../../app/types/quote'
import { NOT_SURE_COURSE_ID, validateQuote } from '../../app/utils/validateQuote'

const validRequest: QuoteRequest = {
  name: 'สมชาย ใจดี',
  company: 'บริษัท ตัวอย่าง จำกัด',
  phone: '081-234-5678',
  course: courses[0]!.id,
  message: '',
}

function validateWith(changes: Partial<QuoteRequest>) {
  return validateQuote({ ...validRequest, ...changes })
}

describe('validateQuote', () => {
  it('accepts a complete request', () => {
    expect(validateQuote(validRequest)).toEqual({})
  })

  it('reports every invalid field at once', () => {
    const empty: QuoteRequest = { name: '', company: '', phone: '', course: '', message: '' }

    expect(validateQuote(empty)).toEqual({
      name: 'required',
      company: 'required',
      phone: 'required',
      course: 'required',
    })
  })

  describe('name: required, 2–100 characters after trimming', () => {
    it.each(['', '   '])('requires a name (%j)', (name) => {
      expect(validateWith({ name })).toEqual({ name: 'required' })
    })

    it('rejects 1 character', () => {
      expect(validateWith({ name: 'ก' })).toEqual({ name: 'tooShort' })
    })

    it('accepts 2 characters', () => {
      expect(validateWith({ name: 'กข' })).toEqual({})
    })

    it('accepts 100 characters', () => {
      expect(validateWith({ name: 'ก'.repeat(100) })).toEqual({})
    })

    it('rejects 101 characters', () => {
      expect(validateWith({ name: 'ก'.repeat(101) })).toEqual({ name: 'tooLong' })
    })

    it('does not count surrounding spaces', () => {
      expect(validateWith({ name: '  ก  ' })).toEqual({ name: 'tooShort' })
      expect(validateWith({ name: ` ${'ก'.repeat(100)} ` })).toEqual({})
    })
  })

  describe('company: required, 2–150 characters after trimming', () => {
    it.each(['', '   '])('requires a company (%j)', (company) => {
      expect(validateWith({ company })).toEqual({ company: 'required' })
    })

    it('rejects 1 character', () => {
      expect(validateWith({ company: 'A' })).toEqual({ company: 'tooShort' })
    })

    it('accepts 2 characters', () => {
      expect(validateWith({ company: 'AB' })).toEqual({})
    })

    it('accepts 150 characters', () => {
      expect(validateWith({ company: 'ก'.repeat(150) })).toEqual({})
    })

    it('rejects 151 characters', () => {
      expect(validateWith({ company: 'ก'.repeat(151) })).toEqual({ company: 'tooLong' })
    })

    it('does not count surrounding spaces', () => {
      expect(validateWith({ company: '  A  ' })).toEqual({ company: 'tooShort' })
      expect(validateWith({ company: ` ${'ก'.repeat(150)} ` })).toEqual({})
    })
  })

  describe('phone: required, a Thai number once spaces and hyphens are removed', () => {
    it.each([
      ['a 10-digit mobile number', '0812345678'],
      ['a 9-digit landline number', '021234567'],
      ['hyphens', '081-234-5678'],
      ['spaces', '02 123 4567'],
      ['surrounding spaces', ' 081 234 5678 '],
      ['+66 and 9 digits', '+66812345678'],
      ['+66 and 8 digits', '+6621234567'],
      ['+66 with spaces and hyphens', '+66 81-234-5678'],
    ])('accepts %s (%j)', (_case, phone) => {
      expect(validateWith({ phone })).toEqual({})
    })

    it.each(['', '   ', ' - - '])('requires a number (%j)', (phone) => {
      expect(validateWith({ phone })).toEqual({ phone: 'required' })
    })

    it.each([
      ['too few digits', '12345'],
      ['no leading 0', '812345678'],
      ['0 and only 7 digits', '08123456'],
      ['0 and 10 digits', '08123456789'],
      ['+66 and only 7 digits', '+661234567'],
      ['+66 and 10 digits', '+660812345678'],
      ['66 without +', '66812345678'],
      ['brackets, which are not removed', '(02) 123-4567'],
      ['dots, which are not removed', '081.234.5678'],
      ['a letter', '08l-234-5678'],
    ])('rejects %s (%j)', (_case, phone) => {
      expect(validateWith({ phone })).toEqual({ phone: 'invalid' })
    })
  })

  describe('course: required, a course id or "not sure"', () => {
    it.each(courses.map(course => course.id))('accepts the course id %j', (course) => {
      expect(validateWith({ course })).toEqual({})
    })

    it('accepts "not sure"', () => {
      expect(NOT_SURE_COURSE_ID).toBe('not-sure')
      expect(validateWith({ course: NOT_SURE_COURSE_ID })).toEqual({})
    })

    it('requires a choice', () => {
      expect(validateWith({ course: '' })).toEqual({ course: 'required' })
    })

    it('rejects an id that is not in the course list', () => {
      expect(validateWith({ course: 'unknown-course' })).toEqual({ course: 'invalid' })
    })
  })

  describe('message: optional, at most 1000 characters', () => {
    it('accepts an empty message', () => {
      expect(validateWith({ message: '' })).toEqual({})
    })

    it('accepts 1000 characters', () => {
      expect(validateWith({ message: 'ก'.repeat(1000) })).toEqual({})
    })

    it('rejects 1001 characters', () => {
      expect(validateWith({ message: 'ก'.repeat(1001) })).toEqual({ message: 'tooLong' })
    })

    it('does not count surrounding spaces', () => {
      expect(validateWith({ message: ` ${'ก'.repeat(1000)} ` })).toEqual({})
    })
  })
})
