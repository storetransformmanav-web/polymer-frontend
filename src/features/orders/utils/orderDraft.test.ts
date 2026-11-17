import { describe, expect, it } from 'vitest'
import {
  blankOrderDraft,
  buildOrderBody,
  FIELD,
  isOrderDirty,
  orderTotals,
  splitChips,
  validateOrderDraft,
  withoutOne,
  withVariant,
  type OrderDraft,
} from './orderDraft.ts'

const VARIANT_ID = '2503d64d-42b7-4261-afe4-14ef76bfea13'

const VARIANT = {
  variantId: VARIANT_ID,
  productTitle: 'Pizza Box',
  variantTitle: '12 inch',
  sku: 'PB12',
  price: '10.00',
  imageUrl: null,
}

/** The documented example request, typed into the form. */
function exampleDraft(): OrderDraft {
  let lines = withVariant([], {
    variantId: VARIANT_ID,
    productTitle: 'Pizza Box',
    variantTitle: '12 inch',
    sku: 'PB12',
    price: '10.00',
    imageUrl: null,
  })
  lines = withVariant(lines, {
    variantId: VARIANT_ID,
    productTitle: 'Pizza Box',
    variantTitle: '12 inch',
    sku: 'PB12',
    price: '10.00',
    imageUrl: null,
  })
  return {
    ...blankOrderDraft(),
    shop: 'polymer-uk',
    customer: {
      email: 'buyer@example.com',
      firstName: 'Sam',
      lastName: 'Taylor',
      phone: '+447700900123',
    },
    address: {
      firstName: 'Sam',
      lastName: 'Taylor',
      company: 'Taylor Foods Ltd',
      address1: '1 High Street',
      city: 'London',
      zip: 'NW10 7RX',
      countryCode: 'GB',
      phone: '+447700900123',
    },
    lines,
    discountCodes: ['WELCOME10'],
    shippingTitle: 'Next day delivery',
    shippingPrice: '6.95',
    note: 'Phone order',
    tags: ['crm'],
    paymentStatus: 'paid',
    paymentMethod: 'Bank Transfer',
  }
}

describe('buildOrderBody', () => {
  it('rebuilds the documented example request exactly', () => {
    const draft = exampleDraft()
    expect(validateOrderDraft(draft)).toEqual({})
    expect(buildOrderBody(draft)).toEqual({
      shop: 'polymer-uk',
      customer: {
        email: 'buyer@example.com',
        first_name: 'Sam',
        last_name: 'Taylor',
        phone: '+447700900123',
      },
      shipping_address: {
        first_name: 'Sam',
        last_name: 'Taylor',
        company: 'Taylor Foods Ltd',
        address1: '1 High Street',
        city: 'London',
        zip: 'NW10 7RX',
        country_code: 'GB',
        phone: '+447700900123',
      },
      line_items: [{ variant_id: VARIANT_ID, quantity: 2 }],
      discount_codes: ['WELCOME10'],
      shipping: { title: 'Next day delivery', price: '6.95' },
      note: 'Phone order',
      tags: ['crm'],
      payment: { status: 'paid', method: 'Bank Transfer' },
    })
  })

  it('sends only what was filled in: no customer, address, delivery, codes, note or tags', () => {
    const draft: OrderDraft = {
      ...blankOrderDraft(),
      shop: 'polymer-uk',
      lines: withVariant([], VARIANT),
    }
    expect(buildOrderBody(draft)).toEqual({
      shop: 'polymer-uk',
      line_items: [{ variant_id: VARIANT_ID, quantity: 1 }],
      payment: { status: 'pending' },
    })
  })

  it('sends a line as its variant id and quantity only: no title, price or flags', () => {
    const body = buildOrderBody(exampleDraft())
    for (const item of body.line_items) {
      expect(Object.keys(item).sort()).toEqual(['quantity', 'variant_id'])
    }
  })

  it('gives a delivery with no price a price of 0.00', () => {
    const draft = exampleDraft()
    draft.shippingPrice = ''
    expect(buildOrderBody(draft).shipping).toEqual({
      title: 'Next day delivery',
      price: '0.00',
    })
  })
})

describe('validateOrderDraft', () => {
  it('needs a store and at least one line', () => {
    const errors = validateOrderDraft(blankOrderDraft())
    expect(errors[FIELD.shop]).toBeTruthy()
    expect(errors[FIELD.lines]).toBe('Add at least one product.')
  })

  it('checks each line: a whole quantity of 1 or more', () => {
    const [line] = withVariant([], VARIANT)
    const draft = {
      ...blankOrderDraft(),
      shop: 's',
      lines: [{ ...line, quantity: '0' }],
    }
    expect(validateOrderDraft(draft)[FIELD.lineQuantity(line.key)]).toBe(
      'A whole number, 1 or more.',
    )
    expect(validateOrderDraft({ ...draft, lines: [{ ...line, quantity: '2' }] })).toEqual(
      {},
    )
    expect(
      validateOrderDraft({ ...draft, lines: [{ ...line, quantity: '1.5' }] })[
        FIELD.lineQuantity(line.key)
      ],
    ).toBeTruthy()
  })

  it('wants an email for a customer, a valid one, and a valid phone', () => {
    const draft = exampleDraft()
    draft.customer.email = ''
    expect(validateOrderDraft(draft)[FIELD.email]).toBe(
      'The customer needs an email address.',
    )
    draft.customer.email = 'not-an-email'
    expect(validateOrderDraft(draft)[FIELD.email]).toMatch(/email address such as/)
    draft.customer.email = 'a@b.co'
    draft.customer.phone = 'call me'
    expect(validateOrderDraft(draft)[FIELD.phone]).toBeTruthy()
  })

  it('wants the street, town and country once any of the address is typed', () => {
    const draft = {
      ...exampleDraft(),
      address: { ...blankOrderDraft().address, zip: 'N1' },
    }
    const errors = validateOrderDraft(draft)
    expect(errors[FIELD.address1]).toBeTruthy()
    expect(errors[FIELD.city]).toBeTruthy()
    expect(errors[FIELD.country]).toBe('Choose the country.')
  })

  it('wants a name for a delivery that has a price, and a real price', () => {
    const draft = exampleDraft()
    draft.shippingTitle = ''
    expect(validateOrderDraft(draft)[FIELD.shippingTitle]).toBeTruthy()
    draft.shippingTitle = 'Courier'
    draft.shippingPrice = '6.999'
    expect(validateOrderDraft(draft)[FIELD.shippingPrice]).toBe('A price such as 6.95.')
  })
})

describe('the lines and totals', () => {
  it('adds one more of a variant that is already a line', () => {
    const draft = exampleDraft()
    expect(draft.lines).toHaveLength(1)
    expect(draft.lines[0].quantity).toBe('2')
  })

  it('adds up the lines and the delivery, and says when a line has no price', () => {
    expect(orderTotals(exampleDraft())).toEqual({
      items: 2,
      subtotal: 20,
      shipping: 6.95,
      total: 26.95,
      complete: true,
    })
    const draft = exampleDraft()
    draft.lines = draft.lines.map((line) => ({ ...line, quantity: '' }))
    expect(orderTotals(draft).complete).toBe(false)
  })

  it('takes one off a line, and the line goes at 1', () => {
    const twice = exampleDraft().lines
    const once = withoutOne(twice, VARIANT_ID)
    expect(once[0].quantity).toBe('1')
    expect(withoutOne(once, VARIANT_ID)).toEqual([])
    expect(withoutOne(twice, 'another-variant')).toEqual(twice)
  })

  it('counts anything typed as unsaved work, but not the store alone', () => {
    expect(isOrderDirty(blankOrderDraft())).toBe(false)
    expect(isOrderDirty({ ...blankOrderDraft(), shop: 'polymer-uk' })).toBe(false)
    expect(isOrderDirty({ ...blankOrderDraft(), note: 'x' })).toBe(true)
    expect(isOrderDirty({ ...blankOrderDraft(), paymentStatus: 'paid' })).toBe(true)
    expect(isOrderDirty({ ...blankOrderDraft(), tags: ['crm'] })).toBe(true)
  })

  it('splits typed chips on commas and drops blanks and repeats (any case)', () => {
    expect(splitChips('crm, B2B,, crm , phone', ['b2b'])).toEqual(['crm', 'phone'])
  })
})
