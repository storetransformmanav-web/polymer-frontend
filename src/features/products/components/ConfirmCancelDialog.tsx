import { Dialog } from '../../../components/ui/Dialog.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

interface ConfirmCancelDialogProps {
  /** What would be lost, e.g. "your unsaved changes to 2 products". */
  lose: string
  /** Yes: leave and drop the changes. */
  onConfirm: () => void
  /** No: stay and keep editing. */
  onKeep: () => void
}

/**
 * "Are you sure you want to cancel?" — asked when the ✕ Cancel icon is pressed in an
 * editor holding unsaved changes. Keep editing is focused (the safe choice); nothing is
 * thrown away until "Yes, cancel".
 */
export function ConfirmCancelDialog({
  lose,
  onConfirm,
  onKeep,
}: ConfirmCancelDialogProps) {
  return (
    <Dialog
      title="Cancel editing?"
      onClose={onKeep}
      footer={
        <>
          <button
            type="button"
            data-autofocus
            onClick={onKeep}
            className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`${BUTTON} bg-danger border-transparent text-white hover:opacity-90`}
          >
            Yes, cancel
          </button>
        </>
      }
    >
      <p>Are you sure you want to cancel?</p>
      <p>{`You will lose ${lose}.`}</p>
    </Dialog>
  )
}
