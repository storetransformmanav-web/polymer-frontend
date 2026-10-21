import { RichTextEditor } from '../../../../components/ui/RichTextEditor.tsx'
import { ChevronDownIcon, PlusIcon, TrashIcon } from '../../../../components/ui/icons.tsx'
import {
  blankSection,
  SECTION_TITLE_MAX,
  type SectionDraft,
} from '../../utils/descriptionSections.ts'
import {
  EditField,
  FIELD_INPUT,
  ICON_BUTTON,
  TEXT_BUTTON,
  type SectionProps,
} from './fields.tsx'

/**
 * The description sections (Product Description, Product Information…) the store
 * shows as an accordion: each has a title and formatted text. They can be edited,
 * reordered, removed and added; saving sends them as the product's `apd` metafield.
 */
export function DescriptionSectionsSection({ draft, errors, onChange }: SectionProps) {
  const sections = draft.descriptionSections
  const update = (next: SectionDraft[]) => onChange({ descriptionSections: next })

  const change = (index: number, patch: Partial<SectionDraft>) =>
    update(sections.map((item, at) => (at === index ? { ...item, ...patch } : item)))

  function move(index: number, by: -1 | 1) {
    const target = index + by
    if (target < 0 || target >= sections.length) return
    const next = [...sections]
    ;[next[index], next[target]] = [next[target], next[index]]
    update(next)
  }

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section, index) => {
        const titleId = `edit-section-title-${section.key}`
        const contentId = `edit-section-content-${section.key}`
        const titleError = errors[`descriptionSections.${index}.title`]
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
                  aria-label={`Move ${section.title.trim() || `section ${index + 1}`} up`}
                  title="Move up"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className={ICON_BUTTON}
                >
                  <ChevronDownIcon width={16} height={16} className="rotate-180" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${section.title.trim() || `section ${index + 1}`} down`}
                  title="Move down"
                  disabled={index === sections.length - 1}
                  onClick={() => move(index, 1)}
                  className={ICON_BUTTON}
                >
                  <ChevronDownIcon width={16} height={16} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${section.title.trim() || `section ${index + 1}`}`}
                  title="Remove section"
                  // A product keeps at least one section (it would have nothing left to edit).
                  disabled={sections.length <= 1}
                  onClick={() => update(sections.filter((_, at) => at !== index))}
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

      <div>
        <button
          type="button"
          onClick={() => update([...sections, blankSection()])}
          className={TEXT_BUTTON}
        >
          <PlusIcon width={14} height={14} />
          Add section
        </button>
      </div>
    </div>
  )
}
