import { describe, expect, it } from 'vitest'
import { readFlag } from './env.ts'

describe('readFlag', () => {
  it('reads true and false, in any case and with spaces', () => {
    expect(readFlag('true', false)).toBe(true)
    expect(readFlag('TRUE', false)).toBe(true)
    expect(readFlag(' True ', false)).toBe(true)
    expect(readFlag('false', true)).toBe(false)
    expect(readFlag('False', true)).toBe(false)
  })

  it('uses the default for anything else — unset, empty, or not a true/false word', () => {
    for (const fallback of [true, false]) {
      expect(readFlag(undefined, fallback)).toBe(fallback)
      expect(readFlag('', fallback)).toBe(fallback)
      expect(readFlag('   ', fallback)).toBe(fallback)
      expect(readFlag('yes', fallback)).toBe(fallback)
      expect(readFlag('1', fallback)).toBe(fallback)
    }
  })
})
