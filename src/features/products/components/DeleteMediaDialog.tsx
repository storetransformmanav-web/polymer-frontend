import { useEffect } from 'react'
import { useAppDispatch } from '../../../app/store/hooks.ts'
import { fetchProductDetails } from '../../../app/store/productsSlice.ts'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { SpinnerIcon } from '../../../components/ui/icons.tsx'
import type {
  ProductDetail,
  ProductImage,
  ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { useProductMedia } from '../hooks/useProductMedia.ts'
import { ProductImage as Picture } from './ProductImage.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

interface DeleteMediaDialogProps {
  product: ProductDetail
  image: ProductImage
  /** Its place in the product's images, for the heading ("Delete image 2?"). */
  position: number
  onClose: () => void
  onDone: (result: ProductWriteResult) => void
}

/**
 * "Delete this image?" — the confirmation behind an image's Delete button.
 * Cancel is focused (the safe choice); nothing is sent until Delete is clicked.
 */
export function DeleteMediaDialog({
  product,
  image,
  position,
  onClose,
  onDone,
}: DeleteMediaDialogProps) {
  const { remove, isRemoving, error } = useProductMedia(product)
  const dispatch = useAppDispatch()

  // Image ids can change when the store re-syncs the product, so read the
  // current ones as the dialog opens (the cached copy stays on screen meanwhile).
  useEffect(() => {
    void dispatch(fetchProductDetails({ id: product.id, force: true }))
  }, [dispatch, product.id])

  async function confirm() {
    const result = await remove(image)
    if (result) onDone(result)
  }

  return (
    <Dialog
      title={`Delete image ${position}?`}
      onClose={onClose}
      closeDisabled={isRemoving}
      footer={
        <>
          <button
            type="button"
            data-autofocus
            disabled={isRemoving}
            onClick={onClose}
            className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isRemoving}
            onClick={() => void confirm()}
            className={`${BUTTON} bg-danger text-bg border-transparent hover:opacity-90`}
          >
            {isRemoving && (
              <SpinnerIcon width={14} height={14} className="animate-spin" />
            )}
            Delete
          </button>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0">
          <Picture src={image.url} alt={image.alt_text ?? ''} size="thumb" />
        </div>
        <p>It is removed from this product in your store. This can&apos;t be undone.</p>
      </div>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
