import { describe, expect, it } from 'vitest'
import { safeUrl } from './safeUrl.ts'

describe('safeUrl', () => {
  it('keeps http and https addresses', () => {
    expect(safeUrl('https://cdn.shopify.com/a.jpg?v=1')).toBe(
      'https://cdn.shopify.com/a.jpg?v=1',
    )
    expect(safeUrl('http://example.com')).toBe('http://example.com/')
  })

  it('drops anything else', () => {
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,hi',
      'not a url',
      '',
      null,
      undefined,
    ]) {
      expect(safeUrl(bad)).toBeNull()
    }
  })
})
