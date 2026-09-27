/**
 * Shapes of the page content in app/data/.
 *
 * Every data file ends with `satisfies <Type>`, so a missing or misspelled field
 * fails `npm run typecheck` before it can reach the page.
 */
import type { QuoteErrorCodes, QuoteField } from './quote'

/**
 * Thai text whose line breaks are controlled (D-009).
 *
 * - A string: the browser may break the line anywhere its Thai dictionary allows.
 * - A list of phrases: the line may break only between two phrases, never inside one.
 *   The phrases are joined exactly as written, so a space between two phrases goes at
 *   the end of the first one: ['อบรมพนักงานให้', 'ได้ผลจริง ', 'ด้วยหลักสูตร'].
 *
 * Show it with the <PhraseText> component. Where plain text is needed (<title>, meta tags,
 * aria-label, <option>), use joinPhrases() from app/utils/phrases.ts.
 */
export type ThaiText = string | readonly string[]

/** A link to a section on the same page, e.g. `#courses`. */
export interface AnchorLink {
  label: string
  href: `#${string}`
}

/** Heading and optional intro text shown at the top of a section. */
export interface SectionHeading {
  heading: ThaiText
  intro?: ThaiText
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
    /**
     * Name of the mobile menu button. It stays the same whether the menu is open or closed:
     * the button's aria-expanded tells screen readers which one it is (D-010).
     */
    menuButtonLabel: string
    /** Text of the link that jumps over the header to the main content (the page's first link). */
    skipLinkLabel: string
  }
  /** Text of the logo in the header. `name + ' ' + tagline` is the brand name (`name` above). */
  logo: {
    /** Letters inside the square logo mark. */
    mark: string
    /** First line of the logo. */
    name: string
    /** Second line of the logo, shown in capitals. */
    tagline: string
  }
  nav: AnchorLink[]
  hero: {
    /** Small label above the heading. */
    eyebrow: ThaiText
    heading: ThaiText
    subheading: ThaiText
    primaryCta: AnchorLink
    secondaryCta: AnchorLink
    /** Line under the buttons, e.g. how soon the team gets back to the visitor. */
    note: ThaiText
  }
  footer: {
    /** Short description under the logo. */
    about: ThaiText
    /** Title of the footer menu. It also names that menu for screen readers. */
    navTitle: string
    /** Title of the column with the phone number and the email address. */
    contactTitle: string
    copyright: string
    /** Says that the brand and its data are fictional. */
    note: ThaiText
  }
}

export interface Stat {
  value: number
  /** Shown right after the value, e.g. '+'. */
  suffix?: string
  label: ThaiText
}

export type CourseFormat = 'onsite' | 'online'

/**
 * Icon of a course card: the name of a Lucide icon (https://lucide.dev/icons).
 * Only icons that have a component in app/components/CourseIcon.vue are listed here,
 * so a misspelled or missing icon fails `npm run typecheck`. To offer another icon,
 * add its name here and its component to CourseIcon.vue.
 */
export type CourseIconName = 'users' | 'presentation' | 'concierge-bell' | 'chart-column' | 'lightbulb' | 'sparkles'

export interface Course {
  /** Unique and URL-safe. Also the value of this course in the quote form's course select. */
  id: string
  /** Card heading. Also the course's name in the quote form: join the phrases there. */
  title: ThaiText
  icon: CourseIconName
  duration: string
  formats: CourseFormat[]
  /** Every course card lists exactly three topics. */
  topics: [string, string, string]
}

export interface CoursesSection extends SectionHeading {
  formatLabels: Record<CourseFormat, string>
}

export interface Step {
  title: ThaiText
  description: ThaiText
}

export interface Trainer {
  id: string
  /** A made-up name. The page never shows real people. */
  name: ThaiText
  role: ThaiText
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
  question: ThaiText
  answer: ThaiText
}

export interface ContactSection extends SectionHeading {
  /** Short selling points listed under the intro, each with a check mark. */
  highlights: ThaiText[]
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
export type QuoteErrorMessages = { [Field in QuoteField]: Record<QuoteErrorCodes[Field], ThaiText> }

export interface QuoteFormContent {
  /** Heading of the form card. It also names the form for screen readers. */
  title: ThaiText
  /** Explains the marker on required fields. */
  requiredNote: ThaiText
  /** Shown next to the label of an optional field. */
  optionalLabel: string
  fields: Record<QuoteField, FormFieldText>
  /** Course select option for visitors who have not picked a course yet. */
  notSureCourseLabel: string
  errors: QuoteErrorMessages
  submitLabel: string
  /** Shown after a successful submit, in place of the form. */
  success: {
    message: ThaiText
    /** Smaller second line under the message. */
    note: ThaiText
    /** Button that brings back an empty form. */
    resetLabel: string
  }
}
