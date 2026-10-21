import { Dialog } from '../../../components/ui/Dialog.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

interface ConfirmUpdateDialogProps {
  /** The question, e.g. `Update “Hippo Bag”?`. */
  title: string
  /** Yes: go ahead and save. */
  onConfirm: () => void
  /** No: close without saving anything. */
  onCancel: () => void
}

/**
 * "Are you sure you want to update this?" — asked before any change to a product is
 * saved, because a saved change is also sent to Shopify. Cancel is focused (the
 * safe choice); nothing is sent until "Yes, update".
 */
export function ConfirmUpdateDialog({
  title,
  onConfirm,
  onCancel,
}: ConfirmUpdateDialogProps) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button
            type="button"
            data-autofocus
            onClick={onCancel}
            className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
          >
            Yes, update
          </button>
        </>
      }
    >
      <p>Are you sure you want to update this?</p>
      <p>These changes will also be updated in Shopify.</p>
    </Dialog>
  )
}
