import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import type { CustomerListItem } from '../../../lib/api/endpoints.ts'

/** The name to show: full name, else first + last, else the email's local part. */
export function customerName(
  customer: Pick<CustomerListItem, 'full_name' | 'first_name' | 'last_name' | 'email'>,
): string {
  const full = customer.full_name?.trim()
  if (full) return full

  const joined = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
  if (joined) return joined

  return customer.email?.split('@')[0] || 'Unnamed customer'
}

/** "Winchester, United Kingdom" — whichever parts exist. */
export function customerLocation(customer: CustomerListItem): string {
  return [customer.city, customer.country].filter(Boolean).join(', ')
}

/** Customers migrated from Shopify have a Shopify ID; CRM-created ones don't. */
export function customerSource(
  customer: Pick<CustomerListItem, 'shopify_id'>,
): 'Shopify' | 'CRM' {
  return customer.shopify_id == null ? 'CRM' : 'Shopify'
}

/** "ENABLED" → "Enabled"; CRM customers have no Shopify account state. */
export function capitalize(value: string | null | undefined): string {
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

const STATE_TONES: Record<string, BadgeTone> = {
  ENABLED: 'success',
  INVITED: 'warning',
  DISABLED: 'danger',
  DECLINED: 'danger',
}

export function stateTone(state: string | null | undefined): BadgeTone {
  return (state && STATE_TONES[state.toUpperCase()]) || 'neutral'
}

export function roleTone(role: string): BadgeTone {
  return role.toLowerCase() === 'administrator' ? 'default' : 'neutral'
}

/** "email_marketing" style codes → "Email marketing"; also "NOT_SUBSCRIBED" → "Not subscribed". */
export function humanize(value: string | null | undefined): string {
  if (!value) return ''
  const words = value.replace(/[_-]+/g, ' ').trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** One-line postal address from whichever parts exist. */
export function formatAddressLines(address: {
  address1?: string | null
  address2?: string | null
  city?: string | null
  province?: string | null
  zip?: string | null
  country?: string | null
}): string[] {
  return [
    address.address1,
    address.address2,
    [address.city, address.province].filter(Boolean).join(', '),
    [address.zip, address.country].filter(Boolean).join(' '),
  ].filter((line): line is string => Boolean(line && line.trim()))
}
