import { RichTextEditor } from '../../../../components/ui/RichTextEditor.tsx'
import { LIMITS } from '../../utils/editDraft.ts'
import { CheckField, EditField, FIELD_INPUT } from '../edit/fields.tsx'
import { FilePicker } from '../FilePicker.tsx'
import type { PickedFile } from '../../utils/mediaFiles.ts'
import { CreateCard, type CreateSectionProps } from './CreateCard.tsx'

/**
 * The first card, after the store admin's: Title, Description, Media (files uploaded from the
 * computer) and Category. The card has no heading.
 */
export function CreateBasicsCard({
  draft,
  errors,
  update,
  files,
  onFiles,
  uploading,
}: CreateSectionProps & {
  /** Files chosen from the computer: uploaded to the product right after it is created. */
  files: PickedFile[]
  onFiles: (files: PickedFile[]) => void
  /** The product is being created. */
  uploading: boolean
}) {
  return (
    <CreateCard title="Basics" hideTitle>
      <EditField
        id="create-title"
        label="Title"
        error={errors.title}
        counter={{ value: draft.title.trim().length, max: LIMITS.title }}
      >
        <input
          id="create-title"
          autoComplete="off"
          autoFocus
          value={draft.title}
          placeholder="Short sleeve t-shirt"
          aria-invalid={errors.title ? true : undefined}
          onChange={(event) => update({ title: event.target.value })}
          className={FIELD_INPUT}
        />
      </EditField>

      <EditField id="create-description" label="Description">
        <RichTextEditor
          id="create-description"
          label="Description"
          value={draft.descriptionHtml}
          onChange={(descriptionHtml) => update({ descriptionHtml })}
        />
      </EditField>

      <div className="flex flex-col gap-1.5" role="group" aria-label="Media">
        <span className="text-text text-[0.82rem] font-semibold">Media</span>
        <FilePicker
          files={files}
          onChange={onFiles}
          max={LIMITS.newMedia}
          disabled={uploading}
          idPrefix="create-media"
        />
        {errors['media.rows'] && (
          <p role="alert" className="text-danger text-[0.78rem]">
            {errors['media.rows']}
          </p>
        )}
        <p className="text-text-muted text-[0.76rem]">
          Files are uploaded as soon as the product is created. The first image becomes
          the main product image.
        </p>
      </div>

      <EditField
        id="create-category"
        label="Product category"
        error={errors.categoryGid}
        hint="Optional. Helps the store with tax rates, search and filters. Paste the category's Shopify ID, which starts with gid://shopify/TaxonomyCategory/."
      >
        <input
          id="create-category"
          autoComplete="off"
          spellCheck={false}
          value={draft.categoryGid}
          placeholder="gid://shopify/TaxonomyCategory/…"
          aria-invalid={errors.categoryGid ? true : undefined}
          onChange={(event) => update({ categoryGid: event.target.value })}
          className={FIELD_INPUT}
        />
      </EditField>
      <CheckField
        label="This product is a gift card"
        checked={draft.giftCard}
        onChange={(giftCard) => update({ giftCard })}
      />
    </CreateCard>
  )
}
