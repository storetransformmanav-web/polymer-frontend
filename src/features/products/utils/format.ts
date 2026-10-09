import type { ProductListItem } from '../../../lib/api/endpoints.ts'
import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import { formatPrice } from '../../../lib/format.ts'

/** "£170.00" when min and max match, otherwise "£10.00 – £12.00". */
export function formatRange(
  min: string | null | undefined,
  max: string | null | undefined,
  currency: string | null | undefined,
): string {
  const low = formatPrice(min, currency)
  const high = formatPrice(max, currency)
  return low === high || high === '—' ? low : `${low} – ${high}`
}

export function formatPriceRange(product: ProductListItem): string {
  return formatRange(product.price_min, product.price_max, product.currency)
}

const STATUS_TONES: Record<string, BadgeTone> = {
  ACTIVE: 'success',
  DRAFT: 'neutral',
  ARCHIVED: 'danger',
  UNLISTED: 'warning',
}

export function statusTone(status: string | null | undefined): BadgeTone {
  return (status && STATUS_TONES[status.toUpperCase()]) || 'neutral'
}

/** "ACTIVE" → "Active"; unknown/empty values pass through safely. */
export function statusLabel(status: string | null | undefined): string {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

/**
 * Plain text from Shopify's description HTML. DOMParser builds an inert
 * document (no scripts run, nothing loads), and we only read its text — so
 * the HTML never reaches the page as markup.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return ''
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
  const doc = new DOMParser().parseFromString(withBreaks, 'text/html')
  // textContent would include the *code* inside <script>/<style>; drop those first.
  doc
    .querySelectorAll('script, style, noscript, template')
    .forEach((node) => node.remove())
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
}

/** Only http(s) links are ever rendered as hrefs (never `javascript:` etc). */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed.href
      : null
  } catch {
    return null
  }
}
