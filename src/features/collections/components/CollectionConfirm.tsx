import { useState, type ReactNode } from 'react'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { InfoIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'
import { toUserMessage } from '../../../lib/api/ApiError.ts'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

/**
 * "Are you sure?" before a collection is created or changed (it is also changed in Shopify, which
 * can take a few seconds). Cancel is focused; nothing is sent until the confirm button, a second
 * press is ignored while it runs, and a refusal shows the backend's message inside.
 */
export function CollectionConfirm({
  title,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
  children,
}: {
  title: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => Promise<void>
  onClose: () => void
  children: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    if (busy) return
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
      icon={
        <span
          aria-hidden="true"
          className="bg-accent-tint text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        >
          <InfoIcon width={20} height={20} />
        </span>
      }
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
            {busy ? 'Saving to Shopify…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2 text-[0.85rem]">{children}</div>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
