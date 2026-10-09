import type { ProductListItem } from '../../../lib/api/endpoints.ts'
import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import { formatPrice } from '../../../lib/format.ts'

/** "£170.00" when every variant costs the same, otherwise "£10.00 – £12.00". */
export function formatPriceRange(product: ProductListItem): string {
  const min = formatPrice(product.price_min, product.currency)
  const max = formatPrice(product.price_max, product.currency)
  return min === max || max === '—' ? min : `${min} – ${max}`
}

const STATUS_TONES: Record<string, BadgeTone> = {
  ACTIVE: 'success',
  DRAFT: 'neutral',
  ARCHIVED: 'danger',
  UNLISTED: 'warning',
}

export function statusTone(status: string | null): BadgeTone {
  return (status && STATUS_TONES[status.toUpperCase()]) || 'neutral'
}

/** "ACTIVE" → "Active"; unknown/empty values pass through safely. */
export function statusLabel(status: string | null): string {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}
