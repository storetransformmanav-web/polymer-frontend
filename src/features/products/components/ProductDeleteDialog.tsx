import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { SpinnerIcon } from '../../../components/ui/icons.tsx'
import type { ProductListItem, ProductWriteResult } from '../../../lib/api/endpoints.ts'
import { useDeleteProduct } from '../hooks/useDeleteProduct.ts'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

interface ProductDeleteDialogProps {
  product: ProductListItem
  onClose: () => void
  /** The delete went through; `result` carries the backend's own message. */
  onDone: (result: ProductWriteResult) => void
}

/**
 * "Delete this product?" — the confirmation behind a row's trash button. Cancel
 * is focused (the safe choice); nothing is sent until Delete is clicked.
 */
export function ProductDeleteDialog({
  product,
  onClose,
  onDone,
}: ProductDeleteDialogProps) {
  const { remove, isDeleting, error } = useDeleteProduct()

  async function confirm() {
    const result = await remove({ id: product.id, shop: product.shop?.key })
    if (result) onDone(result)
  }

  return (
    <Dialog
      title={`Delete “${product.title}”?`}
      onClose={onClose}
      closeDisabled={isDeleting}
      footer={
        <>
          <button
            type="button"
            data-autofocus
            disabled={isDeleting}
            onClick={onClose}
            className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => void confirm()}
            className={`${BUTTON} bg-danger text-bg border-transparent hover:opacity-90`}
          >
            {isDeleting && (
              <SpinnerIcon width={14} height={14} className="animate-spin" />
            )}
            Delete
          </button>
        </>
      }
    >
      <p>
        The product is removed from your store. It stays here as Archived, so it can be
        brought back by setting it to Active.
      </p>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
