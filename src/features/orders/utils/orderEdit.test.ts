import { describe, expect, it } from 'vitest'
import type { OrderDetail } from '../../../lib/api/endpoints.ts'
import {
  buildOrderUpdateBody,
  draftFromOrder,
  EDIT_FIELD,
  validateOrderEdit,
} from './orderEdit.ts'

const ORDER = {
  email: 'old@example.com',
  shipping_address: {
    first_name: 'Sam',
    last_name: 'Taylor',
    address1: '1 High Street',
    city: 'London',
    zip: 'NW10 7RX',
    country_code: 'GB',
  },
  shipping_lines: [{ title: 'Standard delivery', price: '4.95' }],
  line_items: [
    { id: 'line-1', title: 'Pizza Box', quantity: 2, current_quantity: 2 },
    { id: 'line-gone', title: 'Bag', quantity: 1, current_quantity: 0 },
  ],
} as unknown as OrderDetail

describe('the Edit order page’s draft', () => {
  const initial = draftFromOrder(ORDER)

  it('sends nothing when nothing changed, and does not offer a line already removed', () => {
    expect(buildOrderUpdateBody(initial, initial)).toEqual({})
    expect(Object.keys(initial.quantities)).toEqual(['line-1'])
    expect(validateOrderEdit(initial, initial)).toEqual({})
  })

  it('treats the same price written another way as no change', () => {
    const draft = { ...initial, shippingPrice: '4.950' }
    expect(buildOrderUpdateBody(draft, initial)).toEqual({})
  })

  it('sends only what changed', () => {
    const draft = {
      ...initial,
      email: 'buyer@example.com',
      quantities: { 'line-1': '3' },
      staffNote: ' One more box ',
    }
    expect(buildOrderUpdateBody(draft, initial)).toEqual({
      email: 'buyer@example.com',
      line_items_update: [{ line_item_id: 'line-1', quantity: 3 }],
      staff_note: 'One more box',
    })
  })

  it('sends the whole address when any of it changed, and a delivery with its price', () => {
    const draft = {
      ...initial,
      address: { ...initial.address, address1: '2 High Street' },
      shippingTitle: 'Next day',
      shippingPrice: '7',
    }
    expect(buildOrderUpdateBody(draft, initial)).toEqual({
      shipping_address: {
        first_name: 'Sam',
        last_name: 'Taylor',
        address1: '2 High Street',
        city: 'London',
        zip: 'NW10 7RX',
        country_code: 'GB',
      },
      shipping: { title: 'Next day', price: '7.00' },
    })
  })

  it('checks only what changed, against the API’s limits', () => {
    const errors = validateOrderEdit(
      {
        ...initial,
        email: 'nope',
        quantities: { 'line-1': '0' },
        address: { ...initial.address, city: '' },
        shippingTitle: '',
      },
      initial,
    )
    expect(Object.keys(errors).sort()).toEqual(
      [
        EDIT_FIELD.email,
        EDIT_FIELD.quantity('line-1'),
        EDIT_FIELD.city,
        EDIT_FIELD.shippingTitle,
      ].sort(),
    )
  })

  it('does not let an odd saved value block a save that doesn’t touch it', () => {
    const odd = { ...ORDER, email: 'not an email' } as OrderDetail
    const start = draftFromOrder(odd)
    expect(validateOrderEdit({ ...start, staffNote: 'Note' }, start)).toEqual({})
  })
})
