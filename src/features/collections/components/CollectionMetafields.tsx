import { useMemo, useState } from 'react'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import {
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  TagIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { RichTextEditor } from '../../../components/ui/RichTextEditor.tsx'
import { SafeHtml } from '../../../components/ui/SafeHtml.tsx'
import { SuggestInput } from '../../../components/ui/SuggestInput.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import {
  isHtmlInput,
  isListInput,
  isReferenceInput,
  readCollectionMetafieldValues,
  type MetafieldDefinition,
} from '../../../lib/api/collectionMetafields.ts'
import type { CollectionDetail } from '../../../lib/api/endpoints.ts'
import {
  useCreateMetafieldDefinition,
  useMetafieldDefinitions,
  useMetaobjectNames,
  useMetaobjects,
} from '../hooks/useCollections.ts'
import {
  changedMetafieldWrites,
  draftFromValue,
  type ChosenEntry,
  type MetafieldDraft,
  type MetafieldDrafts,
} from '../utils/metafieldDraft.ts'
import { CollectionConfirm } from './CollectionConfirm.tsx'
import { FormCard, INPUT } from './CollectionFormParts.tsx'
import { EditableCard, type SaveCollection } from './CollectionInlineEdits.tsx'

// Everything here is written in small type, like the rest of the collection forms.
const LABEL = 'text-[0.76rem] font-semibold'
const HINT = 'text-text-muted text-[0.7rem] leading-snug'
const SMALL_INPUT = `${INPUT} h-8 text-[0.76rem]`

/** A line of an entry in the list: its name, and its first text field under it. */
const entryLine = (fields: [string, string][]) => fields[0]?.[1] ?? ''

/**
 * Pick the entries of a reference metafield (the FAQ entries…): a search box that opens a scrolling list
 * of **every entry the backend offers for this metafield** (`GET /collections/metaobjects`, 50 at a
 * time, the next page as the list is scrolled), narrowed as you type. Ticking adds an entry (a single
 * reference replaces the old one); the chosen ones show below by name, each with a ✕. An entry whose
 * name is not known yet (a saved one) is looked up by its id.
 */
function EntryPicker({
  shop,
  definition,
  entries,
  onChange,
  id,
}: {
  shop: string
  definition: MetafieldDefinition
  entries: ChosenEntry[]
  onChange: (entries: ChosenEntry[]) => void
  id: string
}) {
  const many = isListInput(definition)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [typed, setTyped] = useDebouncedField(search, setSearch)
  const list = useMetaobjects(shop, definition.id, search, open)
  const chosen = new Set(entries.map((entry) => entry.id))

  // Saved entries come with their ids only: their names are asked for.
  const unresolved = entries
    .filter((entry) => entry.name === entry.id)
    .map((entry) => entry.id)
  const known = useMetaobjectNames(shop, definition.id, unresolved).items
  const nameOf = (entry: ChosenEntry) =>
    known.find((item) => item.id === entry.id)?.name ?? entry.name

  function toggle(entry: ChosenEntry) {
    if (chosen.has(entry.id)) {
      onChange(entries.filter((other) => other.id !== entry.id))
    } else {
      onChange(many ? [...entries, entry] : [entry])
      if (!many) setOpen(false)
    }
  }

  return (
    <div
      className="flex flex-col gap-2"
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <label className="border-border bg-surface focus-within:border-accent flex h-8 items-center gap-2 rounded-lg border px-2.5">
        <SearchIcon width={14} height={14} className="text-text-muted shrink-0" />
        <span className="sr-only">Search {definition.name}</span>
        <input
          id={id}
          type="search"
          value={typed}
          maxLength={100}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={`Search ${definition.name.toLowerCase()}…`}
          className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.76rem] outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {list.isFetching && (
          <SpinnerIcon width={12} height={12} className="text-text-muted animate-spin" />
        )}
      </label>

      {open && (
        <div
          tabIndex={-1}
          onScroll={(event) => {
            const box = event.currentTarget
            if (
              list.hasMore &&
              !list.isFetching &&
              box.scrollTop + box.clientHeight >= box.scrollHeight - 40
            ) {
              list.fetchMore()
            }
          }}
          className="border-border max-h-60 overflow-y-auto rounded-lg border outline-none"
        >
          {list.error ? (
            <p role="alert" className="text-danger m-0 px-3 py-3 text-[0.74rem]">
              {list.error}
            </p>
          ) : list.items.length === 0 ? (
            <p className="text-text-muted m-0 px-3 py-3 text-center text-[0.74rem]">
              {list.isFetching
                ? 'Loading…'
                : search.trim()
                  ? 'No entry matches.'
                  : 'No entries.'}
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {list.items.map((item) => (
                <li key={item.id} className="border-border border-b last:border-b-0">
                  <label className="hover:bg-accent-tint/40 flex cursor-pointer items-start gap-2.5 px-3 py-2">
                    <input
                      type={many ? 'checkbox' : 'radio'}
                      name={`${id}-entry`}
                      checked={chosen.has(item.id)}
                      onChange={() => toggle({ id: item.id, name: item.name })}
                      className="accent-accent mt-0.5 h-3.5 w-3.5 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.76rem] font-semibold">
                        {item.name}
                      </span>
                      {entryLine(item.fields) && (
                        <span className="text-text-muted line-clamp-2 block text-[0.7rem]">
                          {entryLine(item.fields)}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {list.items.length > 0 && (
            <div className="border-border bg-bg text-text-muted sticky bottom-0 flex items-center justify-between border-t px-3 py-1.5 text-[0.7rem]">
              <span>{list.items.length.toLocaleString('en-GB')} shown</span>
              {list.isFetchingMore ? (
                <span className="flex items-center gap-1">
                  <SpinnerIcon width={11} height={11} className="animate-spin" />
                  Loading more…
                </span>
              ) : list.hasMore ? (
                <span>Scroll for more</span>
              ) : null}
            </div>
          )}
        </div>
      )}

      {entries.length > 0 && (
        <ul
          className="m-0 flex list-none flex-wrap gap-1.5 p-0"
          aria-label={`Chosen ${definition.name}`}
        >
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="bg-accent-tint text-accent inline-flex max-w-full items-center gap-1 rounded-full py-0.5 pr-1.5 pl-2.5 text-[0.72rem] font-semibold"
            >
              <span className="truncate">{nameOf(entry)}</span>
              <button
                type="button"
                aria-label={`Remove ${nameOf(entry)}`}
                onClick={() => onChange(entries.filter((other) => other.id !== entry.id))}
                className="hover:bg-accent hover:text-accent-contrast flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current"
              >
                <XIcon width={10} height={10} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * One metafield: a **reference** one (the FAQ entries…) is a row — its name and hint on the left,
 * the search box that picks entries on the right —; any other is its name over its editor (rich
 * text or a text box), so two sit side by side in `MetafieldsEditor`.
 */
function MetafieldField({
  shop,
  definition,
  draft,
  onChange,
  idPrefix,
}: {
  shop: string
  definition: MetafieldDefinition
  draft: MetafieldDraft
  onChange: (draft: MetafieldDraft) => void
  idPrefix: string
}) {
  const id = `${idPrefix}-${definition.key}`
  const reference = isReferenceInput(definition)
  const heading = (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={id} className={`${LABEL} text-[0.8rem]`}>
        {definition.name}
      </label>
      {definition.description && (
        <p className={`${HINT} m-0`}>{definition.description}</p>
      )}
    </div>
  )
  if (reference) {
    return (
      <div className="flex flex-col gap-2 @lg:flex-row @lg:items-start @lg:gap-4">
        <div className="@lg:w-60 @lg:shrink-0 @lg:pt-1">{heading}</div>
        <div className="min-w-0 flex-1">
          <EntryPicker
            shop={shop}
            definition={definition}
            entries={draft.entries}
            onChange={(entries) => onChange({ ...draft, entries })}
            id={id}
          />
        </div>
      </div>
    )
  }
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {heading}
      {isHtmlInput(definition) ? (
        <RichTextEditor
          compact
          id={id}
          label={definition.name}
          value={draft.text}
          onChange={(text) => onChange({ ...draft, text })}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={draft.text}
          onChange={(event) => onChange({ ...draft, text: event.target.value })}
          className={SMALL_INPUT}
        />
      )}
    </div>
  )
}

/**
 * The boxes of every metafield the store lets a collection set, in the backend's order: the
 * reference ones (the FAQ) as rows first, then the rest two to a row.
 */
function MetafieldsEditor({
  shop,
  definitions,
  drafts,
  onChange,
  idPrefix,
}: {
  shop: string
  definitions: MetafieldDefinition[]
  drafts: MetafieldDrafts
  onChange: (drafts: MetafieldDrafts) => void
  idPrefix: string
}) {
  const editable = definitions.filter((definition) => definition.editable)
  const field = (definition: MetafieldDefinition) => (
    <MetafieldField
      key={definition.id}
      shop={shop}
      definition={definition}
      draft={drafts[definition.id] ?? { text: '', entries: [] }}
      onChange={(draft) => onChange({ ...drafts, [definition.id]: draft })}
      idPrefix={idPrefix}
    />
  )
  const references = editable.filter((definition) => isReferenceInput(definition))
  const others = editable.filter((definition) => !isReferenceInput(definition))
  return (
    <div className="@container flex min-w-0 flex-col gap-4">
      {references.map(field)}
      {others.length > 0 && (
        <div className="grid grid-cols-1 items-start gap-4 @2xl:grid-cols-2">
          {others.map(field)}
        </div>
      )}
    </div>
  )
}

/**
 * "Add definition": a new metafield for collections in the store (`POST /collections/metafield-definitions`
 * `{ name, description, type, shop }`). It is the question itself; the backend's own words answer it
 * (its message, or its refusal inside the dialog). The type box suggests the types the store's
 * existing metafields already use.
 */
function AddDefinitionDialog({
  shop,
  types,
  onClose,
  onCreated,
}: {
  shop: string
  types: string[]
  onClose: () => void
  onCreated: (message: string) => void
}) {
  const { create } = useCreateMetafieldDefinition()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('')
  return (
    <CollectionConfirm
      title="Add a metafield?"
      confirmLabel="Yes, add"
      onClose={onClose}
      onConfirm={async () => {
        const result = await create({
          name: name.trim(),
          description: description.trim() || undefined,
          type: type.trim(),
          shop,
        })
        onCreated(result.message)
        onClose()
      }}
    >
      <div className="flex flex-col gap-3 text-left">
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={255}
            className={SMALL_INPUT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Description</span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
            className={SMALL_INPUT}
          />
        </label>
        <div className="flex flex-col gap-1">
          <label htmlFor="new-metafield-type" className={LABEL}>
            Type
          </label>
          <SuggestInput
            asSelect
            id="new-metafield-type"
            value={type}
            onChange={setType}
            suggestions={types}
            placeholder="e.g. rich_text_field"
            maxLength={100}
            className={`${SMALL_INPUT} pr-9`}
          />
        </div>
      </div>
    </CollectionConfirm>
  )
}

/**
 * **Metafields** of the Add collection form: a box for every metafield the store has for collections
 * (the short description, the FAQ entries…) as the backend lists them (`GET /collections/metafield-definitions`),
 * each with the editor its `input` asks for — rich text, a list of entries to pick, or plain text.
 * **Add definition** makes a new metafield in the store. Only the boxes that are filled in are sent.
 */
export function MetafieldsCard({
  shop,
  drafts,
  onChange,
}: {
  shop: string
  drafts: MetafieldDrafts
  onChange: (drafts: MetafieldDrafts) => void
}) {
  const { definitions, allDefinitions, isPending, error, retry } =
    useMetafieldDefinitions(shop)
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const types = useMemo(
    () => [
      ...new Set(allDefinitions.map((definition) => definition.type).filter(Boolean)),
    ],
    [allDefinitions],
  )

  return (
    <FormCard
      icon={TagIcon}
      title="Metafields"
      actions={
        <button
          type="button"
          disabled={!shop}
          onClick={() => setAdding(true)}
          className="border-border bg-bg text-text hover:border-accent inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.78rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
        >
          <PlusIcon width={13} height={13} />
          Add definition
        </button>
      }
    >
      {notice && <FormMessage tone="success">{notice}</FormMessage>}
      {error ? (
        <div className="flex flex-col items-start gap-2">
          <FormMessage tone="error">{error}</FormMessage>
          <button
            type="button"
            onClick={retry}
            className="border-border bg-bg text-text hover:border-accent h-8 cursor-pointer rounded-lg border px-3 text-[0.78rem] font-semibold"
          >
            Try again
          </button>
        </div>
      ) : isPending ? (
        <p className="text-text-muted m-0 flex items-center gap-2 text-[0.76rem]">
          <SpinnerIcon width={13} height={13} className="animate-spin" />
          Loading the metafields…
        </p>
      ) : definitions.some((definition) => definition.editable) ? (
        <MetafieldsEditor
          shop={shop}
          definitions={definitions}
          drafts={drafts}
          onChange={onChange}
          idPrefix="new-collection-metafield"
        />
      ) : (
        <p className="text-text-muted m-0 text-[0.76rem]">
          The store has no metafields for collections yet.
        </p>
      )}
      {adding && (
        <AddDefinitionDialog
          shop={shop}
          types={types}
          onClose={() => setAdding(false)}
          onCreated={setNotice}
        />
      )}
    </FormCard>
  )
}

/** The entries a saved reference metafield points at, by name (the ids while the names load). */
function SavedEntries({
  shop,
  definition,
  ids,
}: {
  shop: string
  definition: MetafieldDefinition
  ids: string[]
}) {
  const names = useMetaobjectNames(shop, definition.id, ids)
  if (names.error) {
    return (
      <p role="alert" className="text-danger m-0 text-[0.76rem]">
        {names.error}
      </p>
    )
  }
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {ids.map((id) => (
        <li
          key={id}
          className="bg-accent-tint text-accent rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold"
        >
          {names.items.find((item) => item.id === id)?.name ??
            (names.isLoading ? '…' : id)}
        </li>
      ))}
    </ul>
  )
}

/** One metafield's saved value: its name over the value (entries by name, rich text in a small scrolling box, text as it is). */
function MetafieldValue({
  shop,
  definition,
  value,
}: {
  shop: string
  definition: MetafieldDefinition
  value: ReturnType<typeof readCollectionMetafieldValues> extends Map<string, infer V>
    ? V | undefined
    : never
}) {
  const filled = isReferenceInput(definition)
    ? (value?.ids.length ?? 0) > 0
    : Boolean(value?.text.trim())
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="text-text-muted text-[0.68rem] font-bold tracking-wide uppercase">
        {definition.name}
      </dt>
      <dd className="m-0 min-w-0 text-[0.82rem] break-words">
        {!filled || !value ? (
          <span className="text-text-muted">—</span>
        ) : isReferenceInput(definition) ? (
          <SavedEntries shop={shop} definition={definition} ids={value.ids} />
        ) : isHtmlInput(definition) ? (
          // A long saved value scrolls inside its own short box, with small headings, so it never stretches the card.
          <SafeHtml
            html={value.text}
            className="border-border bg-surface max-h-28 overflow-y-auto rounded-lg border px-3 py-2 text-[0.82rem] leading-relaxed [&_h1]:text-[0.92rem] [&_h2]:text-[0.88rem] [&_h3]:text-[0.84rem] [&_p]:my-1.5"
          />
        ) : (
          value.text
        )}
      </dd>
    </div>
  )
}

/**
 * The saved values of a collection's metafields in two columns with a thin rule between them (one
 * column when the card is narrow): the 1st, 3rd… metafield on the left, the 2nd, 4th… on the right,
 * each left one divided from the next by a line.
 */
function MetafieldValues({
  shop,
  definitions,
  values,
}: {
  shop: string
  definitions: MetafieldDefinition[]
  values: ReturnType<typeof readCollectionMetafieldValues>
}) {
  const left = definitions.filter((_, index) => index % 2 === 0)
  const right = definitions.filter((_, index) => index % 2 === 1)
  const column = (items: MetafieldDefinition[]) => (
    <dl className="m-0 flex min-w-0 flex-col gap-3">
      {items.map((definition, index) => (
        <div
          key={definition.id}
          className={index > 0 ? 'border-border border-t pt-3' : undefined}
        >
          <MetafieldValue
            shop={shop}
            definition={definition}
            value={values.get(definition.id)}
          />
        </div>
      ))}
    </dl>
  )
  return (
    <div className="@container min-w-0">
      <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2 @3xl:gap-0">
        <div className="@3xl:pr-6">{column(left)}</div>
        {right.length > 0 && (
          <div className="border-border @3xl:border-l @3xl:pl-6">{column(right)}</div>
        )}
      </div>
    </div>
  )
}

/**
 * **Metafields** on a collection's details page: every metafield the store has for collections
 * (as the backend lists them) with what this collection has saved in it — rich text drawn through
 * `SafeHtml`, entries (the FAQ…) by name, anything else as text, a dash when empty. The pencil
 * (with `products` manage) opens the same boxes as Add collection and sends only the ones that
 * changed (`PUT /collections/{ref}` `{ metafields }`, an empty one clears it) after the usual question.
 */
export function CollectionMetafieldsPanel({
  collection,
  canManage,
  onSave,
}: {
  collection: CollectionDetail
  canManage: boolean
  onSave: SaveCollection
}) {
  const shop = collection.shop?.key ?? ''
  const { definitions, isPending, error } = useMetafieldDefinitions(shop)
  const values = useMemo(
    () => readCollectionMetafieldValues(collection.metafields),
    [collection.metafields],
  )
  const noNames = useMemo(() => new Map<string, string>(), [])
  const drafts = (): MetafieldDrafts =>
    Object.fromEntries(
      definitions.map((definition) => [
        definition.id,
        draftFromValue(definition, values.get(definition.id), noNames),
      ]),
    )

  return (
    <EditableCard<MetafieldDrafts>
      title="Metafields"
      icon={TagIcon}
      canEdit={canManage && definitions.some((definition) => definition.editable)}
      collectionTitle={collection.title}
      onSave={onSave}
      start={drafts}
      build={(draft) => {
        const metafields = changedMetafieldWrites(definitions, drafts(), draft)
        return metafields.length > 0 ? { metafields } : {}
      }}
      view={
        error ? (
          <p role="alert" className="text-danger m-0 text-[0.8rem]">
            {error}
          </p>
        ) : isPending ? (
          <p className="text-text-muted m-0 text-[0.8rem]">Loading the metafields…</p>
        ) : definitions.length === 0 ? (
          <p className="text-text-muted m-0 text-[0.8rem]">
            The store has no metafields for collections.
          </p>
        ) : (
          <MetafieldValues shop={shop} definitions={definitions} values={values} />
        )
      }
      editor={(draft, change) => (
        <MetafieldsEditor
          shop={shop}
          definitions={definitions}
          drafts={draft}
          onChange={change}
          idPrefix="collection-metafield"
        />
      )}
    />
  )
}
