import { afterEach, describe, expect, it, vi } from 'vitest'
import { submitQuote } from '../../app/utils/submitQuote'

describe('submitQuote', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves without sending anything over the network', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await expect(submitQuote({
      name: 'สมชาย ใจดี',
      company: 'บริษัท ตัวอย่าง จำกัด',
      phone: '0812345678',
      course: 'not-sure',
      message: '',
    })).resolves.toBeUndefined()

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
