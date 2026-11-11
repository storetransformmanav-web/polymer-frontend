import type { CustomerCreateBody } from '../../../lib/api/endpoints.ts'

/** A metafield row of the form; `id` only keys the row. */
export interface MetafieldDraft {
  id: string
  namespace: string
  key: string
  value: string
}

/** Everything typed into the Add customer form. */
export interface CustomerDraft {
  /** The store key the customer is made in. */
  shop: string
  email: string
  firstName: string
  lastName: string
  acceptsMarketing: boolean
  taxExempt: boolean
  company: string
  address1: string
  address2: string
  city: string
  province: string
  zip: string
  /** Two-letter country code, '' for none. */
  country: string
  phone: string
  tags: string[]
  metafields: MetafieldDraft[]
}

export const EMPTY_DRAFT: CustomerDraft = {
  shop: '',
  email: '',
  firstName: '',
  lastName: '',
  acceptsMarketing: false,
  taxExempt: false,
  company: '',
  address1: '',
  address2: '',
  city: '',
  province: '',
  zip: '',
  country: '',
  phone: '',
  tags: [],
  metafields: [],
}

/** The id of the New customer tab in the open-customers strip (not a customer id). */
export const DRAFT_TAB = '__new-customer__'

export const MAX_TAGS = 50
export const MAX_METAFIELDS = 30

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const METAFIELD_NAME = /^[A-Za-z0-9_.-]+$/

/** The address fields, in the order the form shows them. */
const ADDRESS_FIELDS = [
  'company',
  'address1',
  'address2',
  'city',
  'province',
  'zip',
  'country',
  'phone',
] as const

const hasAddress = (draft: CustomerDraft) =>
  ADDRESS_FIELDS.some((field) => draft[field].trim() !== '')

const metafieldTouched = (row: MetafieldDraft) =>
  row.namespace.trim() !== '' || row.key.trim() !== '' || row.value.trim() !== ''

/** True when the form holds anything the person typed or chose (the store alone doesn't count). */
export function isDraftDirty(draft: CustomerDraft): boolean {
  return (
    draft.email.trim() !== '' ||
    draft.firstName.trim() !== '' ||
    draft.lastName.trim() !== '' ||
    draft.acceptsMarketing ||
    draft.taxExempt ||
    hasAddress(draft) ||
    draft.tags.length > 0 ||
    draft.metafields.some(metafieldTouched)
  )
}

/**
 * Checks the form before anything is sent. The keys of the answer are the form's field names:
 * `shop`, `email`, `address1`, `city`, `country`, `tags` and `metafield-<row id>`.
 * An address is optional, but once any part is typed it needs a street, a city and a country.
 */
export function validateCustomerDraft(draft: CustomerDraft): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!draft.shop) errors.shop = 'Choose the store this customer belongs to'
  if (!draft.email.trim()) errors.email = 'Enter an email address'
  else if (!EMAIL_PATTERN.test(draft.email.trim()))
    errors.email = 'Enter a valid email address'

  if (hasAddress(draft)) {
    if (!draft.address1.trim()) errors.address1 = 'Enter the street address'
    if (!draft.city.trim()) errors.city = 'Enter the city'
    if (!draft.country) errors.country = 'Choose the country'
  }

  if (draft.tags.length > MAX_TAGS) errors.tags = `At most ${MAX_TAGS} tags`

  const seen = new Set<string>()
  for (const row of draft.metafields) {
    if (!metafieldTouched(row)) continue
    const name = `${row.namespace.trim()}.${row.key.trim()}`.toLowerCase()
    const field = `metafield-${row.id}`
    if (!row.namespace.trim() || !row.key.trim()) {
      errors[field] = 'Enter both a namespace and a key'
    } else if (
      !METAFIELD_NAME.test(row.namespace.trim()) ||
      !METAFIELD_NAME.test(row.key.trim())
    ) {
      errors[field] = 'Use letters, numbers, dots, dashes or underscores only'
    } else if (!row.value.trim()) {
      errors[field] = 'Enter a value'
    } else if (seen.has(name)) {
      errors[field] = 'This metafield is listed twice'
    }
    seen.add(name)
  }

  return errors
}

/** The request: only what was filled in goes out (the two consent flags always do). */
export function buildCustomerBody(draft: CustomerDraft): CustomerCreateBody {
  const body: CustomerCreateBody = {
    shop: draft.shop,
    email: draft.email.trim().toLowerCase(),
    accepts_email_marketing: draft.acceptsMarketing,
    tax_exempt: draft.taxExempt,
  }
  if (draft.firstName.trim()) body.first_name = draft.firstName.trim()
  if (draft.lastName.trim()) body.last_name = draft.lastName.trim()

  if (hasAddress(draft)) {
    const address: NonNullable<CustomerCreateBody['address']> = {}
    const text = (value: string) => value.trim()
    if (text(draft.company)) address.company = text(draft.company)
    if (text(draft.address1)) address.address1 = text(draft.address1)
    if (text(draft.address2)) address.address2 = text(draft.address2)
    if (text(draft.city)) address.city = text(draft.city)
    if (text(draft.province)) address.province_code = text(draft.province).toUpperCase()
    if (text(draft.zip)) address.zip = text(draft.zip)
    if (draft.country) address.country_code = draft.country.toUpperCase()
    if (text(draft.phone)) address.phone = text(draft.phone)
    body.address = address
  }

  if (draft.tags.length > 0) body.tags = draft.tags

  const metafields = draft.metafields
    .filter((row) => metafieldTouched(row))
    .map((row) => ({
      namespace: row.namespace.trim(),
      key: row.key.trim(),
      value: row.value.trim(),
    }))
  if (metafields.length > 0) body.metafields = metafields

  return body
}
