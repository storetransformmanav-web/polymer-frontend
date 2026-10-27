import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { SpinnerIcon } from '../../../components/ui/icons.tsx'
import type { ProductDetail, ProductWriteResult } from '../../../lib/api/endpoints.ts'
import { useAddToCollection } from '../hooks/useAddToCollection.ts'
import { useCreateCollection } from '../hooks/useCreateCollection.ts'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

interface AddCollectionDialogProps {
  product: ProductDetail
  /** The collection's name (the store's own spelling for an existing one). */
  collectionName: string
  /** The store has no collection of that name: it is made, with this product in it. */
  isNew: boolean
  onClose: () => void
  /** The product is in the collection now: added to an existing one, or in a newly made one. */
  onDone: (outcome: CollectionOutcome) => void
}

export type CollectionOutcome =
  | { created: false; name: string; result: ProductWriteResult }
  | { created: true; name: string; message: string }

/**
 * "Add to this collection?" / "Create this collection?" — asked after Add, because the
 * change also goes to Shopify. Cancel is focused (the safe choice); nothing is sent until
 * the main button is pressed. An existing collection is added with `PUT /products/{id}`
 * (`collections_add`); a name the store doesn't have is made with `POST /collections`, with
 * this product in it. A refusal shows the backend's message here with the dialog still open.
 * When the store says an existing-collection add found no such collection, "Yes, add" is
 * switched off and the dialog explains what to do.
 */
export function AddCollectionDialog({
  product,
  collectionName,
  isNew,
  onClose,
  onDone,
}: AddCollectionDialogProps) {
  const adding = useAddToCollection(product)
  const creating = useCreateCollection(product)
  const busy = adding.isAdding || creating.isCreating
  const error = isNew ? creating.error : adding.error
  // The store has no such collection to add to: trying the same name again can't help.
  const unknown = !isNew && error !== null && /not found/i.test(error)

  async function confirm() {
    if (isNew) {
      const result = await creating.create(collectionName)
      if (result) {
        onDone({ created: true, name: collectionName, message: result.message })
      }
      return
    }
    const result = await adding.add(collectionName)
    if (result) onDone({ created: false, name: collectionName, result })
  }

  return (
    <Dialog
      title={isNew ? `Create “${collectionName}”?` : `Add to “${collectionName}”?`}
      onClose={onClose}
      closeDisabled={busy}
      footer={
        <>
          <button
            type="button"
            data-autofocus
            disabled={busy}
            onClick={onClose}
            className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || unknown}
            onClick={() => void confirm()}
            className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
          >
            {busy && <SpinnerIcon width={14} height={14} className="animate-spin" />}
            {isNew ? 'Yes, create' : 'Yes, add'}
          </button>
        </>
      }
    >
      {isNew ? (
        <>
          <p>
            The store has no collection called “{collectionName}”. A new one will be
            created in Shopify with “{product.title}” in it.
          </p>
          <p>This is also changed in Shopify.</p>
        </>
      ) : (
        <p>
          “{product.title}” will be added to this collection, and that is also changed in
          Shopify.
        </p>
      )}
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {unknown && (
        <p>
          The store has no collection called “{collectionName}”. Cancel, then pick one of
          the collections suggested under the box (type a few letters of its name).
        </p>
      )}
    </Dialog>
  )
}
