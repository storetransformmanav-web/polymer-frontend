import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { SpinnerIcon } from '../../../components/ui/icons.tsx'
import { useDeleteCustomer } from '../hooks/useDeleteCustomer.ts'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

export interface CustomerToDelete {
  id: string
  name: string
  /** The customer's store key (sent as `shop=`), when known. */
  shop: string | null
  ordersCount: number
}

interface CustomerDeleteDialogProps {
  customer: CustomerToDelete
  onClose: () => void
  /** The delete went through; `message` is the backend's own words (may be empty). */
  onDone: (message: string) => void
}

/**
 * "Are you sure you want to delete this customer?" — says plainly that it also
 * deletes the customer in Shopify and can't be undone. Cancel is focused (the safe
 * choice); nothing is sent until Delete. A customer with orders is flagged up front,
 * because Shopify refuses to delete those; whatever the backend answers is shown
 * inside the dialog, which then stays open.
 */
export function CustomerDeleteDialog({
  customer,
  onClose,
  onDone,
}: CustomerDeleteDialogProps) {
  const { remove, isDeleting, error } = useDeleteCustomer()

  async function confirm() {
    const result = await remove({ id: customer.id, shop: customer.shop })
    if (result) onDone(result.message)
  }

  return (
    <Dialog
      title={`Delete “${customer.name}”?`}
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
      <p>This will also delete this customer in Shopify.</p>
      <p>Are you sure you want to delete this customer? It can&apos;t be undone.</p>
      {customer.ordersCount > 0 && (
        <FormMessage tone="info">
          {`This customer has ${customer.ordersCount.toLocaleString('en-GB')} ${
            customer.ordersCount === 1 ? 'order' : 'orders'
          }. Shopify only allows deleting customers without orders, so it may refuse.`}
        </FormMessage>
      )}
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
