import { useState } from 'react'
import { RichTextEditor } from '../../../../components/ui/RichTextEditor.tsx'
import {
  ChevronDownIcon,
  InfoIcon,
  ListChecksIcon,
  PlusIcon,
  TrashIcon,
} from '../../../../components/ui/icons.tsx'
import {
  blankSection,
  SECTION_TITLE_MAX,
  type SectionDraft,
} from '../../utils/descriptionSections.ts'
import { EditField, FIELD_INPUT, ICON_BUTTON, type SectionProps } from './fields.tsx'

/** The ready-made starts offered while there are no sections: two named ones and a blank. */
const STARTS = [
  {
    label: 'Add Product Description',
    title: 'Product Description',
    hint: 'What the product is, and why customers will want it.',
    icon: InfoIcon,
  },
  {
    label: 'Add Product Information',
    title: 'Product Information',
    hint: 'Sizes, materials, specifications and care.',
    icon: ListChecksIcon,
  },
  {
    label: 'Add section',
    title: '',
    hint: 'Any other heading, such as Delivery or Returns.',
    icon: PlusIcon,
  },
] as const

const OUTLINE_BUTTON =
  'border-border bg-bg text-text hover:border-accent hover:text-accent inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.8rem] font-semibold transition-colors'

/**
 * The description sections (Product Description, Product Information…) being edited: each has a
 * title and formatted text, and they can be reordered, removed one by one, **all deleted at once**
 * and added. Used by the details page (saved as the product's `apd` metafield) and by the Add
 * product form (sent with the new product).
 */
export function SectionsEditor({
  sections,
  errors,
  onChange,
  idPrefix,
}: {
  sections: SectionDraft[]
  /** `descriptionSections.<i>.title` problems, and `descriptionSections` for the whole. */
  errors: Record<string, string>
  onChange: (next: SectionDraft[]) => void
  /** Keeps element ids apart when two editors are on a page. */
  idPrefix: string
}) {
  const [deletingAll, setDeletingAll] = useState(false)
  const change = (index: number, patch: Partial<SectionDraft>) =>
    onChange(sections.map((item, at) => (at === index ? { ...item, ...patch } : item)))

  function move(index: number, by: -1 | 1) {
    const target = index + by
    if (target < 0 || target >= sections.length) return
    const next = [...sections]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-4">
      {sections.length === 0 && (
        <div className="flex flex-col gap-2.5">
          <p className="text-text-muted m-0 text-[0.82rem]">
            No sections yet. Start with one:
          </p>
          <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-3">
            {STARTS.map((start) => (
              <button
                key={start.label}
                type="button"
                aria-label={start.label}
                onClick={() =>
                  onChange([...sections, { ...blankSection(), title: start.title }])
                }
                className="border-border-strong bg-bg hover:border-accent hover:bg-accent-tint/40 flex cursor-pointer flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-colors"
              >
                <span className="bg-accent-tint text-accent flex h-8 w-8 items-center justify-center rounded-lg">
                  <start.icon width={16} height={16} />
                </span>
                <span className="text-text text-[0.88rem] font-semibold">
                  {start.title || 'Another section'}
                </span>
                <span className="text-text-muted text-[0.78rem] leading-snug">
                  {start.hint}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {sections.map((section, index) => {
        const titleId = `${idPrefix}-section-title-${section.key}`
        const contentId = `${idPrefix}-section-content-${section.key}`
        const titleError = errors[`descriptionSections.${index}.title`]
        const name = section.title.trim() || `section ${index + 1}`
        return (
          <fieldset
            key={section.key}
            className="border-border bg-bg flex min-w-0 flex-col gap-3 rounded-xl border p-3.5"
          >
            <legend className="sr-only">Section {index + 1}</legend>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <EditField
                  id={titleId}
                  label="Title"
                  error={titleError}
                  counter={{ value: section.title.trim().length, max: SECTION_TITLE_MAX }}
                >
                  <input
                    id={titleId}
                    autoComplete="off"
                    value={section.title}
                    aria-invalid={titleError ? true : undefined}
                    onChange={(event) => change(index, { title: event.target.value })}
                    className={FIELD_INPUT}
                  />
                </EditField>
              </div>
              <div className="flex shrink-0 items-center pb-1">
                <button
                  type="button"
                  aria-label={`Move ${name} up`}
                  title="Move up"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className={ICON_BUTTON}
                >
                  <ChevronDownIcon width={16} height={16} className="rotate-180" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${name} down`}
                  title="Move down"
                  disabled={index === sections.length - 1}
                  onClick={() => move(index, 1)}
                  className={ICON_BUTTON}
                >
                  <ChevronDownIcon width={16} height={16} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${name}`}
                  title="Remove section"
                  onClick={() => onChange(sections.filter((_, at) => at !== index))}
                  className={`${ICON_BUTTON} hover:text-danger`}
                >
                  <TrashIcon width={16} height={16} />
                </button>
              </div>
            </div>

            <EditField
              id={contentId}
              label="Text"
              hint="Formatted text, saved as HTML for the store."
            >
              <RichTextEditor
                id={contentId}
                label={`${section.title.trim() || `Section ${index + 1}`} text`}
                value={section.content}
                onChange={(content) => change(index, { content })}
              />
            </EditField>
          </fieldset>
        )
      })}

      {errors.descriptionSections && (
        <p role="alert" className="text-danger text-[0.78rem]">
          {errors.descriptionSections}
        </p>
      )}

      {sections.length > 0 && (
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onChange([...sections, blankSection()])}
              className={OUTLINE_BUTTON}
            >
              <PlusIcon width={13} height={13} />
              Add section
            </button>
            {/* The named ones that are not there yet, one click each. */}
            {STARTS.filter(
              (start) =>
                start.title !== '' &&
                !sections.some((section) => section.title.trim() === start.title),
            ).map((start) => (
              <button
                key={start.label}
                type="button"
                aria-label={start.label}
                onClick={() =>
                  onChange([...sections, { ...blankSection(), title: start.title }])
                }
                className={OUTLINE_BUTTON}
              >
                <PlusIcon width={13} height={13} />
                {start.title}
              </button>
            ))}
          </div>

          {deletingAll ? (
            <span className="text-text flex flex-wrap items-center gap-2 text-[0.82rem]">
              Delete all {sections.length}{' '}
              {sections.length === 1 ? 'section' : 'sections'}?
              <button
                type="button"
                onClick={() => {
                  setDeletingAll(false)
                  onChange([])
                }}
                className="bg-danger text-bg inline-flex h-7 cursor-pointer items-center rounded-md border-none px-2.5 text-[0.78rem] font-semibold"
              >
                Yes, delete all
              </button>
              <button
                type="button"
                onClick={() => setDeletingAll(false)}
                className="border-border bg-bg text-text hover:border-accent inline-flex h-7 cursor-pointer items-center rounded-md border px-2.5 text-[0.78rem] font-semibold"
              >
                Keep them
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setDeletingAll(true)}
              className="text-danger hover:text-danger/80 inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[0.82rem] font-semibold"
            >
              <TrashIcon width={14} height={14} />
              Delete all
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** The details page's editor: the sections of the card being edited. */
export function DescriptionSectionsSection({ draft, errors, onChange }: SectionProps) {
  return (
    <SectionsEditor
      sections={draft.descriptionSections}
      errors={errors}
      onChange={(descriptionSections) => onChange({ descriptionSections })}
      idPrefix="edit"
    />
  )
}
