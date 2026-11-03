import { useState } from 'react'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { SpinnerIcon } from '../../../components/ui/icons.tsx'
import type {
  ProductDeleteMode,
  ProductListItem,
  ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { useDeleteProduct } from '../hooks/useDeleteProduct.ts'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

const CHOICES: { mode: ProductDeleteMode; label: string; hint: string }[] = [
  {
    mode: 'archive',
    label: 'Archive (recommended)',
    hint: 'Removed from your store, but kept here as Archived. Set it back to Active to bring it back.',
  },
  {
    mode: 'delete',
    label: 'Delete permanently',
    hint: 'Deleted from Shopify for good. This can\u2019t be undone.',
  },
]

interface ProductDeleteDialogProps {
  product: ProductListItem
  onClose: () => void
  /** The delete went through; `result` carries the backend's own message. */
  onDone: (result: ProductWriteResult, mode: ProductDeleteMode) => void
}

/**
 * "Delete this product?" — the confirmation behind a row's trash button, with the API's two
 * modes: **archive** (the default, reversible) or **delete** (permanent in Shopify). Cancel is
 * focused (the safe choice); nothing is sent until the red button is clicked.
 */
export function ProductDeleteDialog({
  product,
  onClose,
  onDone,
}: ProductDeleteDialogProps) {
  const { remove, isDeleting, error } = useDeleteProduct()
  const [mode, setMode] = useState<ProductDeleteMode>('archive')
  const permanent = mode === 'delete'

  async function confirm() {
    const result = await remove({ id: product.id, shop: product.shop?.key, mode })
    if (result) onDone(result, mode)
  }

  return (
    <Dialog
      title={`Delete \u201c${product.title}\u201d?`}
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
            className={`${BUTTON} border-transparent hover:opacity-90 ${
              permanent ? 'bg-danger text-bg' : 'bg-accent text-accent-contrast'
            }`}
          >
            {isDeleting && (
              <SpinnerIcon width={14} height={14} className="animate-spin" />
            )}
            {permanent ? 'Delete permanently' : 'Archive product'}
          </button>
        </>
      }
    >
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="sr-only">What to do with this product</legend>
        {CHOICES.map((choice) => (
          <label
            key={choice.mode}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
              mode === choice.mode
                ? choice.mode === 'delete'
                  ? 'border-danger bg-danger-bg'
                  : 'border-accent bg-accent-tint/40'
                : 'border-border hover:border-accent'
            }`}
          >
            <input
              type="radio"
              name="delete-mode"
              value={choice.mode}
              checked={mode === choice.mode}
              disabled={isDeleting}
              onChange={() => setMode(choice.mode)}
              className="accent-accent mt-1 h-4 w-4 shrink-0 cursor-pointer"
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-text text-[0.9rem] font-semibold">
                {choice.label}
              </span>
              <span className="text-text-muted text-[0.8rem]">{choice.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
