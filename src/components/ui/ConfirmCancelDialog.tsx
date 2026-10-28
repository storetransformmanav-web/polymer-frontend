import { Dialog } from './Dialog.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

interface ConfirmCancelDialogProps {
  /** What would be lost, e.g. "your unsaved changes to 2 products". */
  lose?: string
  /** A different question than "Cancel editing?" (say what is being thrown away). */
  title?: string
  /** The line under the title when `title` is given (else "Are you sure you want to cancel?"). */
  question?: string
  /** The line saying what is lost (else "You will lose {lose}."). */
  detail?: string
  keepLabel?: string
  confirmLabel?: string
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
  title = 'Cancel editing?',
  question = 'Are you sure you want to cancel?',
  detail,
  keepLabel = 'Keep editing',
  confirmLabel = 'Yes, cancel',
  onConfirm,
  onKeep,
}: ConfirmCancelDialogProps) {
  return (
    <Dialog
      title={title}
      onClose={onKeep}
      footer={
        <>
          <button
            type="button"
            data-autofocus
            onClick={onKeep}
            className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
          >
            {keepLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`${BUTTON} bg-danger border-transparent text-white hover:opacity-90`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {question && <p>{question}</p>}
      <p>{detail ?? `You will lose ${lose}.`}</p>
    </Dialog>
  )
}
