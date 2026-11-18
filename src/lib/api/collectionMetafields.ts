/**
 * A collection's **metafields**: the definitions the store has for collections
 * (`GET /api/collections/metafield-definitions`), the entries a reference metafield can pick
 * (`GET /api/collections/metaobjects`, e.g. the FAQ entries), the one a person adds
 * (`POST /api/collections/metafield-definitions`) and the values a collection has. The backend's
 * answers are read leniently (a few likely spellings each) and **nothing about a metafield's name,
 * type or choices is written in the app** — it all comes from these answers.
 */

type Raw = Record<string, unknown>
const isRaw = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown): string =>
  typeof value === 'string'
    ? value.trim()
    : typeof value === 'number'
      ? String(value)
      : ''

const flag = (value: unknown, otherwise: boolean): boolean =>
  typeof value === 'boolean' ? value : otherwise

/** The first of `names` that holds something. */
function pick(scope: Raw | null | undefined, names: readonly string[]): unknown {
  if (!scope) return undefined
  for (const name of names) {
    const value = scope[name]
    if (value !== null && value !== undefined && value !== '') return value
  }
  return undefined
}

/** A list from the answer itself or from the first of `holders` that is one. */
function listOf(data: unknown, holders: readonly string[]): unknown[] {
  if (Array.isArray(data)) return data
  if (!isRaw(data)) return []
  for (const name of holders) {
    const value = data[name]
    if (Array.isArray(value)) return value
    if (isRaw(value)) {
      const inner = listOf(value, holders)
      if (inner.length > 0) return inner
    }
  }
  return []
}

// ----------------------------------------------------------------------------------- definitions

export interface MetafieldDefinition {
  /** `namespace.key`, the metafield's own address. */
  id: string
  namespace: string
  key: string
  name: string
  description: string
  /** Shopify's type, e.g. `rich_text_field`, `list.metaobject_reference`. */
  type: string
  /** Which editor the website uses: `html` = rich text, `reference_list` = pick several entries… */
  input: string
  category: string
  pinnedPosition: number | null
  /** The metaobject definition a reference metafield picks from. */
  metaobjectDefinitionId: string | null
  /** False for a metafield collections have with no definition in the store. */
  defined: boolean
  editable: boolean
  collectionsWithValue: number | null
}

export function readMetafieldDefinition(raw: unknown): MetafieldDefinition | null {
  if (!isRaw(raw)) return null
  const namespace = text(raw.namespace)
  const key = text(raw.key)
  if (!namespace || !key) return null
  const pinned = raw.pinned_position
  const used = raw.collections_with_value
  return {
    id: `${namespace}.${key}`,
    namespace,
    key,
    name: text(raw.name) || key,
    description: text(raw.description),
    type: text(raw.type),
    input: text(raw.input),
    category: text(raw.category),
    pinnedPosition: typeof pinned === 'number' ? pinned : null,
    metaobjectDefinitionId: text(raw.metaobject_definition_id) || null,
    defined: flag(raw.defined, true),
    editable: flag(raw.editable, true),
    collectionsWithValue: typeof used === 'number' ? used : null,
  }
}

/** The definitions, in the order the backend sends them (Shopify's pinned order, undefined ones last). */
export function readMetafieldDefinitions(data: unknown): MetafieldDefinition[] {
  return listOf(data, ['definitions', 'items', 'metafields', 'result', 'data'])
    .map(readMetafieldDefinition)
    .filter((item): item is MetafieldDefinition => item !== null)
}

/** The answer of `POST /api/collections/metafield-definitions`: the new definition and the backend's message. */
export function readCreatedDefinition(data: unknown): {
  definition: MetafieldDefinition | null
  message: string
} {
  const root = isRaw(data) ? data : {}
  return {
    definition: readMetafieldDefinition(root.definition),
    message: text(root.message),
  }
}

/** A definition that takes entries picked from the store's metaobjects (the FAQ entries…). */
export const isReferenceInput = (definition: Pick<MetafieldDefinition, 'input'>) =>
  definition.input.startsWith('reference')

/** One entry or several (`reference_list`). */
export const isListInput = (definition: Pick<MetafieldDefinition, 'input'>) =>
  definition.input.endsWith('_list') || definition.input === 'reference_list'

/** The rich text editor's kind of metafield. */
export const isHtmlInput = (definition: Pick<MetafieldDefinition, 'input'>) =>
  definition.input === 'html'

// ------------------------------------------------------------------------------------ metaobjects

/** One entry a reference metafield can pick: its id (what is saved), its name and its text fields. */
export interface Metaobject {
  id: string
  name: string
  /** The entry's other text fields, label and value, for a line under its name. */
  fields: [string, string][]
}

export interface MetaobjectPage {
  items: Metaobject[]
  /** `next_cursor`: send it as `after` for the next page; null on the last one. */
  nextCursor: string | null
}

function readMetaobject(raw: unknown): Metaobject | null {
  if (!isRaw(raw)) return null
  const id = text(pick(raw, ['id', 'gid', 'metaobject_id']))
  if (!id) return null
  const name = text(pick(raw, ['name', 'display_name', 'title', 'label', 'handle'])) || id
  const fields: [string, string][] = []
  const given = raw.fields
  if (Array.isArray(given)) {
    for (const field of given) {
      if (!isRaw(field)) continue
      const label = text(pick(field, ['name', 'label', 'key']))
      const value = text(field.value)
      if (label && value) fields.push([label, value])
    }
  } else if (isRaw(given)) {
    for (const [label, value] of Object.entries(given)) {
      const shown = text(value)
      if (shown) fields.push([label, shown])
    }
  }
  return { id, name, fields }
}

export function readMetaobjects(data: unknown): MetaobjectPage {
  const items = listOf(data, [
    'items',
    'metaobjects',
    'entries',
    'nodes',
    'result',
    'data',
  ])
    .map(readMetaobject)
    .filter((item): item is Metaobject => item !== null)
  const root = isRaw(data) ? data : {}
  const paging = isRaw(root.pagination) ? root.pagination : root
  const next = text(pick(paging, ['next_cursor', 'nextCursor', 'end_cursor']))
  const more = paging.has_next ?? paging.has_next_page
  return { items, nextCursor: next && more !== false ? next : null }
}

// ---------------------------------------------------------------------------------------- values

/** What a collection has saved in one metafield: its text / HTML, or the ids of the entries it points at. */
export interface MetafieldValue {
  /** The text (plain, or HTML for a rich text metafield). */
  text: string
  /** The ids of the entries, for a reference metafield (a list, or one). */
  ids: string[]
}

/** The ids in a reference value: a JSON list, a list, or one id. */
function idsOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text).filter(Boolean)
  const shown = text(value)
  if (!shown) return []
  if (shown.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(shown)
      if (Array.isArray(parsed)) return parsed.map(text).filter(Boolean)
    } catch {
      /* not a list: a single value */
    }
  }
  return [shown]
}

/**
 * The metafield values in a collection's details (`collection.metafields`: a list of
 * `{ namespace, key, value, html? }`, or an object keyed `namespace.key`), by `namespace.key`.
 */
export function readCollectionMetafieldValues(raw: unknown): Map<string, MetafieldValue> {
  const values = new Map<string, MetafieldValue>()
  const entries: [string, unknown][] = Array.isArray(raw)
    ? raw.map((item) => [
        isRaw(item) ? `${text(item.namespace)}.${text(item.key)}` : '',
        item,
      ])
    : isRaw(raw)
      ? Object.entries(raw)
      : []
  for (const [id, entry] of entries) {
    if (!id || id === '.') continue
    const holder = isRaw(entry) ? entry : { value: entry }
    const value = pick(holder, ['html', 'value', 'values'])
    values.set(id, { text: Array.isArray(value) ? '' : text(value), ids: idsOf(value) })
  }
  return values
}
