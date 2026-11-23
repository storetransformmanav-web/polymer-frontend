import { describe, expect, it } from 'vitest'
import { productActivityValueText } from './productActivity.ts'

describe('productActivityValueText', () => {
  it('uses a dash for missing or empty values', () => {
    expect(productActivityValueText(null)).toBe('—')
    expect(productActivityValueText('')).toBe('—')
    expect(productActivityValueText([])).toBe('—')
    expect(productActivityValueText('{}')).toBe('—')
  })

  it('shows JSON strings and arrays as readable plain text', () => {
    expect(productActivityValueText('["test","b2b"]')).toBe('test, b2b')
    expect(productActivityValueText(['test', 'b2b'])).toBe('test, b2b')
    expect(productActivityValueText('{"color":"blue","size":"L"}')).toBe(
      'color: blue · size: L',
    )
  })

  it('keeps scalar values readable', () => {
    expect(productActivityValueText(false)).toBe('False')
    expect(productActivityValueText(12)).toBe('12')
    expect(productActivityValueText(' plain text ')).toBe('plain text')
  })
})
