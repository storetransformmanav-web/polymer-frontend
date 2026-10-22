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

export { safeUrl } from '../../../lib/safeUrl.ts'

/**
 * A heads-up for an image address the store won't take: Shopify doesn't accept
 * SVG as a product image, and placeholder services such as placehold.co answer with
 * an SVG unless the address ends in a raster extension (.png, .jpg …). Null when the
 * address looks fine. Only a hint — it never blocks anything.
 */
export function svgImageWarning(address: string): string | null {
  let url: URL
  try {
    url = new URL(address.trim())
  } catch {
    return null
  }
  const path = url.pathname.toLowerCase()
  const raster = /\.(png|jpe?g|gif|webp|avif|heic|tiff?)$/.test(path)
  const isSvg = path.endsWith('.svg')
  const placeholder =
    url.hostname === 'placehold.co' || url.hostname.endsWith('.placehold.co')
  if (!isSvg && !(placeholder && !raster)) return null
  return `This address gives an SVG, which the store doesn't accept as a product image. Use a .png or .jpg address${
    placeholder
      ? ' (for placehold.co add .png, e.g. https://placehold.co/600x600.png?text=Bag)'
      : ''
  }.`
}

/**
 * The address of a product's page in the Shopify admin —
 * `https://admin.shopify.com/store/<store>/products/<shopify id>` — or null when it
 * can't be worked out (no store address on the row, or an id that isn't a plain
 * positive number). The store name is the part of its `*.myshopify.com` address
 * before that suffix, and nothing else from the data is put in the link.
 */
export function shopifyAdminProductUrl(
  shop: { domain?: string | null } | null | undefined,
  shopifyId: number | null | undefined,
): string | null {
  const match = /^([a-z0-9][a-z0-9-]*)\.myshopify\.com$/i.exec(
    (shop?.domain ?? '').trim(),
  )
  if (!match || !Number.isSafeInteger(shopifyId) || (shopifyId as number) <= 0)
    return null
  return `https://admin.shopify.com/store/${match[1].toLowerCase()}/products/${shopifyId}`
}
