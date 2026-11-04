import type {
  OrderCreateAddress,
  OrderCreateBody,
  OrderCreateCustomer,
  OrderCreateLineItem,
  OrderPaymentStatus,
} from '../../../lib/api/endpoints.ts'

/** The API's and the store's limits, checked before anything is sent. */
export const ORDER_LIMITS = {
  lines: 250,
  quantity: 10_000,
  title: 255,
  tag: 40,
  tags: 250,
  discountCode: 255,
  discountCodes: 5,
  note: 5000,
  text: 255,
} as const

/** A line for one of the store's variants — what was picked is kept to show it. */
export interface VariantLine {
  key: string
  kind: 'variant'
  variantId: string
  quantity: string
  productTitle: string
  variantTitle: string
  sku: string
  /** The variant's own price (the order uses it), as the store sent it. */
  price: string
  imageUrl: string | null
}

/** A line that is not a product of the store, priced here. */
export interface CustomLine {
  key: string
  kind: 'custom'
  title: string
  price: string
  quantity: string
  taxable: boolean
  requiresShipping: boolean
}

export type DraftLine = VariantLine | CustomLine

export interface OrderDraft {
  /** The store key; empty means the form's default store. */
  shop: string
  customer: { email: string; firstName: string; lastName: string; phone: string }
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
  lines: DraftLine[]
  discountCodes: string[]
  shippingTitle: string
  shippingPrice: string
  note: string
  tags: string[]
  paymentStatus: OrderPaymentStatus
  paymentMethod: string
}

/** Problems by field id (the same id as the field's input, so the page can focus it). */
export type OrderErrors = Record<string, string>

export function blankOrderDraft(): OrderDraft {
  return {
    shop: '',
    customer: { email: '', firstName: '', lastName: '', phone: '' },
    address: {
      firstName: '',
      lastName: '',
      company: '',
      address1: '',
      address2: '',
      city: '',
      zip: '',
      countryCode: '',
      phone: '',
    },
    lines: [],
    discountCodes: [],
    shippingTitle: '',
    shippingPrice: '',
    note: '',
    tags: [],
    // Not paid until someone says so: an order marked paid by mistake is worse.
    paymentStatus: 'pending',
    paymentMethod: '',
  }
}

let nextKey = 0
const newKey = () => `line-${(nextKey += 1)}`

/** Adds a picked variant — or one more of it, when it is already a line. */
export function withVariant(
  lines: DraftLine[],
  variant: Omit<VariantLine, 'key' | 'kind' | 'quantity'>,
): DraftLine[] {
  const index = lines.findIndex(
    (line) => line.kind === 'variant' && line.variantId === variant.variantId,
  )
  if (index >= 0) {
    return lines.map((line, at) => {
      if (at !== index) return line
      const current = Number.parseInt(line.quantity, 10)
      return { ...line, quantity: String(Number.isFinite(current) ? current + 1 : 1) }
    })
  }
  return [...lines, { ...variant, key: newKey(), kind: 'variant', quantity: '1' }]
}

/** A new, empty custom line (taxable and not shipped, as a service usually is). */
export function blankCustomLine(): CustomLine {
  return {
    key: newKey(),
    kind: 'custom',
    title: '',
    price: '',
    quantity: '1',
    taxable: true,
    requiresShipping: false,
  }
}

/** Anything typed or picked (the store and the default payment status don't count). */
export function isOrderDirty(draft: OrderDraft): boolean {
  const blank = blankOrderDraft()
  return (
    draft.lines.length > 0 ||
    Object.values(draft.customer).some((value) => value.trim()) ||
    Object.values(draft.address).some((value) => value.trim()) ||
    draft.discountCodes.length > 0 ||
    draft.tags.length > 0 ||
    Boolean(draft.shippingTitle.trim() || draft.shippingPrice.trim()) ||
    Boolean(draft.note.trim() || draft.paymentMethod.trim()) ||
    draft.paymentStatus !== blank.paymentStatus
  )
}

const MONEY = /^\d+(\.\d{1,2})?$/
const WHOLE = /^\d+$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^\+?[\d\s()-]{6,20}$/

/** The ids of the fields, shared by the form and the checks. */
export const FIELD = {
  shop: 'order-shop',
  lines: 'order-lines',
  email: 'order-customer-email',
  firstName: 'order-customer-first-name',
  lastName: 'order-customer-last-name',
  phone: 'order-customer-phone',
  address1: 'order-address1',
  address2: 'order-address2',
  city: 'order-city',
  zip: 'order-zip',
  country: 'order-country',
  addressFirstName: 'order-address-first-name',
  addressLastName: 'order-address-last-name',
  company: 'order-company',
  addressPhone: 'order-address-phone',
  shippingTitle: 'order-shipping-title',
  shippingPrice: 'order-shipping-price',
  note: 'order-note',
  tags: 'order-tags',
  discountCodes: 'order-discount-codes',
  paymentMethod: 'order-payment-method',
  lineQuantity: (key: string) => `order-line-${key}-quantity`,
  lineTitle: (key: string) => `order-line-${key}-title`,
  linePrice: (key: string) => `order-line-${key}-price`,
} as const

/** Checks the draft against the API's limits; an empty result means it can be sent. */
export function validateOrderDraft(draft: OrderDraft): OrderErrors {
  const errors: OrderErrors = {}
  if (!draft.shop.trim()) errors[FIELD.shop] = 'Choose the store the order is for.'

  if (draft.lines.length === 0) {
    errors[FIELD.lines] = 'Add at least one product or custom item.'
  } else if (draft.lines.length > ORDER_LIMITS.lines) {
    errors[FIELD.lines] = `An order can have at most ${ORDER_LIMITS.lines} lines.`
  }
  for (const line of draft.lines) {
    const quantity = line.quantity.trim()
    if (!WHOLE.test(quantity) || Number(quantity) < 1) {
      errors[FIELD.lineQuantity(line.key)] = 'A whole number, 1 or more.'
    } else if (Number(quantity) > ORDER_LIMITS.quantity) {
      errors[FIELD.lineQuantity(line.key)] = `At most ${ORDER_LIMITS.quantity}.`
    }
    if (line.kind === 'custom') {
      if (!line.title.trim()) errors[FIELD.lineTitle(line.key)] = 'Name the item.'
      else if (line.title.trim().length > ORDER_LIMITS.title) {
        errors[FIELD.lineTitle(line.key)] = `At most ${ORDER_LIMITS.title} characters.`
      }
      if (!MONEY.test(line.price.trim())) {
        errors[FIELD.linePrice(line.key)] = 'A price such as 25.00.'
      }
    }
  }

  const customer = draft.customer
  const email = customer.email.trim()
  const anyCustomer = Object.values(customer).some((value) => value.trim())
  if (anyCustomer && !email) {
    errors[FIELD.email] = 'The customer needs an email address.'
  } else if (email && !EMAIL.test(email)) {
    errors[FIELD.email] = 'Enter an email address such as name@example.com.'
  }
  if (customer.phone.trim() && !PHONE.test(customer.phone.trim())) {
    errors[FIELD.phone] = 'Enter a phone number such as +447700900123.'
  }
  for (const [field, value] of [
    [FIELD.firstName, customer.firstName],
    [FIELD.lastName, customer.lastName],
  ] as const) {
    if (value.trim().length > ORDER_LIMITS.text) {
      errors[field] = `At most ${ORDER_LIMITS.text} characters.`
    }
  }

  const address = draft.address
  if (Object.values(address).some((value) => value.trim())) {
    if (!address.address1.trim()) errors[FIELD.address1] = 'Enter the street address.'
    if (!address.city.trim()) errors[FIELD.city] = 'Enter the town or city.'
    if (!/^[A-Za-z]{2}$/.test(address.countryCode.trim())) {
      errors[FIELD.country] = 'Choose the country.'
    }
    if (address.phone.trim() && !PHONE.test(address.phone.trim())) {
      errors[FIELD.addressPhone] = 'Enter a phone number such as +447700900123.'
    }
  }

  const shippingTitle = draft.shippingTitle.trim()
  const shippingPrice = draft.shippingPrice.trim()
  if ((shippingTitle || shippingPrice) && !shippingTitle) {
    errors[FIELD.shippingTitle] = 'Name the delivery, e.g. Next day delivery.'
  } else if (shippingTitle.length > ORDER_LIMITS.title) {
    errors[FIELD.shippingTitle] = `At most ${ORDER_LIMITS.title} characters.`
  }
  if (shippingPrice && !MONEY.test(shippingPrice)) {
    errors[FIELD.shippingPrice] = 'A price such as 6.95.'
  }

  if (draft.discountCodes.length > ORDER_LIMITS.discountCodes) {
    errors[FIELD.discountCodes] = `At most ${ORDER_LIMITS.discountCodes} codes.`
  } else if (
    draft.discountCodes.some((code) => code.length > ORDER_LIMITS.discountCode)
  ) {
    errors[FIELD.discountCodes] =
      `A code has at most ${ORDER_LIMITS.discountCode} characters.`
  }
  if (draft.tags.length > ORDER_LIMITS.tags) {
    errors[FIELD.tags] = `At most ${ORDER_LIMITS.tags} tags.`
  } else if (draft.tags.some((tag) => tag.length > ORDER_LIMITS.tag)) {
    errors[FIELD.tags] = `A tag has at most ${ORDER_LIMITS.tag} characters.`
  }
  if (draft.note.length > ORDER_LIMITS.note) {
    errors[FIELD.note] = `At most ${ORDER_LIMITS.note} characters.`
  }
  if (draft.paymentMethod.trim().length > ORDER_LIMITS.text) {
    errors[FIELD.paymentMethod] = `At most ${ORDER_LIMITS.text} characters.`
  }
  return errors
}

/** The keys whose value was filled in (blank ones are left out of the request). */
function filled<T extends Record<string, string | undefined>>(record: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, value]) => [key, value?.trim() ?? ''])
      .filter(([, value]) => value),
  ) as Partial<T>
}

/** "6.95" stays; "7" becomes "7.00" (the API takes prices as decimal text). */
const money = (value: string) => Number(value.trim()).toFixed(2)

/**
 * The request for a checked draft: only what was filled in. A variant line is sent by its id
 * and quantity (the store prices it); a custom line with its own title, price and flags.
 */
export function buildOrderBody(draft: OrderDraft): OrderCreateBody {
  const lineItems: OrderCreateLineItem[] = draft.lines.map((line) =>
    line.kind === 'variant'
      ? { variant_id: line.variantId, quantity: Number(line.quantity.trim()) }
      : {
          title: line.title.trim(),
          price: money(line.price),
          quantity: Number(line.quantity.trim()),
          taxable: line.taxable,
          requires_shipping: line.requiresShipping,
        },
  )
  const body: OrderCreateBody = { shop: draft.shop.trim(), line_items: lineItems }

  const customer: OrderCreateCustomer = filled({
    email: draft.customer.email,
    first_name: draft.customer.firstName,
    last_name: draft.customer.lastName,
    phone: draft.customer.phone,
  })
  if (Object.keys(customer).length > 0) body.customer = customer

  const a = draft.address
  if (Object.values(a).some((value) => value.trim())) {
    body.shipping_address = {
      ...filled({
        first_name: a.firstName,
        last_name: a.lastName,
        company: a.company,
        address2: a.address2,
        zip: a.zip,
        phone: a.phone,
      }),
      address1: a.address1.trim(),
      city: a.city.trim(),
      country_code: a.countryCode.trim().toUpperCase(),
    } as OrderCreateAddress
  }

  if (draft.discountCodes.length > 0) body.discount_codes = [...draft.discountCodes]
  const shippingTitle = draft.shippingTitle.trim()
  if (shippingTitle) {
    body.shipping = {
      title: shippingTitle,
      price: draft.shippingPrice.trim() ? money(draft.shippingPrice) : '0.00',
    }
  }
  if (draft.note.trim()) body.note = draft.note.trim()
  if (draft.tags.length > 0) body.tags = [...draft.tags]
  const method = draft.paymentMethod.trim()
  body.payment = { status: draft.paymentStatus, ...(method ? { method } : {}) }
  return body
}

/**
 * What the order comes to before discounts and tax, which the store works out: the lines'
 * prices × quantities, plus delivery. `complete` is false while a line has no usable price.
 */
export function orderTotals(draft: OrderDraft): {
  items: number
  subtotal: number
  shipping: number
  total: number
  complete: boolean
} {
  let subtotal = 0
  let items = 0
  let complete = true
  for (const line of draft.lines) {
    const quantity = Number.parseInt(line.quantity, 10)
    const price = Number.parseFloat(line.price)
    if (!Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(price)) {
      complete = false
      continue
    }
    items += quantity
    subtotal += price * quantity
  }
  const shippingValue = Number.parseFloat(draft.shippingPrice)
  const shipping = Number.isFinite(shippingValue) ? shippingValue : 0
  return {
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    shipping,
    total: Math.round((subtotal + shipping) * 100) / 100,
    complete,
  }
}

/** Splits typed text into chips: commas or new lines separate them; blanks and repeats go. */
export function splitChips(text: string, existing: string[]): string[] {
  const seen = new Set(existing.map((value) => value.toLowerCase()))
  const added: string[] = []
  for (const part of text.split(/[,\n]/)) {
    const value = part.trim()
    if (!value || seen.has(value.toLowerCase())) continue
    seen.add(value.toLowerCase())
    added.push(value)
  }
  return added
}
