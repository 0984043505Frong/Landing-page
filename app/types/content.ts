/**
 * Shapes of the page content in app/data/.
 *
 * Every data file ends with `satisfies <Type>`, so a missing or misspelled field
 * fails `npm run typecheck` before it can reach the page.
 */
import type { QuoteErrorCodes, QuoteField } from './quote'

/** A link to a section on the same page, e.g. `#courses`. */
export interface AnchorLink {
  label: string
  href: `#${string}`
}

/** Heading and optional intro text shown at the top of a section. */
export interface SectionHeading {
  heading: string
  intro?: string
}

export interface Site {
  /** Brand name, shown in the header and the footer. */
  name: string
  /** Absolute URL of the live page, ending with '/'. Its path is also the Nuxt base URL. */
  url: string
  title: string
  description: string
  /** File name in public/, resolved against `url` for og:image. */
  ogImage: string
  ogImageAlt: string
  /** Open Graph locale, e.g. 'th_TH'. */
  locale: string
  header: {
    /** Accessible name of the main menu. */
    navLabel: string
    openMenuLabel: string
    closeMenuLabel: string
  }
  nav: AnchorLink[]
  hero: {
    heading: string
    subheading: string
    primaryCta: AnchorLink
    secondaryCta: AnchorLink
  }
  footer: {
    /** Says that the brand and its data are fictional. */
    note: string
  }
}

export interface Stat {
  value: number
  /** Shown right after the value, e.g. '+'. */
  suffix?: string
  label: string
}

export type CourseFormat = 'onsite' | 'online'

export interface Course {
  /** Unique and URL-safe. Also the value of this course in the quote form's course select. */
  id: string
  title: string
  duration: string
  formats: CourseFormat[]
  /** Every course card lists exactly three topics. */
  topics: [string, string, string]
}

export interface CoursesSection extends SectionHeading {
  formatLabels: Record<CourseFormat, string>
}

export interface Step {
  title: string
  description: string
}

export interface Trainer {
  id: string
  /** A made-up name. The page never shows real people. */
  name: string
  role: string
  expertise: string[]
  /**
   * Letters shown in the avatar instead of a photo. Written by hand because a Thai
   * name can start with a leading vowel (e.g. 'เอกชัย'), so its first character
   * is not always its initial.
   */
  initials: string
}

export interface Faq {
  id: string
  question: string
  answer: string
}

export interface ContactSection extends SectionHeading {
  phoneLabel: string
  emailLabel: string
}

export interface Contact {
  phoneDisplay: string
  phoneHref: `tel:${string}`
  email: string
  line: {
    /** Target of the floating LINE button on mobile. */
    floatingHref: string
    /** Target of the LINE button in the contact section. */
    contactHref: string
    label: string
    floatingAriaLabel: string
    contactAriaLabel: string
  }
}

export interface FormFieldText {
  label: string
  placeholder?: string
}

/** A message for every error code of every field, so no error can show up without text. */
export type QuoteErrorMessages = { [Field in QuoteField]: Record<QuoteErrorCodes[Field], string> }

export interface QuoteFormContent {
  /** Explains the marker on required fields. */
  requiredNote: string
  /** Shown next to the label of an optional field. */
  optionalLabel: string
  fields: Record<QuoteField, FormFieldText>
  /** Course select option for visitors who have not picked a course yet. */
  notSureCourseLabel: string
  errors: QuoteErrorMessages
  submitLabel: string
  /** Shown after a successful submit, in place of the form. */
  success: {
    message: string
    note: string
    resetLabel: string
  }
}
