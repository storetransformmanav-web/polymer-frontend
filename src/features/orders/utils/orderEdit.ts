import type {
  OrderCreateAddress,
  OrderDetail,
  OrderUpdateBody,
} from '../../../lib/api/endpoints.ts'
import { EMAIL, MONEY, ORDER_LIMITS, PHONE, WHOLE, type DraftLine } from './orderDraft.ts'

/** What the Edit order page holds: every box as typed, starting from the order as it is. */
export interface OrderEditDraft {
  email: string
  address: {
    firstName: string
    lastName: string
    company: string
    address1: string
    address2: string
    city: string
    zip: string
    countryCode: string
    phone: string
  }
  /** The quantity of each line already on the order, by the line's id. */
  quantities: Record<string, string>
  /** Products being added (`line_items_add`). */
  added: DraftLine[]
  shippingTitle: string
  shippingPrice: string
  /** Why the order is changing; it starts empty and is only sent when written. */
  staffNote: string
}

export type OrderEditErrors = Record<string, string>

/** The ids of the page's fields (not the Add order form's, which can be open at the same time). */
export const EDIT_FIELD = {
  email: 'order-edit-email',
  firstName: 'order-edit-first-name',
  lastName: 'order-edit-last-name',
  company: 'order-edit-company',
  address1: 'order-edit-address1',
  address2: 'order-edit-address2',
  city: 'order-edit-city',
  zip: 'order-edit-zip',
  country: 'order-edit-country',
  phone: 'order-edit-phone',
  shippingTitle: 'order-edit-shipping-title',
  shippingPrice: 'order-edit-shipping-price',
  staffNote: 'order-edit-staff-note',
  quantity: (key: string) => `order-edit-quantity-${key}`,
} as const

/** A line's quantity now: what is left after any earlier changes, else what was ordered. */
export const lineQuantity = (line: OrderDetail['line_items'][number]): number =>
  line.current_quantity ?? line.quantity ?? 0

/** The lines that can be edited: one fully removed earlier has nothing left to change. */
export const editableLines = (order: OrderDetail): OrderDetail['line_items'] =>
  order.line_items.filter((line) => lineQuantity(line) > 0)

export function draftFromOrder(order: OrderDetail): OrderEditDraft {
  const address = order.shipping_address
  const shipping = order.shipping_lines[0]
  return {
    email: order.email ?? '',
    address: {
      firstName: address?.first_name ?? '',
      lastName: address?.last_name ?? '',
      company: address?.company ?? '',
      address1: address?.address1 ?? '',
      address2: address?.address2 ?? '',
      city: address?.city ?? '',
      zip: address?.zip ?? '',
      countryCode: address?.country_code ?? '',
      phone: address?.phone ?? '',
    },
    quantities: Object.fromEntries(
      editableLines(order).map((line) => [line.id, String(lineQuantity(line))]),
    ),
    added: [],
    shippingTitle: shipping?.title ?? '',
    shippingPrice: shipping?.price ?? '',
    staffNote: '',
  }
}

const addressChanged = (draft: OrderEditDraft, initial: OrderEditDraft) =>
  (Object.keys(draft.address) as (keyof OrderEditDraft['address'])[]).some(
    (key) => draft.address[key].trim() !== initial.address[key].trim(),
  )

/** The same amount, however it is written ("4.9" and "4.90"). */
const sameMoney = (a: string, b: string) =>
  a.trim() === b.trim() || (a.trim() !== '' && b.trim() !== '' && Number(a) === Number(b))

const shippingChanged = (draft: OrderEditDraft, initial: OrderEditDraft) =>
  draft.shippingTitle.trim() !== initial.shippingTitle.trim() ||
  !sameMoney(draft.shippingPrice, initial.shippingPrice)

/**
 * Checks what was changed against the API's limits; an empty result means it can be sent. A value
 * nobody touched is never checked, so something odd already on the order can't block a save.
 */
export function validateOrderEdit(
  draft: OrderEditDraft,
  initial: OrderEditDraft,
): OrderEditErrors {
  const errors: OrderEditErrors = {}

  const email = draft.email.trim()
  if (email !== initial.email.trim() && !EMAIL.test(email)) {
    errors[EDIT_FIELD.email] = 'Enter an email address such as name@example.com.'
  }

  const checkQuantity = (key: string, text: string) => {
    const value = text.trim()
    if (!WHOLE.test(value) || Number(value) < 1) {
      errors[EDIT_FIELD.quantity(key)] = 'A whole number, 1 or more.'
    } else if (Number(value) > ORDER_LIMITS.quantity) {
      errors[EDIT_FIELD.quantity(key)] = `At most ${ORDER_LIMITS.quantity}.`
    }
  }
  for (const [id, quantity] of Object.entries(draft.quantities)) {
    if (quantity !== initial.quantities[id]) checkQuantity(id, quantity)
  }
  for (const line of draft.added) checkQuantity(line.key, line.quantity)

  if (addressChanged(draft, initial)) {
    const { address } = draft
    if (!address.address1.trim()) {
      errors[EDIT_FIELD.address1] = 'Enter the street address.'
    }
    if (!address.city.trim()) errors[EDIT_FIELD.city] = 'Enter the town or city.'
    if (!/^[A-Za-z]{2}$/.test(address.countryCode.trim())) {
      errors[EDIT_FIELD.country] = 'Choose the country.'
    }
    if (address.phone.trim() && !PHONE.test(address.phone.trim())) {
      errors[EDIT_FIELD.phone] = 'Enter a phone number such as +447700900123.'
    }
  }

  if (shippingChanged(draft, initial)) {
    const title = draft.shippingTitle.trim()
    if (!title) {
      errors[EDIT_FIELD.shippingTitle] = 'Name the delivery, e.g. Standard delivery.'
    } else if (title.length > ORDER_LIMITS.title) {
      errors[EDIT_FIELD.shippingTitle] = `At most ${ORDER_LIMITS.title} characters.`
    }
    if (draft.shippingPrice.trim() && !MONEY.test(draft.shippingPrice.trim())) {
      errors[EDIT_FIELD.shippingPrice] = 'A price such as 4.95.'
    }
  }

  if (draft.staffNote.length > ORDER_LIMITS.note) {
    errors[EDIT_FIELD.staffNote] = `At most ${ORDER_LIMITS.note} characters.`
  }
  return errors
}

/** The request for a checked draft: only what changed. Empty when nothing did. */
export function buildOrderUpdateBody(
  draft: OrderEditDraft,
  initial: OrderEditDraft,
): OrderUpdateBody {
  const body: OrderUpdateBody = {}

  const email = draft.email.trim()
  if (email !== initial.email.trim()) body.email = email

  if (addressChanged(draft, initial)) {
    const a = draft.address
    const optional = {
      first_name: a.firstName,
      last_name: a.lastName,
      company: a.company,
      address2: a.address2,
      zip: a.zip,
      phone: a.phone,
    }
    body.shipping_address = {
      ...Object.fromEntries(
        Object.entries(optional)
          .map(([key, value]) => [key, value.trim()])
          .filter(([, value]) => value),
      ),
      address1: a.address1.trim(),
      city: a.city.trim(),
      country_code: a.countryCode.trim().toUpperCase(),
    } as OrderCreateAddress
  }

  const add = draft.added.flatMap((line) =>
    line.kind === 'variant'
      ? [{ variant_id: line.variantId, quantity: Number(line.quantity.trim()) }]
      : [],
  )
  if (add.length > 0) body.line_items_add = add

  const update = Object.entries(draft.quantities)
    .filter(([id, quantity]) => Number(quantity) !== Number(initial.quantities[id]))
    .map(([id, quantity]) => ({ line_item_id: id, quantity: Number(quantity.trim()) }))
  if (update.length > 0) body.line_items_update = update

  if (shippingChanged(draft, initial)) {
    const price = draft.shippingPrice.trim()
    body.shipping = {
      title: draft.shippingTitle.trim(),
      price: price ? Number(price).toFixed(2) : '0.00',
    }
  }

  const note = draft.staffNote.trim()
  if (note) body.staff_note = note
  return body
}

/** What a request will change, in words, for the question before it is sent. */
export function describeOrderChanges(
  body: OrderUpdateBody,
  order: OrderDetail,
): string[] {
  const nameOf = (id: string) => {
    const line = order.line_items.find((candidate) => candidate.id === id)
    return [line?.title || 'Item', line?.variant_title].filter(Boolean).join(' – ')
  }
  const quantityOf = (id: string) => {
    const line = order.line_items.find((candidate) => candidate.id === id)
    return line ? lineQuantity(line) : 0
  }
  return [
    ...(body.email !== undefined ? [`Email: ${order.email || '—'} → ${body.email}`] : []),
    ...(body.line_items_update ?? []).map(
      (line) =>
        `${nameOf(line.line_item_id)}: quantity ${quantityOf(line.line_item_id)} → ${line.quantity}`,
    ),
    ...(body.line_items_add?.length
      ? [
          `${body.line_items_add.length} new ${body.line_items_add.length === 1 ? 'product' : 'products'} added`,
        ]
      : []),
    ...(body.shipping_address ? ['Shipping address changed'] : []),
    ...(body.shipping
      ? [
          `Delivery: ${order.shipping_lines[0]?.title || '—'} · ${order.shipping_lines[0]?.price || '—'} → ${body.shipping.title} · ${body.shipping.price}`,
        ]
      : []),
  ]
}
