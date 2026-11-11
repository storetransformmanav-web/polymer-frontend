import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { InfoIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

interface CustomerUpdateDialogProps {
  /** The question, e.g. `Update “Ada Lovelace”?`. */
  title: string
  /** Tags the customer gets / loses with this save. */
  added: string[]
  removed: string[]
  isUpdating: boolean
  /** The backend's refusal, shown here while the dialog stays open. */
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}

/**
 * "Are you sure you want to update this?" — asked before a customer is changed, because the
 * change is also sent to Shopify. The same wording and layout as a product's update question:
 * an icon and the name, the question, then a card with what changes. Cancel is focused (the safe
 * choice); nothing is sent until "Yes, update"; a refusal shows inside, and the dialog stays.
 */
export function CustomerUpdateDialog({
  title,
  added,
  removed,
  isUpdating,
  error,
  onConfirm,
  onCancel,
}: CustomerUpdateDialogProps) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      closeDisabled={isUpdating}
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
            disabled={isUpdating}
            onClick={onCancel}
            className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isUpdating}
            onClick={onConfirm}
            className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
          >
            {isUpdating && (
              <SpinnerIcon width={14} height={14} className="animate-spin" />
            )}
            Yes, update
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-text m-0 text-[0.95rem] font-semibold">
          Are you sure you want to update this?
        </p>
        <p className="m-0">These changes will also be updated in Shopify.</p>
      </div>
      <div className="border-border-strong border-l-accent bg-accent-tint/40 flex min-w-0 flex-col gap-2 border border-l-4 p-3">
        <p className="text-text-muted m-0 text-[0.7rem] leading-snug font-bold tracking-wide uppercase">
          Tags
        </p>
        {added.length > 0 && (
          <p className="m-0 text-[0.9rem] break-words">
            <span className="text-text-muted">Add: </span>
            <strong className="text-accent">{added.join(', ')}</strong>
          </p>
        )}
        {removed.length > 0 && (
          <p className="m-0 text-[0.9rem] break-words">
            <span className="text-text-muted">Remove: </span>
            <strong className="text-danger">{removed.join(', ')}</strong>
          </p>
        )}
      </div>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
