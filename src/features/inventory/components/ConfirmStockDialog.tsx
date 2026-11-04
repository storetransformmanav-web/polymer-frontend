import { Dialog } from '../../../components/ui/Dialog.tsx'
import { InfoIcon } from '../../../components/ui/icons.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

/**
 * "Are you sure you want to update this?" for a stock change made in a table cell: the same
 * question, wording and layout as every other update, with the change in a card (what it is,
 * the number now → the number it becomes). Cancel is focused; nothing is sent until "Yes, update".
 */
export function ConfirmStockDialog({
  title,
  change,
  onConfirm,
  onCancel,
}: {
  title: string
  change: { label: string; from: string; to: string }
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
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
      <div className="flex flex-col gap-0.5">
        <p className="text-text m-0 text-[0.95rem] font-semibold">
          Are you sure you want to update this?
        </p>
        <p className="m-0">These changes will also be updated in Shopify.</p>
      </div>
      <div className="border-border-strong border-l-accent bg-accent-tint/40 flex min-w-0 flex-col gap-2 border border-l-4 p-3">
        <p className="text-text-muted m-0 text-[0.7rem] leading-snug font-bold tracking-wide break-words uppercase">
          {change.label}
        </p>
        <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[1rem]">
          <span className="text-text-muted break-words">{change.from}</span>
          <span aria-hidden="true" className="text-accent font-bold">
            →
          </span>
          <strong className="text-text break-words">{change.to}</strong>
        </p>
      </div>
    </Dialog>
  )
}
