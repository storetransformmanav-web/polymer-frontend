import { Dialog } from '../../../components/ui/Dialog.tsx'
import { InfoIcon } from '../../../components/ui/icons.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

/** One change to show in the question: what it is, the value now and the value it becomes. */
export interface UpdateChange {
  label: string
  from: string
  to: string
}

interface ConfirmUpdateDialogProps {
  /** The question, e.g. `Update “Hippo Bag”?`. */
  title: string
  /** What is about to change, shown in a card under the question ("Price of Small: £50.00 → £60.00"). */
  change?: UpdateChange
  /** An extra line under the card, for a change with a side effect (a stock move). */
  note?: string
  /** Yes: go ahead and save. */
  onConfirm: () => void
  /** No: close without saving anything. */
  onCancel: () => void
}

/**
 * "Are you sure you want to update this?" — asked before any change to a product is
 * saved, because a saved change is also sent to Shopify. Cancel is focused (the
 * safe choice); nothing is sent until "Yes, update". The same wording and layout for every
 * update: an icon and the product's name, the question, then — when there is one — a card
 * with what changes (long names wrap, they never push the window sideways).
 */
export function ConfirmUpdateDialog({
  title,
  change,
  note,
  onConfirm,
  onCancel,
}: ConfirmUpdateDialogProps) {
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
      {change && (
        <div className="border-border-strong border-l-accent bg-accent-tint/40 flex min-w-0 flex-col gap-2 border border-l-4 p-3">
          <p className="text-text-muted m-0 text-[0.7rem] leading-snug font-bold tracking-wide break-words uppercase">
            {change.label}
          </p>
          <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[1rem]">
            <span className="text-text-muted break-words line-through">
              {change.from}
            </span>
            <span aria-hidden="true" className="text-accent font-bold">
              →
            </span>
            <strong className="text-text break-words">{change.to}</strong>
          </p>
        </div>
      )}
      {note && <p className="m-0 text-[0.8rem]">{note}</p>}
    </Dialog>
  )
}
