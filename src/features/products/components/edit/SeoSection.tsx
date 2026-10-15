import { htmlToText } from '../../utils/format.ts'
import { LIMITS } from '../../utils/editDraft.ts'
import { EditField, FIELD_INPUT, FIELD_TEXTAREA, type SectionProps } from './fields.tsx'

/** The search-engine title and description, with a preview of how they may appear. */
export function SeoSection({ product, draft, errors, onChange }: SectionProps) {
  // Search engines fall back to the product's own title and description when these are blank.
  const previewTitle = draft.seoTitle.trim() || draft.title.trim() || product.title
  const previewDescription =
    draft.seoDescription.trim() || htmlToText(draft.descriptionHtml).slice(0, 160)

  return (
    <div className="flex flex-col gap-4">
      <EditField
        id="edit-seo-title"
        label="SEO title"
        optional
        error={errors.seoTitle}
        counter={{ value: draft.seoTitle.trim().length, max: LIMITS.seoTitle }}
      >
        <input
          id="edit-seo-title"
          autoComplete="off"
          value={draft.seoTitle}
          aria-invalid={errors.seoTitle ? true : undefined}
          onChange={(event) => onChange({ seoTitle: event.target.value })}
          className={FIELD_INPUT}
        />
      </EditField>

      <EditField
        id="edit-seo-description"
        label="SEO description"
        optional
        error={errors.seoDescription}
        counter={{
          value: draft.seoDescription.trim().length,
          max: LIMITS.seoDescription,
        }}
      >
        <textarea
          id="edit-seo-description"
          rows={3}
          value={draft.seoDescription}
          aria-invalid={errors.seoDescription ? true : undefined}
          onChange={(event) => onChange({ seoDescription: event.target.value })}
          className={FIELD_TEXTAREA}
        />
      </EditField>

      <div
        aria-label="Search result preview"
        className="border-border bg-surface rounded-xl border p-3.5"
      >
        <p className="text-text-muted mb-1 text-[0.7rem] font-bold tracking-wide uppercase">
          Search preview
        </p>
        <p className="text-accent truncate text-[0.95rem] font-semibold">
          {previewTitle}
        </p>
        <p className="text-text-muted truncate font-mono text-[0.74rem]">
          /products/{draft.handle.trim() || product.handle}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[0.82rem] leading-snug">
          {previewDescription || (
            <span className="text-text-muted">No description to show.</span>
          )}
        </p>
      </div>
    </div>
  )
}
