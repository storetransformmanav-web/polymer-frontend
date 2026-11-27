import { useState } from 'react'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { CheckIcon } from '../../../components/ui/icons.tsx'
import { useAuth } from '../../../hooks/useAuth.ts'
import { SecurityPinDialog } from './SecurityPinDialog.tsx'

/** The popup that can't be closed has nothing to do when asked to close. */
const stay = () => undefined

/**
 * **Set your security PIN** — shown over the whole app while the backend says the signed-in person
 * must set a PIN (`pin_change_required`, from signing in or `GET /auth/me`). It can't be skipped:
 * there is no ✕ or Cancel, and Escape and the backdrop do nothing; the only other way out is to
 * sign out. It is the PIN window's change flow (emailed code, then the new PIN twice). Once the
 * backend has accepted the PIN it says so, and Continue puts the app back in use.
 */
export function RequiredPinDialog() {
  const { user, logout, pinChangeDone } = useAuth()
  /** The backend's words once the PIN is set; null until then. */
  const [done, setDone] = useState<string | null>(null)

  if (!user) return null

  if (done !== null) {
    return (
      <Dialog
        title="Security PIN set"
        role="dialog"
        onClose={stay}
        closeDisabled
        footer={
          <button
            type="button"
            data-autofocus
            onClick={pinChangeDone}
            className="bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-lg border-none px-4 text-[0.88rem] font-semibold transition-colors"
          >
            Continue
          </button>
        }
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <span
            aria-hidden="true"
            className="bg-accent-tint text-accent flex h-14 w-14 items-center justify-center rounded-full"
          >
            <CheckIcon width={28} height={28} />
          </span>
          <p role="status" className="text-text m-0 text-[0.92rem] font-semibold">
            {done || 'Your security PIN has been set.'}
          </p>
        </div>
      </Dialog>
    )
  }

  return (
    <SecurityPinDialog
      required
      action="change"
      userId={user.id}
      email={user.email ?? ''}
      onClose={stay}
      onSignOut={logout}
      onViewed={stay}
      onChanged={setDone}
    />
  )
}
