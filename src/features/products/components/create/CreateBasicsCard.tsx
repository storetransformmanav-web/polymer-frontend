import { RichTextEditor } from '../../../../components/ui/RichTextEditor.tsx'
import { LIMITS } from '../../utils/editDraft.ts'
import { CheckField, EditField, FIELD_INPUT } from '../edit/fields.tsx'
import { FilePicker } from '../FilePicker.tsx'
import type { FileUploadState } from '../../hooks/useFileUpload.ts'
import type { PickedFile } from '../../utils/mediaFiles.ts'
import { CreateCard, type CreateSectionProps } from './CreateCard.tsx'

/**
 * The Basics step: three cards — **Title & description**, **Media** (files uploaded from the
 * computer and, for a product without options, the one variant's own image link) and
 * **Category** (with the gift-card box).
 */
export function CreateBasicsCard({
  draft,
  errors,
  update,
  files,
  onFiles,
  uploadStates,
  uploading,
}: CreateSectionProps & {
  /** Files chosen from the computer: uploaded to the product right after it is created. */
  files: PickedFile[]
  onFiles: (files: PickedFile[]) => void
  uploadStates: Record<string, FileUploadState>
  /** The product is being created / its files uploaded. */
  uploading: boolean
}) {
  const single =
    draft.variants.length === 1 && draft.variants[0].optionValues.length === 0

  return (
    <>
      <CreateCard
        title="Title & description"
        regionLabel="Basics"
        description="The name and the text customers read on the product page."
      >
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
      </CreateCard>

      <CreateCard
        title="Media"
        description="Photos, videos or 3D models. The first image becomes the main product image."
      >
        <div className="flex flex-col gap-2" role="group" aria-label="Media">
          <FilePicker
            files={files}
            onChange={onFiles}
            max={LIMITS.newMedia}
            states={uploadStates}
            disabled={uploading}
            idPrefix="create-media"
          />
          {errors['media.rows'] && (
            <p role="alert" className="text-danger text-[0.78rem]">
              {errors['media.rows']}
            </p>
          )}
          <p className="text-text-muted text-[0.76rem]">
            Files are uploaded as soon as the product is created.
          </p>
        </div>

        {single && (
          <EditField
            id="create-variant-image"
            label="Image link (optional)"
            error={errors['variants.0.imageUrl']}
            hint="Instead of uploading, paste a public link to an image of this product (it must start with https://). The store downloads it and adds it to the product's media."
          >
            <input
              id="create-variant-image"
              type="url"
              autoComplete="off"
              spellCheck={false}
              value={draft.variants[0].imageUrl}
              maxLength={LIMITS.mediaUrl + 100}
              placeholder="https://…"
              aria-invalid={errors['variants.0.imageUrl'] ? true : undefined}
              onChange={(event) =>
                update({
                  variants: [{ ...draft.variants[0], imageUrl: event.target.value }],
                })
              }
              className={FIELD_INPUT}
            />
          </EditField>
        )}
      </CreateCard>

      <CreateCard
        title="Category"
        description="Optional. Helps the store with tax rates, search and filters."
      >
        <EditField
          id="create-category"
          label="Product category"
          error={errors.categoryGid}
          hint="Paste the category's Shopify ID, which starts with gid://shopify/TaxonomyCategory/."
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
    </>
  )
}
