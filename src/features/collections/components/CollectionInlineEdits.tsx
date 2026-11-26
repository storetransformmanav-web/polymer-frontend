import { useState, type ComponentType, type ReactNode } from 'react'
import { DetailSection } from '../../../components/ui/DetailSection.tsx'
import { DoubleClickEdit } from '../../../components/ui/DoubleClickEdit.tsx'
import { IconAction } from '../../../components/ui/IconAction.tsx'
import {
  CheckIcon,
  type IconProps,
  PencilIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import type { CollectionUpdateBody } from '../../../lib/api/endpoints.ts'
import {
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  sortOrderLabel,
  TITLE_MAX,
  type DraftErrors,
} from '../utils/collectionDraft.ts'
import { fieldErrorsFrom } from '../utils/fieldErrors.ts'
import { CollectionConfirm } from './CollectionConfirm.tsx'

/** Sends one change (`PUT /collections/{id}`); throws the backend's refusal. */
export type SaveCollection = (body: CollectionUpdateBody) => Promise<void>

/** What the question shows: "Title: Old → New". */
interface Change {
  label: string
  from: string
  to: string
}

const show = (value: string) => (value.trim() === '' ? '—' : value)

/** "Are you sure?" with the change in a card (old struck through → new), as on a product's page. */
function ChangeQuestion({
  title,
  change,
  note,
  onConfirm,
  onClose,
}: {
  title: string
  change: Change
  note?: string
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  return (
    <CollectionConfirm
      title={title}
      confirmLabel="Yes, update"
      onConfirm={onConfirm}
      onClose={onClose}
    >
      <p className="m-0 font-semibold">Are you sure you want to update this?</p>
      <p className="text-text-muted m-0">
        These changes will also be updated in Shopify.
      </p>
      <div className="border-border bg-surface border-l-accent mt-1 rounded-lg border border-l-4 px-3 py-2">
        <p className="text-text-muted m-0 text-[0.7rem] font-bold tracking-wide uppercase">
          {change.label}
        </p>
        <p className="m-0 break-words whitespace-pre-wrap">
          <span className="text-text-muted line-through">{show(change.from)}</span>
          {' → '}
          <strong>{show(change.to)}</strong>
        </p>
      </div>
      {note && <p className="text-text-muted m-0 text-[0.8rem]">{note}</p>}
    </CollectionConfirm>
  )
}

/** The text values a pencil can change in place. */
export type CollectionTextField =
  'title' | 'handle' | 'seo_title' | 'seo_description' | 'image_alt'

const TEXT_NAMES: Record<CollectionTextField, string> = {
  title: 'Title',
  handle: 'URL handle',
  seo_title: 'Page title',
  seo_description: 'Meta description',
  image_alt: 'Alt text',
}

const TEXT_LIMITS: Partial<Record<CollectionTextField, number>> = {
  title: TITLE_MAX,
  seo_title: SEO_TITLE_MAX,
  seo_description: SEO_DESCRIPTION_MAX,
}

function textProblem(field: CollectionTextField, value: string): string | null {
  const text = value.trim()
  if (field === 'title' && !text) return 'A collection needs a title.'
  if (field === 'handle') {
    if (!text) return 'A collection needs a URL handle.'
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text)) {
      return 'Use lower-case letters, numbers and dashes only (e.g. juice-bottles).'
    }
  }
  const max = TEXT_LIMITS[field]
  if (max !== undefined && text.length > max) return `At most ${max} characters.`
  return null
}

/**
 * A text value with a small pencil, changed where it is shown (like a product's SEO title): the
 * pencil, a double-click or Enter turn it into a box; Enter asks "Are you sure?" with old → new,
 * and only "Yes, update" sends that one field. Without the manage permission it is plain text.
 */
export function CollectionTextValue({
  field,
  value,
  canEdit,
  onSave,
  collectionTitle,
  display,
}: {
  field: CollectionTextField
  value: string
  canEdit: boolean
  onSave: SaveCollection
  collectionTitle: string
  /** How the value is shown (defaults to the text, or a dash). */
  display?: ReactNode
}) {
  const [asking, setAsking] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const shown = display ?? (
    <span
      className={`break-words ${field === 'seo_description' ? 'whitespace-pre-wrap' : ''} ${value.trim() ? '' : 'text-text-muted'}`}
    >
      {show(value)}
    </span>
  )
  if (!canEdit) return <>{shown}</>
  return (
    <>
      <DoubleClickEdit
        value={value}
        label={TEXT_NAMES[field]}
        showIcon
        busy={sending}
        maxLength={TEXT_LIMITS[field]}
        // The meta description is a few sentences: a text area, not a one-line box.
        multiline={field === 'seo_description'}
        validate={(next) => textProblem(field, next)}
        onCommit={(next) => {
          if (next.trim() !== value.trim()) setAsking(next.trim())
        }}
        display={shown}
      />
      {asking !== null && (
        <ChangeQuestion
          title={`Update “${collectionTitle}”?`}
          change={{ label: TEXT_NAMES[field], from: value, to: asking }}
          note={
            field === 'handle'
              ? 'The old address will redirect to the new one.'
              : undefined
          }
          onClose={() => setAsking(null)}
          onConfirm={async () => {
            setSending(true)
            try {
              await onSave(
                field === 'handle'
                  ? { handle: asking, redirect_old_handle: true }
                  : { [field]: asking },
              )
              setAsking(null)
            } finally {
              setSending(false)
            }
          }}
        />
      )}
    </>
  )
}

/**
 * The product order as a dropdown of Shopify's orders (from the rule options); choosing another
 * asks "Are you sure?" first and only "Yes, update" sends `sort_order`. It keeps showing the saved
 * order until then, so cancelling leaves it as it was. Without the manage permission it is text.
 */
export function SortOrderValue({
  value,
  sortOrders,
  canEdit,
  onSave,
  collectionTitle,
}: {
  value: string
  sortOrders: readonly string[]
  canEdit: boolean
  onSave: SaveCollection
  collectionTitle: string
}) {
  const [asking, setAsking] = useState<string | null>(null)
  if (!canEdit) return <>{sortOrderLabel(value)}</>

  const options: SelectOption[] = sortOrders.map((code) => ({
    value: code,
    label: sortOrderLabel(code),
  }))
  // The saved order is always listed, even before the choices have arrived.
  if (!sortOrders.includes(value)) {
    options.unshift({ value, label: sortOrderLabel(value) })
  }

  return (
    <>
      <span className="block w-56 max-w-full">
        <SelectField
          compact
          hideLabel
          id="collection-sort-order-inline"
          label="Product order"
          value={value}
          options={options}
          disabled={sortOrders.length === 0}
          onChange={(next) => {
            if (next !== value) setAsking(next)
          }}
        />
      </span>
      {asking !== null && (
        <ChangeQuestion
          title={`Update “${collectionTitle}”?`}
          change={{
            label: 'Product order',
            from: sortOrderLabel(value),
            to: sortOrderLabel(asking),
          }}
          onClose={() => setAsking(null)}
          onConfirm={async () => {
            await onSave({ sort_order: asking })
            setAsking(null)
          }}
        />
      )}
    </>
  )
}

/**
 * A section card whose title row has a pencil (like a product's Description card): the pencil
 * turns the card's content into its fields, with ✓ Save (off until something changed) and ✕
 * Discard; Escape discards. Save checks the fields, asks first and sends only this card's changes.
 */
export function EditableCard<T>({
  title,
  icon,
  count,
  defaultOpen,
  canEdit,
  start,
  build,
  validate,
  view,
  editor,
  collectionTitle,
  onSave,
}: {
  title: string
  icon: ComponentType<IconProps>
  count?: number
  defaultOpen?: boolean
  canEdit: boolean
  /** The draft the editor starts from (taken when the pencil is pressed). */
  start: () => T
  /** The request for this draft — empty when nothing changed. */
  build: (draft: T) => CollectionUpdateBody
  /** Problems in the draft, by field. */
  validate?: (draft: T) => DraftErrors
  view: ReactNode
  editor: (draft: T, change: (next: T) => void, errors: DraftErrors) => ReactNode
  collectionTitle: string
  onSave: SaveCollection
}) {
  const [draft, setDraft] = useState<T | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [serverErrors, setServerErrors] = useState<DraftErrors>({})
  const [asking, setAsking] = useState<CollectionUpdateBody | null>(null)
  const editing = draft !== null
  const body = draft ? build(draft) : {}
  const dirty = Object.keys(body).length > 0
  const problems = draft && validate ? validate(draft) : {}
  const errors: DraftErrors = { ...(showErrors ? problems : {}), ...serverErrors }

  function discard() {
    setDraft(null)
    setShowErrors(false)
    setServerErrors({})
  }

  function save() {
    setShowErrors(true)
    if (Object.keys(problems).length > 0) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      )
      return
    }
    if (dirty) setAsking(body)
  }

  const actions = !canEdit ? null : editing ? (
    <>
      <IconAction
        label="Save"
        accessibleLabel={`Save ${title.toLowerCase()}`}
        icon={CheckIcon}
        tone="primary"
        disabled={!dirty}
        onClick={save}
      />
      <IconAction
        label="Discard"
        accessibleLabel={`Discard ${title.toLowerCase()} changes`}
        icon={XIcon}
        tone="danger"
        onClick={discard}
      />
    </>
  ) : (
    <IconAction
      label="Edit"
      accessibleLabel={`Edit ${title.toLowerCase()}`}
      icon={PencilIcon}
      onClick={() => {
        setDraft(start())
        setShowErrors(false)
        setServerErrors({})
      }}
    />
  )

  return (
    <>
      <DetailSection
        tinted
        compact
        title={title}
        icon={icon}
        count={count}
        defaultOpen={defaultOpen}
        forceOpen={editing}
        actions={actions}
      >
        <div
          onKeyDown={(event) => {
            if (event.key === 'Escape' && editing && !asking) discard()
          }}
        >
          {draft
            ? editor(
                draft,
                (next) => {
                  setServerErrors({})
                  setDraft(next)
                },
                errors,
              )
            : view}
        </div>
      </DetailSection>
      {asking && (
        <CollectionConfirm
          title={`Update “${collectionTitle}”?`}
          confirmLabel="Yes, update"
          onClose={() => setAsking(null)}
          onConfirm={async () => {
            try {
              await onSave(asking)
              setAsking(null)
              discard()
            } catch (error) {
              setServerErrors(fieldErrorsFrom(error))
              throw error
            }
          }}
        >
          <p className="m-0 font-semibold">Are you sure you want to update this?</p>
          <p className="text-text-muted m-0">
            These changes will also be updated in Shopify.
          </p>
          <p className="text-text-muted m-0 text-[0.8rem]">Changing: {title}.</p>
        </CollectionConfirm>
      )}
    </>
  )
}
