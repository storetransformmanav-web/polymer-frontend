import { describe, expect, it } from 'vitest'
import { storefrontProductUrl } from './format.ts'

describe('storefrontProductUrl', () => {
  it('points at the product on the public store, by its handle', () => {
    expect(storefrontProductUrl('h-m-tshirt')).toBe(
      'https://polymeruk.com/products/h-m-tshirt',
    )
  })

  it('trims the handle and keeps it to one path segment', () => {
    expect(storefrontProductUrl('  tee  ')).toBe('https://polymeruk.com/products/tee')
    expect(storefrontProductUrl('a/b?c#d')).toBe(
      'https://polymeruk.com/products/a%2Fb%3Fc%23d',
    )
  })

  it('gives nothing when there is no handle', () => {
    expect(storefrontProductUrl('')).toBeNull()
    expect(storefrontProductUrl('   ')).toBeNull()
    expect(storefrontProductUrl(null)).toBeNull()
    expect(storefrontProductUrl(undefined)).toBeNull()
  })
})
