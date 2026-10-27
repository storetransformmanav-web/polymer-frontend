import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { SpinnerIcon } from '../../../components/ui/icons.tsx'
import type { ProductDetail, ProductWriteResult } from '../../../lib/api/endpoints.ts'
import { useRemoveFromCollection } from '../hooks/useRemoveFromCollection.ts'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

type Collection = ProductDetail['collections'][number]

interface RemoveCollectionDialogProps {
  product: ProductDetail
  collection: Collection
  onClose: () => void
  onDone: (result: ProductWriteResult) => void
}

/**
 * "Remove from this collection?" — the alert behind a collection tile's ✕. Cancel is
 * focused (the safe choice); nothing is sent until Remove is clicked, and a refusal (a smart
 * collection is filled by rules, so the store may say no) shows the backend's message here.
 */
export function RemoveCollectionDialog({
  product,
  collection,
  onClose,
  onDone,
}: RemoveCollectionDialogProps) {
  const { remove, isRemoving, error } = useRemoveFromCollection(product)
  const smart = collection.collection_type?.toLowerCase() === 'smart'

  async function confirm() {
    const result = await remove(collection.title)
    if (result) onDone(result)
  }

  return (
    <Dialog
      title={`Remove from “${collection.title}”?`}
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
            Remove
          </button>
        </>
      }
    >
      <p>
        “{product.title}” will no longer be in this collection, and that is also changed
        in Shopify.
      </p>
      {smart && (
        <p>
          This is a smart collection: the store fills it by rules, so it may not allow a
          product to be taken out by hand.
        </p>
      )}
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
