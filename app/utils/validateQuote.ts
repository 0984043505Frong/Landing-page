import { courses } from '../data/courses'
import type { QuoteErrorCodes, QuoteErrors, QuoteRequest, TextLengthError } from '../types/quote'

/** Course select value for "not sure yet, please advise". */
export const NOT_SURE_COURSE_ID = 'not-sure'

const NAME_LENGTH = { min: 2, max: 100 }
const COMPANY_LENGTH = { min: 2, max: 150 }
const MESSAGE_MAX_LENGTH = 1000

// Thai phone numbers once spaces and hyphens are removed: 0 followed by 8 or 9 digits
// (landline or mobile), or +66 followed by 8 or 9 digits.
const THAI_PHONE_PATTERNS = [/^0\d{8,9}$/, /^\+66\d{8,9}$/]

const allowedCourseIds = new Set<string>([...courses.map(course => course.id), NOT_SURE_COURSE_ID])

/**
 * Checks the quote form and returns one error code per invalid field.
 * An empty object means the form is valid.
 *
 * Pure function: it needs no DOM and no Nuxt, so it is unit-tested on its own.
 * Lengths are counted after trimming, in UTF-16 code units (as the browser's `maxlength` does).
 */
export function validateQuote(request: QuoteRequest): QuoteErrors {
  const errors: QuoteErrors = {}

  const nameError = checkLength(request.name, NAME_LENGTH)
  if (nameError) errors.name = nameError

  const companyError = checkLength(request.company, COMPANY_LENGTH)
  if (companyError) errors.company = companyError

  const phoneError = checkPhone(request.phone)
  if (phoneError) errors.phone = phoneError

  const courseError = checkCourse(request.course)
  if (courseError) errors.course = courseError

  if (request.message.trim().length > MESSAGE_MAX_LENGTH) errors.message = 'tooLong'

  return errors
}

function checkLength(value: string, limits: { min: number, max: number }): TextLengthError | undefined {
  const length = value.trim().length
  if (length === 0) return 'required'
  if (length < limits.min) return 'tooShort'
  if (length > limits.max) return 'tooLong'
  return undefined
}

function checkPhone(value: string): QuoteErrorCodes['phone'] | undefined {
  const phoneNumber = value.replace(/[\s-]/g, '')
  if (phoneNumber === '') return 'required'
  if (!THAI_PHONE_PATTERNS.some(pattern => pattern.test(phoneNumber))) return 'invalid'
  return undefined
}

function checkCourse(value: string): QuoteErrorCodes['course'] | undefined {
  if (value === '') return 'required'
  if (!allowedCourseIds.has(value)) return 'invalid'
  return undefined
}
