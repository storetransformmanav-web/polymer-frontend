import { useMemo, useState } from 'react'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import type { ProductDetail, ProductVariant } from '../../../lib/api/endpoints.ts'
import { useSectionEdit, type SavedHandler } from '../hooks/useSectionEdit.ts'
import type { VariantDraft } from '../utils/editDraft.ts'
import { ConfirmUpdateDialog } from './ConfirmUpdateDialog.tsx'
import { ImagePicker, NO_PICTURE } from './edit/ImagePicker.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

/**
 * **Change image** for one variant, with both ways shown before anything is chosen: **From
 * media** (the product's pictures to pick from, the one shown now marked, and **No image** for a
 * variant that shows one) and **Web address** (a new picture by a public https link, added to the
 * product's media in the same save and shown by the variant once the store has downloaded it).
 * **Use this picture** asks "Are you sure?" (the picture now → the new one) and sends just this
 * variant's change — `variants: [{ id, image_attachment_id }]`, `remove_image: true`, or the new
 * address in `media_add` — and the variant shows a chosen picture at once.
 */
export function VariantImageDialog({
  product,
  variant,
  onSaved,
  onClose,
}: {
  product: ProductDetail
  variant: ProductVariant
  onSaved?: SavedHandler
  onClose: () => void
}) {
  const index = product.variants.findIndex((candidate) => candidate.id === variant.id)
  // Only this variant's problems can block its save.
  const errorPrefixes = useMemo(() => [`variants.${index}`], [index])
  const edit = useSectionEdit(product, {
    errorPrefixes,
    onSaved: (result, saved, body) => {
      onSaved?.(result, saved, body)
      onClose()
    },
  })
  // The edit starts as the window opens (once: after a save the window closes).
  const [begun, setBegun] = useState(false)
  if (!begun) {
    setBegun(true)
    edit.start()
  }

  const draft = edit.draft
  const now = draft?.variants[index]
  if (!draft || !now || index < 0) return null

  const title = variant.title ?? 'variant'
  const update = (patch: Partial<VariantDraft>) =>
    edit.change({
      variants: draft.variants.map((candidate, i) =>
        i === index ? { ...candidate, ...patch } : candidate,
      ),
    })
  const picked = now.removeImage ? NO_PICTURE : now.imageUrl.trim() ? '' : now.imageId
  const nameOf = (imageId: string, address = '') => {
    if (address.trim()) return address.trim()
    if (imageId === NO_PICTURE) return 'No image'
    const position = draft.images.findIndex((image) => image.id === imageId)
    return position < 0 ? 'No image' : `Image ${position + 1}`
  }
  const before = product.variants[index]
  const beforeId =
    draft.images.find(
      (image) => image.url.split('?')[0] === before.image_url?.split('?')[0],
    )?.id ?? ''

  return (
    <>
      <Dialog
        title={`Change the picture of ${title}`}
        role="dialog"
        wide
        closeButton
        closeDisabled={edit.isSaving || edit.confirming}
        onClose={() => {
          edit.discard()
          onClose()
        }}
        footer={
          <>
            <button
              type="button"
              disabled={edit.isSaving}
              onClick={() => {
                edit.discard()
                onClose()
              }}
              className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!edit.dirty || edit.isSaving}
              onClick={edit.commit}
              className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
            >
              Use this picture
            </button>
          </>
        }
      >
        <ImagePicker
          idPrefix={`change-${variant.id}`}
          images={draft.images}
          selected={picked}
          canRemove={now.hasImage}
          onMedia={(image) =>
            update({ removeImage: false, imageId: image.id, imageUrl: '' })
          }
          onNone={() => update({ removeImage: true, imageId: '', imageUrl: '' })}
          url={now.imageUrl}
          onUrl={(imageUrl) =>
            // An address replaces whatever picture was chosen from the media.
            update(
              imageUrl.trim()
                ? { imageUrl, imageId: '', removeImage: false }
                : { imageUrl },
            )
          }
          error={edit.errors[`variants.${index}.imageUrl`]}
          folder={{ productId: product.id, shop: product.shop?.key }}
        />
        {edit.error && <FormMessage tone="error">{edit.error}</FormMessage>}
        {!edit.error && edit.showErrors && edit.hasProblems && (
          <FormMessage tone="error">Fix the highlighted field to save.</FormMessage>
        )}
      </Dialog>
      {edit.confirming && (
        <ConfirmUpdateDialog
          title={`Update “${product.title}”?`}
          change={{
            label: `Picture of ${title}`,
            from: nameOf(beforeId),
            to: nameOf(picked, now.imageUrl),
          }}
          onConfirm={() => void edit.confirmSave()}
          onCancel={edit.cancelConfirm}
        />
      )}
    </>
  )
}
