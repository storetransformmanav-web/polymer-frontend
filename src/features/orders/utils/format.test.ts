import { describe, expect, it } from 'vitest'
import {
  financialTone,
  fulfillmentTone,
  hasRefund,
  humanize,
  orderLabel,
  orderCustomerName,
  orderEmail,
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
  it('is the customer’s name, then their email, then the email the order was placed with', () => {
    expect(
      orderCustomerName({
        customer: { ...NO_CUSTOMER, full_name: ' Ada Lovelace ', email: 'a@b.co' },
        email: 'order@b.co',
      }),
    ).toBe('Ada Lovelace')
    expect(
      orderCustomerName({
        customer: { ...NO_CUSTOMER, email: 'a@b.co' },
        email: 'order@b.co',
      }),
    ).toBe('a@b.co')
    expect(orderCustomerName({ customer: NO_CUSTOMER, email: 'guest@b.co' })).toBe(
      'guest@b.co',
    )
    expect(orderCustomerName({ customer: null, email: null })).toBe('—')
  })

  it('has an email: the order’s own, else the customer’s', () => {
    expect(
      orderEmail({ customer: { ...NO_CUSTOMER, email: 'c@b.co' }, email: 'o@b.co' }),
    ).toBe('o@b.co')
    expect(
      orderEmail({ customer: { ...NO_CUSTOMER, email: 'c@b.co' }, email: null }),
    ).toBe('c@b.co')
    expect(orderEmail({ customer: NO_CUSTOMER, email: null })).toBe('')
  })
})

describe('orderLabel', () => {
  it('shows the order number without the hashtag', () => {
    expect(orderLabel({ name: '#17516' })).toBe('17516')
    expect(orderLabel({ name: '17516' })).toBe('17516')
    expect(orderLabel({ name: 'D#12' })).toBe('D#12')
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
