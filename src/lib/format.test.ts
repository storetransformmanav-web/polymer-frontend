import { describe, expect, it } from 'vitest'
import { currencySymbol } from './format.ts'

describe('currencySymbol', () => {
  it('is the symbol the currency is written with', () => {
    expect(currencySymbol('GBP')).toBe('£')
    expect(currencySymbol('EUR')).toBe('€')
    expect(currencySymbol('USD')).toBe('$')
  })

  it('is empty when there is no currency', () => {
    expect(currencySymbol(null)).toBe('')
    expect(currencySymbol(undefined)).toBe('')
    expect(currencySymbol('')).toBe('')
  })

  it('falls back to the code when it is not one Intl knows', () => {
    expect(currencySymbol('NOPE!')).toBe('NOPE!')
  })
})
