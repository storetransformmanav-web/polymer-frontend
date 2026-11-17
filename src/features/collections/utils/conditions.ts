import type { CollectionListItem } from '../../../lib/api/endpoints.ts'

/** How many conditions the collections table shows before "+ More Conditions". */
export const CONDITIONS_SHOWN = 2

/**
 * A collection's conditions as the backend words them (`rule_set.conditions[].condition`, e.g.
 * "Category_Food Packaging") — never the `label`. A manual collection, or one whose answer has no
 * rules, has none; blank conditions are left out.
 */
export function conditionTexts(
  collection: Pick<CollectionListItem, 'rule_set'>,
): string[] {
  return (collection.rule_set?.conditions ?? [])
    .map((item) => (item.condition ?? '').trim())
    .filter(Boolean)
}
