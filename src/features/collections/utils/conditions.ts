import type { CollectionListItem } from '../../../lib/api/endpoints.ts'
import { formatPrice } from '../../../lib/format.ts'

/** How many lines of conditions the collections table shows before "+ More Conditions". */
export const CONDITIONS_SHOWN = 2

/** How many values of a joined list ("Tag includes a, b, +3 more") are written out. */
const VALUES_SHOWN = 2

/** What each rule column is called (the API's column names, Shopify's rule fields). */
const COLUMN_NAMES: Record<string, string> = {
  TAG: 'Tag',
  TITLE: 'Title',
  TYPE: 'Type',
  VENDOR: 'Vendor',
  VARIANT_TITLE: 'Variant title',
  VARIANT_PRICE: 'Price',
  VARIANT_COMPARE_AT_PRICE: 'Compare-at price',
  VARIANT_WEIGHT: 'Weight',
  VARIANT_INVENTORY: 'Inventory stock',
  IS_PRICE_REDUCED: 'Price reduced',
}

/** Columns whose value is an amount of money, written with the store's currency ("£35.00"). */
const MONEY_COLUMNS = new Set(['VARIANT_PRICE', 'VARIANT_COMPARE_AT_PRICE'])

/** How each relation reads after the column ("Title contains …"). */
const RELATION_WORDS: Record<string, string> = {
  EQUALS: 'is equal to',
  NOT_EQUALS: 'is not equal to',
  GREATER_THAN: 'is greater than',
  LESS_THAN: 'is less than',
  STARTS_WITH: 'starts with',
  ENDS_WITH: 'ends with',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'does not contain',
  IS_SET: 'is set',
  IS_NOT_SET: 'is not set',
}

const key = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')

/** "VARIANT_COMPARE_AT_PRICE" → "Variant compare at price" when the column is one we have no name for. */
const plainName = (column: string) => {
  const words = column.replace(/_/g, ' ').toLowerCase().trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
}

/** A tag is "included" rather than "equal to" ("Tag includes b2b"). */
function relationWords(column: string, relation: string): string {
  if (column === 'TAG') {
    if (relation === 'EQUALS') return 'includes'
    if (relation === 'NOT_EQUALS') return 'does not include'
  }
  return RELATION_WORDS[relation] ?? relation.replace(/_/g, ' ').toLowerCase()
}

function valueText(column: string, value: string, currency: string | null | undefined) {
  if (MONEY_COLUMNS.has(column) && /^-?\d+(\.\d+)?$/.test(value)) {
    return formatPrice(value, currency)
  }
  return value
}

/** One display line, and the full text (for the hover) when part of it is cut short. */
export interface ConditionLine {
  text: string
  full: string
}

/**
 * A smart collection's conditions as plain readable lines, like the store admin's:
 * "Tag includes b2b", "Price is greater than £35.00", "Title does not contain Newest". Several
 * tag conditions with the same relation join into one line that names the first two and counts the
 * rest — "Tag includes Category_Food Packaging, Category_Cups & Accessories, +5 more" (the hover
 * text has them all). A condition the answer gives no column or relation for falls back to its own
 * value as the backend wrote it; blank ones are left out. A manual collection has none.
 */
export function conditionLines(
  collection: Pick<CollectionListItem, 'rule_set' | 'shop'>,
): ConditionLine[] {
  const currency = collection.shop?.currency
  const lines: ConditionLine[] = []
  // The line a tag condition joins, by its relation.
  const tagLines = new Map<string, { relation: string; values: string[]; at: number }>()

  for (const item of collection.rule_set?.conditions ?? []) {
    const value = (item.condition ?? '').trim()
    const column = key(item.column)
    const relation = key(item.relation)
    const hasShape = column !== '' && relation !== ''
    const noValue = relation === 'IS_SET' || relation === 'IS_NOT_SET'
    if (!hasShape) {
      if (value) lines.push({ text: value, full: value })
      continue
    }
    if (!value && !noValue && !(column === 'IS_PRICE_REDUCED')) continue

    if (column === 'TAG' && value) {
      const joined = tagLines.get(relation)
      if (joined) {
        if (!joined.values.includes(value)) joined.values.push(value)
      } else {
        tagLines.set(relation, { relation, values: [value], at: lines.length })
        lines.push({ text: '', full: '' }) // filled below, once every tag is known
      }
      continue
    }

    const name = COLUMN_NAMES[column] ?? plainName(column)
    const words = relationWords(column, relation)
    const text =
      column === 'IS_PRICE_REDUCED'
        ? value.toLowerCase() === 'false'
          ? 'Price is not reduced'
          : 'Price is reduced'
        : noValue
          ? `${name} ${words}`
          : `${name} ${words} ${valueText(column, value, currency)}`
    lines.push({ text, full: text })
  }

  for (const { relation, values, at } of tagLines.values()) {
    const words = relationWords('TAG', relation)
    const shown = values.slice(0, VALUES_SHOWN).join(', ')
    const more = values.length - VALUES_SHOWN
    lines[at] = {
      text: `Tag ${words} ${shown}${more > 0 ? `, +${more} more` : ''}`,
      full: `Tag ${words} ${values.join(', ')}`,
    }
  }
  return lines
}
