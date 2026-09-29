import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { stats } from '../../app/data/stats'
import { COUNTUP_MAX_DIGITS, COUNTUP_MODE, countUpStyle } from '../../app/motion/countup-mode'

describe('count-up switch (D-049)', () => {
  it('is one of the two modes of the design spec, 10.5', () => {
    expect(['load', 'scroll']).toContain(COUNTUP_MODE)
  })
})

describe('countUpStyle', () => {
  it('gives the value to count to, and pads the running digits to the width of the final value', () => {
    expect(countUpStyle(120)).toEqual({ '--countup-to': 120, '--countup-pad': 'countup-pad-3' })
    expect(countUpStyle(85)).toEqual({ '--countup-to': 85, '--countup-pad': 'countup-pad-2' })
    expect(countUpStyle(1000)).toEqual({ '--countup-to': 1000, '--countup-pad': 'countup-pad-4' })
  })

  it('does not pad a one-digit number', () => {
    expect(countUpStyle(7)).toEqual({ '--countup-to': 7 })
    expect(countUpStyle(0)).toEqual({ '--countup-to': 0 })
  })

  it('refuses a number it cannot show without moving the text', () => {
    expect(() => countUpStyle(12345)).toThrow(/at most 4 digits/)
    expect(() => countUpStyle(-3)).toThrow(/whole number/)
    expect(() => countUpStyle(2.5)).toThrow(/whole number/)
  })

  it('has a counter style in the CSS for every width it pads to', () => {
    const css = readFileSync(new URL('../../app/assets/css/motion.css', import.meta.url), 'utf8')
    for (let digits = 2; digits <= COUNTUP_MAX_DIGITS; digits++) {
      expect(css).toContain(`@counter-style countup-pad-${digits} {`)
    }
  })
})

describe('stats', () => {
  it('every number can count up: a whole number with at most as many digits as the CSS pads', () => {
    expect(stats.length).toBeGreaterThan(0)
    for (const stat of stats) expect(() => countUpStyle(stat.value)).not.toThrow()
  })
})
