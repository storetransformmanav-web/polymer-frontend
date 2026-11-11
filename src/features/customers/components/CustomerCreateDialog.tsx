import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { InfoIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

interface CustomerCreateDialogProps {
  /** The question, e.g. `Create “Sergio Dizio”?`. */
  title: string
  /** Label / value lines of what will be made (store, email, tags…). */
  summary: { label: string; value: string }[]
  isCreating: boolean
  /** The backend's refusal, shown here while the dialog stays open. */
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}

/**
 * "Are you sure you want to create this customer?" — asked before `POST /customers`, because the
 * customer is also made in Shopify. Cancel is focused (the safe choice); nothing is sent until
 * "Yes, create"; a refusal shows inside the question, which stays open with everything typed.
 */
export function CustomerCreateDialog({
  title,
  summary,
  isCreating,
  error,
  onConfirm,
  onCancel,
}: CustomerCreateDialogProps) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      closeDisabled={isCreating}
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
            disabled={isCreating}
            onClick={onCancel}
            className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isCreating}
            onClick={onConfirm}
            className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
          >
            {isCreating && (
              <SpinnerIcon width={14} height={14} className="animate-spin" />
            )}
            Yes, create
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-text m-0 text-[0.95rem] font-semibold">
          Are you sure you want to create this customer?
        </p>
        <p className="m-0">It will also be created in Shopify.</p>
      </div>
      <dl className="border-border-strong border-l-accent bg-accent-tint/40 m-0 flex min-w-0 flex-col gap-2 border border-l-4 p-3">
        {summary.map((row) => (
          <div key={row.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-text-muted text-[0.7rem] leading-snug font-bold tracking-wide uppercase">
              {row.label}
            </dt>
            <dd className="m-0 text-[0.9rem] font-medium break-words">{row.value}</dd>
          </div>
        ))}
      </dl>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
