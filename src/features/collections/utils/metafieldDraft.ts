import { sanitizeHtml } from '../../../lib/sanitizeHtml.ts'
import {
  isHtmlInput,
  isListInput,
  isReferenceInput,
  type MetafieldDefinition,
  type MetafieldValue,
} from '../../../lib/api/collectionMetafields.ts'
import type { CollectionMetafieldWrite } from '../../../lib/api/endpoints.ts'

/**
 * The collection metafields the forms and the details page show: the FAQ, the description and the short
 * description — the ones whose key or name has `faq` or `description` in it. The store's other
 * metafields are left out on purpose; their names and editors still come from the backend's list.
 */
const SHOWN_WORDS = ['faq', 'description']

export function isShownMetafield(definition: Pick<MetafieldDefinition, 'key' | 'name'>) {
  const words = `${definition.key} ${definition.name}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return SHOWN_WORDS.some((word) => words.includes(word))
}

/** A chosen entry of a reference metafield: its id (what is saved) and the name shown. */
export interface ChosenEntry {
  id: string
  name: string
}

/** What a form holds for one metafield: the text (HTML for rich text) or the chosen entries. */
export interface MetafieldDraft {
  text: string
  entries: ChosenEntry[]
}

/** The form's values by the metafield's `namespace.key`. */
export type MetafieldDrafts = Record<string, MetafieldDraft>

export const blankMetafieldDraft = (): MetafieldDraft => ({ text: '', entries: [] })

/** True when nothing is filled in (a rich text editor left with only an empty paragraph counts as empty). */
export function isMetafieldEmpty(
  definition: MetafieldDefinition,
  draft?: MetafieldDraft,
) {
  if (!draft) return true
  if (isReferenceInput(definition)) return draft.entries.length === 0
  if (isHtmlInput(definition)) {
    return (
      draft.text
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim() === ''
    )
  }
  return draft.text.trim() === ''
}

/** One value as `POST /collections` / `PUT /collections/{ref}` take it. Rich text goes through `sanitizeHtml`. */
export function metafieldWrite(
  definition: MetafieldDefinition,
  draft: MetafieldDraft | undefined,
): CollectionMetafieldWrite {
  const empty = isMetafieldEmpty(definition, draft)
  let value: string | string[]
  if (isReferenceInput(definition)) {
    const ids = empty ? [] : (draft?.entries.map((entry) => entry.id) ?? [])
    value = isListInput(definition) ? ids : (ids[0] ?? '')
  } else if (isHtmlInput(definition)) {
    value = empty ? '' : sanitizeHtml(draft?.text ?? '').trim()
  } else {
    value = empty ? '' : (draft?.text ?? '').trim()
  }
  return { namespace: definition.namespace, key: definition.key, value }
}

/** For Add collection: only the metafields something was typed or chosen in. */
export function newMetafieldWrites(
  definitions: readonly MetafieldDefinition[],
  drafts: MetafieldDrafts,
): CollectionMetafieldWrite[] {
  return definitions
    .filter(
      (definition) =>
        definition.editable && !isMetafieldEmpty(definition, drafts[definition.id]),
    )
    .map((definition) => metafieldWrite(definition, drafts[definition.id]))
}

/** The draft of a metafield a collection already has (names of the entries as far as they are known). */
export function draftFromValue(
  definition: MetafieldDefinition,
  value: MetafieldValue | undefined,
  names: ReadonlyMap<string, string>,
): MetafieldDraft {
  if (!value) return blankMetafieldDraft()
  if (isReferenceInput(definition)) {
    return {
      text: '',
      entries: value.ids.map((id) => ({ id, name: names.get(id) ?? id })),
    }
  }
  return { text: value.text, entries: [] }
}

/** For the details page: only the metafields that differ from what the collection has now. */
export function changedMetafieldWrites(
  definitions: readonly MetafieldDefinition[],
  before: MetafieldDrafts,
  after: MetafieldDrafts,
): CollectionMetafieldWrite[] {
  return definitions
    .filter((definition) => definition.editable)
    .filter((definition) => {
      const a = metafieldWrite(definition, before[definition.id])
      const b = metafieldWrite(definition, after[definition.id])
      return JSON.stringify(a.value) !== JSON.stringify(b.value)
    })
    .map((definition) => metafieldWrite(definition, after[definition.id]))
}
