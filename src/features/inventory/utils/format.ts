import type { BadgeTone } from '../../../components/ui/badgeTones.ts'
import { formatDateTime } from '../../../lib/format.ts'
import type { InventoryItem, StockHistoryItem } from '../../../lib/api/endpoints.ts'

export const LIST_PATH = '/inventory'
export const HISTORY_PATH = '/inventory/history'
/** A variant's stock page: `/inventory/<variant id>`. */
export const variantPath = (id: string) => `${LIST_PATH}/${encodeURIComponent(id)}`

/** A product's status as a person reads it. */
export function statusLabel(status: string | null | undefined): string {
  if (!status) return 'Unknown'
  const lower = status.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export function statusTone(status: string | null | undefined): BadgeTone {
  switch ((status ?? '').toUpperCase()) {
    case 'ACTIVE':
      return 'success'
    case 'ARCHIVED':
      return 'danger'
    default:
      return 'neutral'
  }
}

/** The variant's own name, or null for a product's one default variant. */
export function variantName(item: Pick<InventoryItem, 'variant_title'>): string | null {
  const name = item.variant_title?.trim()
  return name && name.toLowerCase() !== 'default title' ? name : null
}

/** "Hippo Bag — Small / Red": the product, then the variant when it has a name. */
export function fullName(item: Pick<InventoryItem, 'title' | 'variant_title'>): string {
  const name = variantName(item)
  return name ? `${item.title} — ${name}` : item.title
}

/** Who made a change, as a name. */
export function userName(user: StockHistoryItem['user']): string {
  if (!user) return '—'
  if (typeof user === 'string') return user
  return user.name || user.email || '—'
}

/** A date and time, or a dash. */
export function when(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return formatDateTime(iso)
  } catch {
    return iso
  }
}

/** Tone of a change's status badge: pending grey, synced green, error red. */
export function syncTone(status: string | null | undefined): BadgeTone {
  if (status === 'synced') return 'success'
  if (status === 'error') return 'danger'
  return 'neutral'
}

export function syncLabel(status: string | null | undefined): string {
  if (status === 'synced') return 'Synced'
  if (status === 'error') return 'Error'
  return 'Pending'
}
