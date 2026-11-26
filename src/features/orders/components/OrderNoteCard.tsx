import { useState, type KeyboardEvent } from 'react'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { IconAction } from '../../../components/ui/IconAction.tsx'
import {
  CheckIcon,
  InfoIcon,
  ListChecksIcon,
  PencilIcon,
  SpinnerIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { useAccess } from '../../../hooks/useAccess.ts'
import type { OrderDetail } from '../../../lib/api/endpoints.ts'
import { useUpdateOrder } from '../hooks/useUpdateOrder.ts'
import { FIELD_TEXTAREA, PRIMARY_BUTTON, SECONDARY_BUTTON } from './create/formParts.tsx'
import { EmptyNote, FoldCard } from './OrderCompact.tsx'

/** What the page needs to send a change to this order and read it again. */
export interface OrderNoteCardProps {
  order: OrderDetail
  /** The order number and store from the address (how the shown order is cached). */
  reference: string
  shop: string | null
}

/**
 * The **Order note** card. Its pencil turns the note into a box with ✓ Save and ✕ Discard
 * (Escape too). ✓ asks first, because the change also goes to Shopify, and only "Yes, update"
 * sends one `PATCH /orders/{id}` with the note as `staff_note` — the only note the update API
 * takes. The card then shows whatever the API answers when the order is read again.
 */
export function OrderNoteCard({ order, reference, shop }: OrderNoteCardProps) {
  const { canManage } = useAccess('orders')
  const { update, isUpdating, error, clearError } = useUpdateOrder(
    order.id,
    reference,
    shop,
  )
  /** The box's text while editing; null while the note is only shown. */
  const [draft, setDraft] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<{ message: string; warnings: string[] } | null>(
    null,
  )
  /** The backend answered, but said nothing was applied. */
  const [refused, setRefused] = useState<string | null>(null)

  const note = order.note?.trim() ?? ''
  const next = draft?.trim() ?? ''
  const changed = next !== '' && next !== note

  const discard = () => {
    setDraft(null)
    setConfirming(false)
    setRefused(null)
    clearError()
  }
  const cancelQuestion = () => {
    setConfirming(false)
    setRefused(null)
    clearError()
  }

  async function confirm() {
    if (!changed || isUpdating) return
    setRefused(null)
    try {
      const answer = await update({ staff_note: next })
      const warnings = answer.warnings ?? []
      if (answer.applied === false) {
        setRefused(
          [answer.message || 'The change was not applied.', ...warnings].join(' '),
        )
        return
      }
      setResult({ message: answer.message || 'Order updated.', warnings })
      setDraft(null)
      setConfirming(false)
    } catch {
      // The hook holds the backend's message; the question stays open with the text kept.
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !confirming) {
      event.stopPropagation()
      discard()
    }
  }

  const actions = !canManage ? undefined : draft === null ? (
    <IconAction
      label="Edit"
      accessibleLabel="Edit order note"
      icon={PencilIcon}
      onClick={() => {
        setResult(null)
        setDraft(order.note ?? '')
      }}
    />
  ) : (
    <>
      <IconAction
        label="Save"
        accessibleLabel="Save order note"
        icon={CheckIcon}
        tone="primary"
        disabled={!changed}
        busy={isUpdating}
        onClick={() => setConfirming(true)}
      />
      <IconAction
        label="Discard"
        accessibleLabel="Discard order note changes"
        icon={XIcon}
        tone="danger"
        disabled={isUpdating}
        onClick={discard}
      />
    </>
  )

  const failure = refused ?? error

  return (
    <>
      <FoldCard
        title="Order note"
        icon={ListChecksIcon}
        actions={actions}
        forceOpen={draft !== null}
      >
        <div className="flex flex-col gap-2">
          {result && (
            <FormMessage tone="success">
              {[result.message, ...result.warnings].join(' ')}
            </FormMessage>
          )}
          {draft !== null ? (
            <div onKeyDown={onKeyDown} className="py-1.5">
              <textarea
                autoFocus
                aria-label="Order note"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className={FIELD_TEXTAREA}
              />
            </div>
          ) : note ? (
            <p className="m-0 py-1 text-[0.82rem] leading-relaxed whitespace-pre-line">
              {order.note}
            </p>
          ) : (
            <EmptyNote>No note on this order.</EmptyNote>
          )}
        </div>
      </FoldCard>

      {confirming && (
        <Dialog
          title={`Update order #${order.order_number ?? order.name}?`}
          role="alertdialog"
          onClose={() => !isUpdating && cancelQuestion()}
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
                onClick={cancelQuestion}
                className={SECONDARY_BUTTON}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => void confirm()}
                className={PRIMARY_BUTTON}
              >
                {isUpdating && (
                  <SpinnerIcon width={14} height={14} className="animate-spin" />
                )}
                {isUpdating ? 'Updating…' : 'Yes, update'}
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
          <p className="border-border-strong border-l-accent bg-accent-tint/40 m-0 min-w-0 border border-l-4 p-3 text-[0.85rem] break-words whitespace-pre-line">
            {next}
          </p>
          {failure && <FormMessage tone="error">{failure}</FormMessage>}
        </Dialog>
      )}
    </>
  )
}
