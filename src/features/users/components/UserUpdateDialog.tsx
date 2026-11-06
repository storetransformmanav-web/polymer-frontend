import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { InfoIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'
import type { Role, UserUpdateBody } from '../../../lib/api/endpoints.ts'
import { useUpdateUser } from '../hooks/useUpdateUser.ts'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

/** One change to show in the question: what it is, the value now and the value it becomes. */
export interface UserUpdateChange {
  label: string
  from: string
  to: string
}

/** What a small pencil asks for: what changes, and the body that makes it happen. */
export interface UserUpdateRequest {
  change: UserUpdateChange
  body: UserUpdateBody
  /** An extra line under the card, for a change with a side effect (a role without stores). */
  note?: string
}

interface UserUpdateDialogProps {
  userId: string
  /** The person's name, for the question: `Update “Jane Doe”?`. */
  name: string
  request: UserUpdateRequest
  /** Every role, so a changed role is shown by its display name straight away. */
  roles?: Role[]
  onClose: () => void
  /** The update went through; `message` is the backend's own words (may be empty). */
  onDone: (message: string) => void
}

/**
 * "Are you sure you want to update this?" — asked before any change to a user is saved, laid out
 * like the product page's update question (an icon and the name, the question, then a card with
 * the old value struck through → the new one). Cancel is focused (the safe choice); nothing is
 * sent until "Yes, update". Whatever the backend answers on a failure — a duplicate email, say —
 * is shown inside the dialog, which then stays open with the edit kept.
 */
export function UserUpdateDialog({
  userId,
  name,
  request,
  roles,
  onClose,
  onDone,
}: UserUpdateDialogProps) {
  const { update, isUpdating, error } = useUpdateUser(roles)

  async function confirm() {
    try {
      const result = await update({ id: userId, body: request.body })
      onDone(result.message)
    } catch {
      // The message is shown below (`error`); the dialog stays open.
    }
  }

  return (
    <Dialog
      title={`Update “${name}”?`}
      onClose={onClose}
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
            onClick={onClose}
            className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => void confirm()}
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
      <p className="text-text m-0 text-[0.95rem] font-semibold">
        Are you sure you want to update this?
      </p>
      <div className="border-border-strong border-l-accent bg-accent-tint/40 flex min-w-0 flex-col gap-2 border border-l-4 p-3">
        <p className="text-text-muted m-0 text-[0.7rem] leading-snug font-bold tracking-wide break-words uppercase">
          {request.change.label}
        </p>
        <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[1rem]">
          <span className="text-text-muted break-words line-through">
            {request.change.from}
          </span>
          <span aria-hidden="true" className="text-accent font-bold">
            →
          </span>
          <strong className="text-text break-words">{request.change.to}</strong>
        </p>
      </div>
      {request.note && <p className="m-0 text-[0.8rem]">{request.note}</p>}
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
