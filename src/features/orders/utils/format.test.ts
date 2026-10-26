import { describe, expect, it } from 'vitest'
import {
  financialTone,
  fulfillmentTone,
  hasRefund,
  humanize,
  orderLabel,
  orderPath,
  orderRef,
  formatAddressLines,
  recordFields,
  orderCustomer,
  sourceLabel,
} from './format.ts'

const NO_CUSTOMER = {
  id: null,
  full_name: null,
  email: null,
  phone: null,
  orders_count: null,
}

describe('humanize', () => {
  it('makes the API’s codes readable', () => {
    expect(humanize('PARTIALLY_REFUNDED')).toBe('Partially refunded')
    expect(humanize('ON_HOLD')).toBe('On hold')
    expect(humanize('PAID')).toBe('Paid')
    expect(humanize(null)).toBe('')
    expect(humanize(undefined)).toBe('')
  })
})

describe('status tones', () => {
  it('colours payment: paid green, pending and part-refunded amber, voided red', () => {
    expect(financialTone('PAID')).toBe('success')
    expect(financialTone('PENDING')).toBe('warning')
    expect(financialTone('PARTIALLY_REFUNDED')).toBe('warning')
    expect(financialTone('VOIDED')).toBe('danger')
    expect(financialTone('AUTHORIZED')).toBe('default')
    expect(financialTone('REFUNDED')).toBe('neutral')
  })

  it('colours fulfillment: fulfilled green, partial amber, on hold red', () => {
    expect(fulfillmentTone('FULFILLED')).toBe('success')
    expect(fulfillmentTone('PARTIALLY_FULFILLED')).toBe('warning')
    expect(fulfillmentTone('ON_HOLD')).toBe('danger')
    expect(fulfillmentTone('UNFULFILLED')).toBe('neutral')
  })

  it('is neutral for a status it does not know, or none', () => {
    expect(financialTone('SOMETHING_NEW')).toBe('neutral')
    expect(fulfillmentTone(null)).toBe('neutral')
    expect(financialTone(undefined)).toBe('neutral')
  })
})

describe('sourceLabel', () => {
  it('names the channels', () => {
    expect(sourceLabel('web')).toBe('Online store')
    expect(sourceLabel('pos')).toBe('Point of sale')
    expect(sourceLabel('shopify')).toBe('Shopify')
    expect(sourceLabel('draft_order')).toBe('Draft order')
    expect(sourceLabel('shopify_draft_order')).toBe('Draft order')
  })

  it('shows an app’s numeric id as "App <id>", and anything else readable', () => {
    expect(sourceLabel('4974139')).toBe('App 4974139')
    expect(sourceLabel('instagram')).toBe('Instagram')
    expect(sourceLabel(null)).toBe('')
  })
})

describe('the order’s customer', () => {
  it('is the customer object’s name and email — no more', () => {
    expect(
      orderCustomer({
        customer: {
          ...NO_CUSTOMER,
          id: 'c1',
          full_name: ' Ada Lovelace ',
          email: ' a@b.co ',
          phone: '+44 20 7946 0000',
          orders_count: 3,
        },
      }),
    ).toEqual({ name: 'Ada Lovelace', email: 'a@b.co' })
  })

  it('is the customer’s email, shown once, when they have no name', () => {
    expect(orderCustomer({ customer: { ...NO_CUSTOMER, email: 'a@b.co' } })).toEqual({
      name: 'a@b.co',
      email: '',
    })
  })

  it('is nobody for a guest checkout (every field null) — the order’s own email is not the customer', () => {
    expect(orderCustomer({ customer: NO_CUSTOMER })).toBeNull()
    expect(orderCustomer({ customer: null })).toBeNull()
    expect(orderCustomer({ customer: undefined })).toBeNull()
    expect(
      orderCustomer({ customer: { ...NO_CUSTOMER, full_name: '  ', email: '' } }),
    ).toBeNull()
  })
})

describe('orderLabel', () => {
  it('is the order number (17516), not the name (#17516)', () => {
    expect(orderLabel({ order_number: 17516, name: '#17516' })).toBe('17516')
    expect(orderLabel({ order_number: 17516, name: 'Other name' })).toBe('17516')
  })

  it('falls back to the name without its hashtag when there is no number', () => {
    expect(orderLabel({ order_number: null, name: '#17516' })).toBe('17516')
    expect(orderLabel({ order_number: undefined, name: '17516' })).toBe('17516')
    expect(orderLabel({ order_number: null, name: 'D#12' })).toBe('D#12')
  })
})

describe('hasRefund', () => {
  it('is true only when something was refunded', () => {
    expect(hasRefund({ total_refunded: '5.00' })).toBe(true)
    expect(hasRefund({ total_refunded: '0.00' })).toBe(false)
    expect(hasRefund({ total_refunded: null })).toBe(false)
    expect(hasRefund({ total_refunded: undefined })).toBe(false)
  })
})

describe('order details helpers', () => {
  it('orderRef / orderPath use the order number and keep the store', () => {
    const shop = { key: 'polymer-uk', name: 'P', domain: 'd', currency: 'GBP' }
    expect(orderRef({ order_number: 17516, id: 'abc' })).toBe('17516')
    expect(orderRef({ order_number: null, id: 'abc' })).toBe('abc')
    expect(orderPath({ order_number: 17516, id: 'abc', shop })).toBe(
      '/orders/17516?shop=polymer-uk',
    )
    expect(orderPath({ order_number: null, id: 'a b', shop: null })).toBe('/orders/a%20b')
  })

  it('formatAddressLines lists only the parts that exist', () => {
    expect(
      formatAddressLines({
        address1: '1 Example Street',
        address2: null,
        city: 'Exampletown',
        zip: 'AB1 2CD',
        country: 'United Kingdom',
      }),
    ).toEqual(['1 Example Street', 'Exampletown AB1 2CD', 'United Kingdom'])
    expect(formatAddressLines(null)).toEqual([])
  })

  it('recordFields shows plain values only, with readable names', () => {
    expect(
      recordFields({
        gift_card: true,
        code: 'ABC',
        n: 2,
        empty: '',
        gone: null,
        nested: { a: 1 },
      }),
    ).toEqual([
      ['Gift card', 'Yes'],
      ['Code', 'ABC'],
      ['N', '2'],
    ])
  })
})
