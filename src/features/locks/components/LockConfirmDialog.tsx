import { useState, type ReactNode } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { SpinnerIcon } from '../../../components/ui/icons.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

interface LockConfirmDialogProps {
  title: string
  children: ReactNode
  confirmLabel: string
  /** The write. A refusal keeps the dialog open and shows the backend's message in it. */
  onConfirm: () => Promise<unknown>
  onClose: () => void
  /** A destructive confirm button (removing a tag) rather than the accent one. */
  danger?: boolean
}

/**
 * "Are you sure?" before a lock change, because it is also pushed to the store. Cancel is
 * focused; nothing is sent until the confirm button, and a failure stays inside the dialog.
 */
export function LockConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  danger = false,
}: LockConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (caught) {
      setError(toUserMessage(caught))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={title}
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
            disabled={busy}
            onClick={() => void confirm()}
            className={`${BUTTON} border-transparent text-white hover:opacity-90 ${danger ? 'bg-danger' : 'bg-accent'}`}
          >
            {busy && <SpinnerIcon width={16} height={16} className="animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
