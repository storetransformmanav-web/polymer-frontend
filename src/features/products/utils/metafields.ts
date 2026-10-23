import { formatDate, formatDateTime, formatPrice } from '../../../lib/format.ts'
import { safeUrl } from '../../../lib/safeUrl.ts'

/**
 * Metafields are Shopify's "extra custom details" on a product or variant. They arrive as
 * `namespace.key`, a Shopify type (`number_integer`, `list.single_line_text_field`,
 * `json_string`…) and the value as a string. This turns that into something a person can
 * read: a plain name, a plain type, and the value laid out by what it is. Pure — the panel
 * only has to draw the result.
 */

/** Names for the groups (namespaces) Shopify and common apps use. */
const NAMESPACE_LABELS: Record<string, string> = {
  custom: 'Custom',
  global: 'Search & SEO',
  shopify: 'Shopify',
  my_fields: 'My fields',
  reviews: 'Reviews',
  apd: 'Product descriptions app',
}

/** Names for the fields people ask about most. */
const FIELD_LABELS: Record<string, string> = {
  'global.title_tag': 'SEO title',
  'global.description_tag': 'SEO description',
  'reviews.rating': 'Rating',
  'reviews.rating_count': 'Number of reviews',
  'apd.apd': 'Description sections',
}

/** "unit_of_sale" / "unitOfSale" / "unit-of-sale" → "Unit of sale". */
function humanise(text: string): string {
  const spaced = text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .trim()
    .toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function metafieldName(namespace: string, key: string): string {
  return FIELD_LABELS[`${namespace}.${key}`] ?? humanise(key)
}

export function metafieldGroup(namespace: string): string {
  return NAMESPACE_LABELS[namespace] ?? humanise(namespace)
}

const TYPE_LABELS: Record<string, string> = {
  single_line_text_field: 'Text (one line)',
  multi_line_text_field: 'Text (several lines)',
  rich_text_field: 'Formatted text',
  number_integer: 'Whole number',
  number_decimal: 'Decimal number',
  boolean: 'Yes / No',
  date: 'Date',
  date_time: 'Date and time',
  url: 'Link',
  link: 'Link',
  color: 'Colour',
  json: 'Structured data',
  json_string: 'Structured data',
  money: 'Money',
  weight: 'Weight',
  dimension: 'Dimension',
  volume: 'Volume',
  rating: 'Rating',
  id: 'ID',
  file_reference: 'File',
  product_reference: 'Product link',
  variant_reference: 'Variant link',
  collection_reference: 'Collection link',
  page_reference: 'Page link',
  customer_reference: 'Customer link',
  metaobject_reference: 'Linked entry',
  mixed_reference: 'Linked item',
}

/** "number_integer" → "Whole number"; "list.single_line_text_field" → "List of text (one line)". */
export function metafieldTypeLabel(type: string | null | undefined): string {
  if (!type) return 'Unknown'
  if (type.startsWith('list.')) {
    const inner = TYPE_LABELS[type.slice(5)] ?? humanise(type.slice(5))
    return `List of ${inner.charAt(0).toLowerCase()}${inner.slice(1)}`
  }
  return TYPE_LABELS[type] ?? humanise(type)
}

export type MetafieldDisplay =
  | { kind: 'empty' }
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'link'; href: string; text: string }
  | { kind: 'color'; color: string }
  /** A small object, as "Label: value" rows. */
  | { kind: 'pairs'; pairs: [string, string][] }

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A value inside JSON, as one short piece of text. */
function scalar(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value === null || value === undefined) return ''
  return JSON.stringify(value)
}

/** "gid://shopify/Product/123" → "Product 123". */
function reference(value: string): string {
  const match = /^gid:\/\/shopify\/([A-Za-z]+)\/(.+)$/.exec(value)
  return match ? `${humanise(match[1])} ${match[2]}` : value
}

function pairsOf(value: Record<string, unknown>): [string, string][] {
  return Object.entries(value).map(([label, item]) => [humanise(label), scalar(item)])
}

function unitLabel(unit: unknown): string {
  return typeof unit === 'string' ? unit.toLowerCase().replace(/_/g, ' ') : ''
}

/** One value of a non-list type, laid out by what it is. */
function single(type: string, raw: string): MetafieldDisplay {
  switch (type) {
    case 'boolean':
      return { kind: 'text', text: raw === 'true' ? 'Yes' : raw === 'false' ? 'No' : raw }
    case 'number_integer':
    case 'number_decimal': {
      const number = Number(raw)
      return {
        kind: 'text',
        text: Number.isFinite(number) ? number.toLocaleString('en-GB') : raw,
      }
    }
    case 'date':
      return {
        kind: 'text',
        text: Number.isNaN(Date.parse(raw)) ? raw : formatDate(raw),
      }
    case 'date_time':
      return {
        kind: 'text',
        text: Number.isNaN(Date.parse(raw)) ? raw : formatDateTime(raw),
      }
    case 'url':
    case 'link': {
      const href = safeUrl(raw)
      return href ? { kind: 'link', href, text: raw } : { kind: 'text', text: raw }
    }
    case 'color':
      return /^#[0-9a-f]{3,8}$/i.test(raw)
        ? { kind: 'color', color: raw }
        : { kind: 'text', text: raw }
    case 'money': {
      const money = parseJson(raw)
      if (isRecord(money) && money.amount !== undefined) {
        return {
          kind: 'text',
          text: formatPrice(scalar(money.amount), scalar(money.currency_code)),
        }
      }
      return { kind: 'text', text: raw }
    }
    case 'weight':
    case 'dimension':
    case 'volume': {
      const measure = parseJson(raw)
      if (isRecord(measure) && measure.value !== undefined) {
        return {
          kind: 'text',
          text: `${scalar(measure.value)} ${unitLabel(measure.unit)}`.trim(),
        }
      }
      return { kind: 'text', text: raw }
    }
    case 'rating': {
      const rating = parseJson(raw)
      if (isRecord(rating) && rating.value !== undefined) {
        const max = rating.scale_max === undefined ? '' : ` / ${scalar(rating.scale_max)}`
        return { kind: 'text', text: `${scalar(rating.value)}${max}` }
      }
      return { kind: 'text', text: raw }
    }
    case 'json':
    case 'json_string': {
      const json = parseJson(raw)
      if (Array.isArray(json)) {
        return json.every((item) => typeof item !== 'object' || item === null)
          ? { kind: 'list', items: json.map(scalar) }
          : { kind: 'text', text: `${json.length} items` }
      }
      if (isRecord(json)) {
        const entries = Object.values(json)
        // A small, flat object reads as rows; a big or nested one is left to "view raw value".
        return entries.length <= 8 && entries.every((item) => typeof item !== 'object')
          ? { kind: 'pairs', pairs: pairsOf(json) }
          : { kind: 'text', text: `${entries.length} settings` }
      }
      return { kind: 'text', text: json === undefined ? raw : scalar(json) }
    }
    case 'rich_text_field': {
      // Shopify's formatted text is JSON of nested nodes; its words are the "value" leaves.
      const words: string[] = []
      const walk = (node: unknown) => {
        if (Array.isArray(node)) node.forEach(walk)
        else if (isRecord(node)) {
          if (typeof node.value === 'string') words.push(node.value)
          walk(node.children)
        }
      }
      walk(parseJson(raw))
      return { kind: 'text', text: words.join(' ').trim() || raw }
    }
    default:
      return {
        kind: 'text',
        text: type.endsWith('_reference') || type === 'id' ? reference(raw) : raw,
      }
  }
}

/** The value of a metafield, laid out by its type. */
export function formatMetafieldValue(
  type: string | null | undefined,
  value: string | null | undefined,
): MetafieldDisplay {
  if (value === null || value === undefined || value.trim() === '') {
    return { kind: 'empty' }
  }
  const kind = type ?? ''
  if (kind.startsWith('list.')) {
    const items = parseJson(value)
    if (!Array.isArray(items)) return { kind: 'text', text: value }
    const inner = kind.slice(5)
    return {
      kind: 'list',
      items: items.map((item) => {
        const shown = single(inner, scalar(item))
        return shown.kind === 'text' || shown.kind === 'link'
          ? shown.text
          : shown.kind === 'color'
            ? shown.color
            : scalar(item)
      }),
    }
  }
  return single(kind, value)
}

/**
 * The original value, tidied for the "view raw value" box — or null when it is plain text
 * that the formatted value already shows in full.
 */
export function rawMetafieldValue(
  type: string | null | undefined,
  value: string | null | undefined,
): string | null {
  if (!value) return null
  if (type === 'json' || type === 'json_string' || type?.startsWith('list.')) {
    const json = parseJson(value)
    return json === undefined ? value : JSON.stringify(json, null, 2)
  }
  return value.length > 120 || type === 'rich_text_field' ? value : null
}
