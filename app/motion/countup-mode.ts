/**
 * How the stats count up (D-049, design spec 10.5). This is the one switch: StatsSection writes it
 * into the generated HTML as `data-countup-mode` on <section id="stats">, and both the CSS
 * (app/assets/css/motion.css) and the page script (app/motion/page-motion.js) read that attribute.
 * Nothing imports this value in the browser, so changing modes is a change of this one line.
 *
 * - 'load' (mode A): numbers on the first screen count from 0 right after the first paint.
 * - 'scroll' (mode B): numbers on the first screen show their final value at once; numbers below
 *   the screen count once half of the stats card is scrolled into view.
 */
export const COUNTUP_MODE: 'load' | 'scroll' = 'load'

/** Longest number the count-up can pad to a fixed width: the CSS has countup-pad-2 to countup-pad-4. */
export const COUNTUP_MAX_DIGITS = 4

/**
 * Inline style of one counting number: the value it counts to, and the counter style that pads
 * the running digits to the final width with FIGURE SPACE (so a new digit, 9 to 10, moves nothing).
 * A one-digit number needs no padding.
 */
export function countUpStyle(value: number): Record<string, string | number> {
  if (!Number.isInteger(value) || value < 0) throw new Error(`count-up needs a whole number of 0 or more, got ${value}`)
  const digits = String(value).length
  if (digits > COUNTUP_MAX_DIGITS) throw new Error(`count-up pads at most ${COUNTUP_MAX_DIGITS} digits, got ${value}`)
  return digits > 1 ? { '--countup-to': value, '--countup-pad': `countup-pad-${digits}` } : { '--countup-to': value }
}
