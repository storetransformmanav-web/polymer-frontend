import { useState } from 'react'
import { signOutDevices } from '../store/authSlice.ts'
import { useAppDispatch } from '../store/hooks.ts'
import { Dialog } from '../../components/ui/Dialog.tsx'
import { FormMessage } from '../../components/ui/FormMessage.tsx'
import { LogoutIcon, SpinnerIcon } from '../../components/ui/icons.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

interface SignOutDevicesDialogProps {
  /** true: sign out the *other* devices and stay here; false: every device, this one too. */
  keepThisDevice: boolean
  onClose: () => void
}

/**
 * The question before ending sessions: "Sign out other devices?" (this one stays signed in) or
 * "Sign out of all devices?" (this one too — the login page opens afterwards). Cancel is focused;
 * nothing is sent until the red button. A refusal shows the backend's message and the dialog stays;
 * when other devices were signed out the dialog says so (with the backend's message) and offers
 * Close.
 */
export function SignOutDevicesDialog({
  keepThisDevice,
  onClose,
}: SignOutDevicesDialogProps) {
  const dispatch = useAppDispatch()
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function confirm() {
    if (isSending) return
    setIsSending(true)
    setError(null)
    const result = await dispatch(signOutDevices({ keepThisDevice }))
    setIsSending(false)
    if (signOutDevices.fulfilled.match(result)) {
      // Everywhere: the session is cleared and the login page takes over. Other devices only: say so.
      if (keepThisDevice)
        setDone(result.payload.message || 'Other devices were signed out.')
    } else {
      setError(result.payload ?? 'Something went wrong. Please try again.')
    }
  }

  const title = keepThisDevice ? 'Sign out other devices?' : 'Sign out of all devices?'

  return (
    <Dialog
      title={title}
      onClose={onClose}
      closeDisabled={isSending}
      icon={
        <span
          aria-hidden="true"
          className="bg-danger-bg text-danger flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        >
          <LogoutIcon width={20} height={20} />
        </span>
      }
      footer={
        done ? (
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
          >
            Close
          </button>
        ) : (
          <>
            <button
              type="button"
              data-autofocus
              disabled={isSending}
              onClick={onClose}
              className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSending}
              onClick={() => void confirm()}
              className={`${BUTTON} bg-danger border-transparent text-white hover:opacity-90`}
            >
              {isSending && (
                <SpinnerIcon width={14} height={14} className="animate-spin" />
              )}
              {keepThisDevice ? 'Sign out other devices' : 'Sign out of all devices'}
            </button>
          </>
        )
      }
    >
      {done ? (
        <FormMessage tone="success">{done}</FormMessage>
      ) : (
        <>
          <p className="text-text m-0 text-[0.95rem] font-semibold">
            {keepThisDevice
              ? 'Every other browser or device signed in to your account will be signed out.'
              : 'Every browser and device signed in to your account will be signed out, this one too.'}
          </p>
          <p className="m-0">
            {keepThisDevice
              ? 'This device stays signed in.'
              : 'You will go to the login page and sign in again.'}
          </p>
          {error && <FormMessage tone="error">{error}</FormMessage>}
        </>
      )}
    </Dialog>
  )
}
