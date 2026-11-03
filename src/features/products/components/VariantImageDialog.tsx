import { useState } from 'react'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import type {
  ProductDetail,
  ProductUpdateBody,
  ProductVariant,
} from '../../../lib/api/endpoints.ts'
import { useSaveProduct } from '../hooks/useSaveProduct.ts'
import type { SavedHandler } from '../hooks/useSectionEdit.ts'
import { variantImageId } from '../utils/editDraft.ts'
import { ConfirmUpdateDialog } from './ConfirmUpdateDialog.tsx'
import { ProductImage } from './ProductImage.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

/** The choice that takes the picture off the variant (the update API's `remove_image`). */
const NONE = 'none'

/**
 * **Change image** for one variant: the product's pictures as a grid to pick from (the one the
 * variant shows now is marked), and — for a variant that shows one — "No image". **Use this
 * picture** asks "Are you sure?" (the picture now → the new one) and then sends just
 * `variants: [{ id, image_attachment_id }]` (or `remove_image: true`); the variant shows it at once.
 * The update API can only point a variant at a picture the product already has, so a new picture
 * is added first in the Media tab.
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
  const { save, error, clearError } = useSaveProduct()
  const current = variantImageId(variant, product.images)
  const [picked, setPicked] = useState(current)
  const [asking, setAsking] = useState(false)
  const [sending, setSending] = useState(false)
  const title = variant.title ?? 'variant'
  const nameOf = (id: string) => {
    if (id === NONE) return 'No image'
    const position = product.images.findIndex((image) => image.id === id)
    return position < 0 ? 'No image' : `Image ${position + 1}`
  }
  const changed = picked !== current && !(picked === '' && current === '')

  async function confirm() {
    setAsking(false)
    setSending(true)
    clearError()
    const body: ProductUpdateBody = {
      variants: [
        {
          id: variant.id,
          ...(picked === NONE ? { remove_image: true } : { image_attachment_id: picked }),
        },
      ],
    }
    const result = await save({ id: product.id, body, shop: product.shop?.key })
    setSending(false)
    if (result) {
      onSaved?.(result, product, body)
      onClose()
    }
  }

  return (
    <>
      <Dialog
        title={`Change the picture of ${title}`}
        role="dialog"
        wide
        closeButton
        closeDisabled={sending}
        onClose={onClose}
        footer={
          <>
            <button
              type="button"
              disabled={sending}
              onClick={onClose}
              className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!changed || sending}
              onClick={() => setAsking(true)}
              className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
            >
              Use this picture
            </button>
          </>
        }
      >
        {product.images.length === 0 ? (
          <p className="m-0">
            This product has no pictures yet. Add one in the Media tab, then choose it
            here.
          </p>
        ) : (
          <>
            <ul
              aria-label="Product pictures"
              className="m-0 grid list-none grid-cols-3 gap-2.5 p-0 min-[480px]:grid-cols-4"
            >
              {product.images.map((image, index) => (
                <li key={image.id}>
                  <button
                    type="button"
                    aria-label={`Image ${index + 1}`}
                    aria-pressed={picked === image.id}
                    onClick={() => setPicked(image.id)}
                    className={`block w-full cursor-pointer overflow-hidden rounded-lg border-2 bg-transparent p-0 transition-colors ${
                      picked === image.id
                        ? 'border-accent'
                        : 'border-border hover:border-accent/60'
                    }`}
                  >
                    <ProductImage
                      src={image.url}
                      alt={image.alt_text ?? `Image ${index + 1}`}
                      size="thumb"
                    />
                  </button>
                  {image.id === current && (
                    <span className="text-text-muted mt-1 block text-center text-[0.7rem]">
                      Now
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {current !== '' && (
              <button
                type="button"
                aria-pressed={picked === NONE}
                onClick={() => setPicked(NONE)}
                className={`${BUTTON} h-9 self-start ${
                  picked === NONE
                    ? 'border-accent bg-accent-tint/50 text-text'
                    : 'border-border bg-bg text-text hover:border-accent'
                }`}
              >
                No image
              </button>
            )}
            <p className="m-0 text-[0.78rem]">
              To use a new picture, add it in the Media tab first, then choose it here.
            </p>
          </>
        )}
        {error && !asking && (
          <p role="alert" className="text-danger m-0 text-[0.82rem]">
            {error}
          </p>
        )}
      </Dialog>
      {asking && (
        <ConfirmUpdateDialog
          title={`Update “${product.title}”?`}
          change={{
            label: `Picture of ${title}`,
            from: nameOf(current),
            to: nameOf(picked),
          }}
          onConfirm={() => void confirm()}
          onCancel={() => setAsking(false)}
        />
      )}
    </>
  )
}
