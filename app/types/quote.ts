/** Values typed into the "request a quote" form. */
export interface QuoteRequest {
  name: string
  company: string
  phone: string
  /** A course id from app/data/courses.ts, or NOT_SURE_COURSE_ID. */
  course: string
  message: string
}

export type QuoteField = keyof QuoteRequest

/** What can be wrong with a required text field that has a minimum and a maximum length. */
export type TextLengthError = 'required' | 'tooShort' | 'tooLong'

/** What can be wrong with each field. The Thai message for each code is in app/data/quoteForm.ts. */
export interface QuoteErrorCodes {
  name: TextLengthError
  company: TextLengthError
  phone: 'required' | 'invalid'
  course: 'required' | 'invalid'
  message: 'tooLong'
}

/** One error code per invalid field. Valid fields are left out, so `{}` means the form is valid. */
export type QuoteErrors = { [Field in QuoteField]?: QuoteErrorCodes[Field] }
