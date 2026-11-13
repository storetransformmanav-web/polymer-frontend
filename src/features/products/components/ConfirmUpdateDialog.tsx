import { Dialog } from '../../../components/ui/Dialog.tsx'
import { CheckIcon, PencilIcon, ProductsIcon } from '../../../components/ui/icons.tsx'

const BUTTON =
  'inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3.5 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

/** `Update “Hippo Bag”?` is shown as a heading, "Update product", over the name in quotes. */
const UPDATE_QUESTION = /^Update (“.*”)\?$/

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
  const named = UPDATE_QUESTION.exec(title)
  return (
    <Dialog
      title={title}
      banded
      heading={named ? 'Update product' : title}
      subtitle={named?.[1]}
      onClose={onCancel}
      icon={
        <span
          aria-hidden="true"
          className="bg-accent-tint text-accent border-accent/20 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
        >
          <PencilIcon width={17} height={17} />
        </span>
      }
      footer={
        <>
          <button
            type="button"
            data-autofocus
            onClick={onCancel}
            className={`${BUTTON} border-border-strong bg-bg text-text hover:border-accent`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
          >
            <CheckIcon width={15} height={15} />
            Yes, update
          </button>
        </>
      }
    >
      <div className="flex flex-col items-start gap-0.5 text-left">
        <p className="text-text m-0 text-[0.9rem] font-semibold">
          Are you sure you want to update this?
        </p>
        <p className="m-0 text-[0.8rem]">
          These changes will also be updated in Shopify.
        </p>
      </div>
      {change && (
        <div className="border-border bg-accent-tint/40 flex min-w-0 items-start gap-2.5 rounded-xl border px-3 py-2.5">
          <ProductsIcon width={18} height={18} className="text-accent mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            {/* What changes, in capitals: it wraps, however long (a location's whole address). */}
            <p className="text-text m-0 text-[0.74rem] leading-snug font-semibold tracking-wide [overflow-wrap:anywhere] uppercase">
              {change.label}
            </p>
            <p className="m-0 mt-1.5 flex flex-wrap items-center gap-2">
              <span className="bg-border/60 text-text rounded-md px-2.5 py-0.5 text-[0.9rem] [overflow-wrap:anywhere]">
                {change.from || '—'}
              </span>
              <span aria-hidden="true" className="text-accent text-[1rem] font-bold">
                →
              </span>
              <strong className="bg-accent-tint text-accent border-accent/30 rounded-md border px-2.5 py-0.5 text-[0.9rem] [overflow-wrap:anywhere]">
                {change.to || '—'}
              </strong>
            </p>
          </div>
        </div>
      )}
      {note && <p className="m-0 text-left text-[0.8rem]">{note}</p>}
    </Dialog>
  )
}
