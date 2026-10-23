import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { SpinnerIcon } from '../../../components/ui/icons.tsx'
import { useDeleteUser } from '../hooks/useDeleteUser.ts'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

export interface UserToDelete {
  id: string
  name: string
  email: string
}

interface UserDeleteDialogProps {
  user: UserToDelete
  onClose: () => void
  /** The delete went through; `message` is the backend's own words (may be empty). */
  onDone: (message: string) => void
}

/**
 * "Are you sure you want to delete this user?" — says plainly what a delete does (the
 * account is deactivated and hidden; its activity history is kept). Cancel is focused (the
 * safe choice); nothing is sent until Delete. Whatever the backend answers on a failure
 * is shown inside the dialog, which then stays open.
 */
export function UserDeleteDialog({ user, onClose, onDone }: UserDeleteDialogProps) {
  const { remove, isDeleting, error } = useDeleteUser()

  async function confirm() {
    try {
      const result = await remove(user.id)
      onDone(result.message)
    } catch {
      // The message is shown below (`error`); the dialog stays open.
    }
  }

  return (
    <Dialog
      title={`Delete “${user.name}”?`}
      onClose={onClose}
      closeDisabled={isDeleting}
      footer={
        <>
          <button
            type="button"
            data-autofocus
            disabled={isDeleting}
            onClick={onClose}
            className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => void confirm()}
            className={`${BUTTON} bg-danger text-bg border-transparent hover:opacity-90`}
          >
            {isDeleting && (
              <SpinnerIcon width={14} height={14} className="animate-spin" />
            )}
            Delete
          </button>
        </>
      }
    >
      <p>
        {user.email} will be deactivated and hidden from the list, and can no longer sign
        in. Their activity history is kept.
      </p>
      <p>Are you sure you want to delete this user?</p>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
