import { RichTextEditor } from '../../../../components/ui/RichTextEditor.tsx'
import { SelectField, type SelectOption } from '../../../../components/ui/SelectField.tsx'
import { PRODUCT_EDIT_STATUSES } from '../../../../lib/api/endpoints.ts'
import { LIMITS } from '../../utils/editDraft.ts'
import { statusLabel } from '../../utils/format.ts'
import { EditField, FIELD_INPUT, type SectionProps } from './fields.tsx'

/**
 * The product's basic fields, one small component each, so the full "Edit
 * product" form and the inline per-section editors (specifications, status,
 * description) share the same inputs.
 */

export function TitleField({ draft, errors, onChange }: SectionProps) {
  return (
    <EditField
      id="edit-title"
      label="Title"
      error={errors.title}
      counter={{ value: draft.title.trim().length, max: LIMITS.title }}
    >
      <input
        id="edit-title"
        autoFocus
        autoComplete="off"
        value={draft.title}
        placeholder="Product title"
        aria-invalid={errors.title ? true : undefined}
        aria-describedby={errors.title ? 'edit-title-error' : undefined}
        onChange={(event) => onChange({ title: event.target.value })}
        className={FIELD_INPUT}
      />
    </EditField>
  )
}

export function StatusField({ product, draft, onChange }: SectionProps) {
  const statusOptions: SelectOption[] = PRODUCT_EDIT_STATUSES.map((value) => ({
    value,
    label: statusLabel(value),
  }))
  // A status the API can't set (e.g. "unlisted") stays selectable so the form can show it.
  const current = (product.status ?? '').toUpperCase()
  if (current && !PRODUCT_EDIT_STATUSES.some((value) => value === current)) {
    statusOptions.unshift({ value: current, label: `${statusLabel(current)} (current)` })
  }

  return (
    <SelectField
      id="edit-status"
      label="Status"
      value={draft.status}
      options={statusOptions}
      onChange={(status) => onChange({ status })}
    />
  )
}

export function VendorField({ draft, errors, onChange }: SectionProps) {
  return (
    <EditField id="edit-vendor" label="Vendor" error={errors.vendor}>
      <input
        id="edit-vendor"
        autoComplete="off"
        value={draft.vendor}
        onChange={(event) => onChange({ vendor: event.target.value })}
        className={FIELD_INPUT}
      />
    </EditField>
  )
}

export function ProductTypeField({ draft, errors, onChange }: SectionProps) {
  return (
    <EditField id="edit-type" label="Product type" error={errors.productType}>
      <input
        id="edit-type"
        autoComplete="off"
        value={draft.productType}
        onChange={(event) => onChange({ productType: event.target.value })}
        className={FIELD_INPUT}
      />
    </EditField>
  )
}

export function TemplateSuffixField({ draft, errors, onChange }: SectionProps) {
  return (
    <EditField
      id="edit-template"
      label="Template suffix"
      optional
      error={errors.templateSuffix}
    >
      <input
        id="edit-template"
        autoComplete="off"
        value={draft.templateSuffix}
        onChange={(event) => onChange({ templateSuffix: event.target.value })}
        className={FIELD_INPUT}
      />
    </EditField>
  )
}

export function HandleField({ draft, errors, onChange }: SectionProps) {
  return (
    <EditField
      id="edit-handle"
      label="Handle"
      error={errors.handle}
      hint="Part of the product's web address — changing it changes the link."
    >
      <input
        id="edit-handle"
        autoComplete="off"
        spellCheck={false}
        value={draft.handle}
        onChange={(event) => onChange({ handle: event.target.value })}
        className={`${FIELD_INPUT} font-mono text-[0.84rem]`}
      />
    </EditField>
  )
}

export function DescriptionField({ draft, onChange }: SectionProps) {
  return (
    <EditField
      id="edit-description"
      label="Description"
      hint="Formatted text, saved as HTML for the store."
    >
      <RichTextEditor
        id="edit-description"
        label="Description"
        value={draft.descriptionHtml}
        onChange={(descriptionHtml) => onChange({ descriptionHtml })}
      />
    </EditField>
  )
}

export function CategoryField({ draft, errors, onChange }: SectionProps) {
  return (
    <EditField
      id="edit-category"
      label="Category (Shopify taxonomy ID)"
      optional
      error={errors.categoryGid}
      hint="Leave blank to keep the current category."
    >
      <input
        id="edit-category"
        autoComplete="off"
        spellCheck={false}
        value={draft.categoryGid}
        placeholder="gid://shopify/TaxonomyCategory/…"
        onChange={(event) => onChange({ categoryGid: event.target.value })}
        className={`${FIELD_INPUT} font-mono text-[0.84rem]`}
      />
    </EditField>
  )
}

/** Everything in the basics, laid out for the full "Edit product" form. */
export function BasicsSection(props: SectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <TitleField {...props} />
      <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
        <StatusField {...props} />
        <VendorField {...props} />
        <ProductTypeField {...props} />
        <TemplateSuffixField {...props} />
      </div>
      <HandleField {...props} />
      <DescriptionField {...props} />
      <CategoryField {...props} />
    </div>
  )
}
