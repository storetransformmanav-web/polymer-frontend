import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { SpinnerIcon, TrashIcon } from '../../../components/ui/icons.tsx'
import type {
  ProductDeleteMode,
  ProductListItem,
  ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { useDeleteProduct } from '../hooks/useDeleteProduct.ts'
import { ProductImage } from './ProductImage.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

/** The only thing this window does: delete the product for good (`mode=delete`). */
const MODE: ProductDeleteMode = 'delete'

interface ProductDeleteDialogProps {
  product: ProductListItem
  onClose: () => void
  /** The delete went through; `result` carries the backend's own message. */
  onDone: (result: ProductWriteResult, mode: ProductDeleteMode) => void
}

/**
 * "Delete “Hippo Bag”?" — the confirmation behind a row's trash button, laid out like the update
 * question (`ConfirmUpdateDialog`): a round icon and the product's name, "Are you sure you want to
 * delete this product?", a line saying it is also deleted in Shopify and can't be undone, then a
 * card with the product being deleted. There is one choice — **Yes, delete** (red), sent as
 * `mode=delete`; Cancel is focused (the safe choice) and nothing is sent until the red button.
 */
export function ProductDeleteDialog({
  product,
  onClose,
  onDone,
}: ProductDeleteDialogProps) {
  const { remove, isDeleting, error } = useDeleteProduct()

  async function confirm() {
    const result = await remove({ id: product.id, shop: product.shop?.key, mode: MODE })
    if (result) onDone(result, MODE)
  }

  return (
    <Dialog
      title={`Delete “${product.title}”?`}
      onClose={onClose}
      closeDisabled={isDeleting}
      icon={
        <span
          aria-hidden="true"
          className="bg-danger-bg text-danger flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        >
          <TrashIcon width={18} height={18} />
        </span>
      }
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
            {isDeleting ? 'Deleting…' : 'Yes, delete'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-text m-0 text-[0.95rem] font-semibold">
          Are you sure you want to delete this product?
        </p>
        <p className="m-0">
          It will also be deleted in Shopify. This can&rsquo;t be undone.
        </p>
      </div>
      <div className="border-border-strong border-l-danger bg-danger-bg/40 flex min-w-0 items-center gap-3 border border-l-4 p-3">
        <span className="border-border h-10 w-10 shrink-0 overflow-hidden border">
          <ProductImage src={product.image_url ?? null} alt="" size="thumb" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-text text-[0.9rem] font-semibold break-words">
            {product.title}
          </span>
          {product.shop?.name && (
            <span className="text-text-muted text-[0.78rem]">{product.shop.name}</span>
          )}
        </span>
      </div>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
