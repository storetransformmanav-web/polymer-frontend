import { describe, expect, it } from 'vitest'
import { shopifyAdminProductUrl } from './format.ts'

const SHOP = { domain: 'polymer-uk-ltd.myshopify.com' }

describe('shopifyAdminProductUrl', () => {
  it('is the product page in the Shopify admin, as in the example link', () => {
    expect(shopifyAdminProductUrl(SHOP, 15393751269761)).toBe(
      'https://admin.shopify.com/store/polymer-uk-ltd/products/15393751269761',
    )
  })

  it('takes the store name from the *.myshopify.com address, ignoring case and spaces', () => {
    expect(shopifyAdminProductUrl({ domain: ' Polymer-EU.MyShopify.com ' }, 5)).toBe(
      'https://admin.shopify.com/store/polymer-eu/products/5',
    )
  })

  it('gives nothing when the store address is missing or is not a myshopify.com address', () => {
    expect(shopifyAdminProductUrl(null, 5)).toBeNull()
    expect(shopifyAdminProductUrl({}, 5)).toBeNull()
    expect(shopifyAdminProductUrl({ domain: null }, 5)).toBeNull()
    expect(shopifyAdminProductUrl({ domain: 'polymer-uk.com' }, 5)).toBeNull()
    // Nothing that could change where the link goes is let through.
    expect(shopifyAdminProductUrl({ domain: 'evil.com/x.myshopify.com' }, 5)).toBeNull()
    expect(shopifyAdminProductUrl({ domain: 'a.b.myshopify.com' }, 5)).toBeNull()
    expect(shopifyAdminProductUrl({ domain: 'x.myshopify.com.evil.com' }, 5)).toBeNull()
  })

  it('gives nothing for an id that is not a plain positive number', () => {
    expect(shopifyAdminProductUrl(SHOP, 0)).toBeNull()
    expect(shopifyAdminProductUrl(SHOP, -3)).toBeNull()
    expect(shopifyAdminProductUrl(SHOP, 1.5)).toBeNull()
    expect(shopifyAdminProductUrl(SHOP, Number.NaN)).toBeNull()
    expect(shopifyAdminProductUrl(SHOP, null)).toBeNull()
  })
})
