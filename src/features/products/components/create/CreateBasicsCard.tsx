import { RichTextEditor } from '../../../../components/ui/RichTextEditor.tsx'
import { CREATE_LIMITS } from '../../utils/createDraft.ts'
import { LIMITS } from '../../utils/editDraft.ts'
import { CheckField, EditField, FIELD_INPUT } from '../edit/fields.tsx'
import { MediaRows } from '../MediaRows.tsx'
import { CreateCard, type CreateSectionProps } from './CreateCard.tsx'

export const PICTURES_LIST = 'create-variant-pictures'

/**
 * The first card, after the store admin's: Title, Description, Media (a dashed box), Category
 * and, for a product without options, the one variant's own picture. The card has no heading.
 */
export function CreateBasicsCard({
  draft,
  errors,
  update,
  pictures,
}: CreateSectionProps & {
  /** The picture URLs listed under Media, offered as suggestions for a variant's picture. */
  pictures: string[]
}) {
  const single =
    draft.variants.length === 1 && draft.variants[0].optionValues.length === 0

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
        <MediaRows
          dropzone
          rows={draft.media}
          onChange={(media) => update({ media })}
          errors={errors}
          prefix="media."
          max={CREATE_LIMITS.media}
          idPrefix="create-media"
          minRows={0}
        />
        {errors['media.rows'] && (
          <p role="alert" className="text-danger text-[0.78rem]">
            {errors['media.rows']}
          </p>
        )}
        <p className="text-text-muted text-[0.76rem]">
          The store downloads each file from its address; the first image is the featured
          one.
        </p>
      </div>

      {single && (
        <>
          <datalist id={PICTURES_LIST}>
            {pictures.map((url) => (
              <option key={url} value={url} />
            ))}
          </datalist>
          <EditField
            id="create-variant-image"
            label="Picture address (optional)"
            error={errors['variants.0.imageUrl']}
            hint="A public https:// link to this product's own picture. It is added to the media above if it isn't listed there."
          >
            <input
              id="create-variant-image"
              type="url"
              list={PICTURES_LIST}
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
        </>
      )}

      <EditField
        id="create-category"
        label="Category"
        error={errors.categoryGid}
        hint="Determines tax rates and adds metafields to improve search, filters, and cross-channel sales. Use the store's taxonomy ID."
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
        label="This is a gift card"
        checked={draft.giftCard}
        onChange={(giftCard) => update({ giftCard })}
      />
    </CreateCard>
  )
}
