import { RichTextEditor } from '../../../../components/ui/RichTextEditor.tsx'
import { blankSection, type SectionDraft } from '../../utils/descriptionSections.ts'
import { EditField, type SectionProps } from './fields.tsx'

/**
 * The two sections every product has, with their titles fixed: only their text is edited. Each is
 * saved in the `apd` metafield under exactly this title, which is what the store's product page
 * shows as the accordion's headings.
 */
const FIXED_SECTIONS = [
  {
    title: 'Product Description',
    hint: 'What the product is, and why customers will want it.',
  },
  {
    title: 'Product Information',
    hint: 'Sizes, materials, specifications and care.',
  },
] as const

/**
 * The description sections being edited, simplified to **two fixed ones — Product Description and
 * Product Information —, each just a text editor**: the titles can't be changed, and nothing is
 * added, moved or removed. A section is created when its text is first typed (one that is still
 * empty when saved is simply left out); a section the product already has keeps its own settings. Any
 * other section a product happens to have (a "Delivery" section, say) is not shown and is kept as
 * it is. Used by the details page (saved as the product's `apd` metafield) and by the Add product
 * form (sent with the new product).
 */
export function SectionsEditor({
  sections,
  errors,
  onChange,
  idPrefix,
}: {
  sections: SectionDraft[]
  /** `descriptionSections` — a problem with the whole. */
  errors: Record<string, string>
  onChange: (next: SectionDraft[]) => void
  /** Keeps element ids apart when two editors are on a page. */
  idPrefix: string
}) {
  const indexOf = (title: string) =>
    sections.findIndex((section) => section.title.trim() === title)
  const others = sections.filter(
    (section) => !FIXED_SECTIONS.some((fixed) => fixed.title === section.title.trim()),
  ).length

  function setContent(title: string, content: string) {
    const at = indexOf(title)
    if (at >= 0) {
      onChange(sections.map((item, i) => (i === at ? { ...item, content } : item)))
    } else if (content !== '') {
      // Product Description goes in front of Product Information, whichever is typed first.
      const created = { ...blankSection(), title, content }
      const before = FIXED_SECTIONS.findIndex((fixed) => fixed.title === title)
      const later = sections.findIndex((section) =>
        FIXED_SECTIONS.slice(before + 1).some(
          (fixed) => fixed.title === section.title.trim(),
        ),
      )
      onChange(
        later < 0
          ? [...sections, created]
          : [...sections.slice(0, later), created, ...sections.slice(later)],
      )
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {FIXED_SECTIONS.map((fixed) => {
        const contentId = `${idPrefix}-section-content-${fixed.title.replace(/\s+/g, '-').toLowerCase()}`
        const current = sections[indexOf(fixed.title)]
        return (
          <fieldset
            key={fixed.title}
            className="border-border bg-bg flex min-w-0 flex-col gap-3 rounded-xl border p-3.5"
          >
            <legend className="sr-only">{fixed.title}</legend>
            <h4 className="text-text m-0 text-[0.92rem] font-semibold">{fixed.title}</h4>
            <EditField id={contentId} label="Text" hint={fixed.hint}>
              <RichTextEditor
                id={contentId}
                label={`${fixed.title} text`}
                value={current?.content ?? ''}
                onChange={(content) => setContent(fixed.title, content)}
              />
            </EditField>
          </fieldset>
        )
      })}

      {others > 0 && (
        <p className="text-text-muted m-0 text-[0.8rem]">
          {others === 1
            ? '1 other section on this product is kept as it is.'
            : `${others} other sections on this product are kept as they are.`}
        </p>
      )}

      {errors.descriptionSections && (
        <p role="alert" className="text-danger text-[0.78rem]">
          {errors.descriptionSections}
        </p>
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
