import { useState } from 'react'
import type { UserItem } from '../../../lib/api/endpoints.ts'
import { useUserReminders } from '../hooks/useUserReminders.ts'

/**
 * A Yes / No toggle for a user's email reminders. Turning it on sends `PUT /users/reminders`
 * `{ user_ids: [id], enabled: true }` and shows "Yes" once the server accepts it (a refusal puts
 * it back to "No" and shows the backend's message); turning it off calls nothing.
 */
export function UserReminderToggle({ user, name }: { user: UserItem; name: string }) {
  const reminders = useUserReminders()
  const [on, setOn] = useState(user.reminders_enabled === true)

  async function toggle() {
    if (reminders.isSaving) return
    if (on) {
      reminders.clearError()
      setOn(false)
      return
    }
    reminders.clearError()
    try {
      await reminders.enable(user.id)
      setOn(true)
    } catch {
      // The hook keeps the backend's message; the toggle stays off.
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`Email reminders for ${name}`}
          disabled={reminders.isSaving}
          onClick={() => void toggle()}
          className={`focus-visible:outline-accent relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-none p-0 transition-colors focus-visible:outline-2 disabled:pointer-events-none disabled:opacity-50 ${
            on ? 'bg-accent' : 'bg-border-strong'
          }`}
        >
          <span
            aria-hidden="true"
            className={`bg-bg absolute top-0.5 left-0.5 h-4 w-4 rounded-full shadow-sm transition-transform ${
              on ? 'translate-x-4' : ''
            }`}
          />
        </button>
        <span className="text-[0.78rem] font-medium" aria-hidden="true">
          {on ? 'Yes' : 'No'}
        </span>
      </span>
      {reminders.error && (
        <span
          role="alert"
          className="text-danger max-w-40 text-[0.7rem] whitespace-normal"
        >
          {reminders.error}
        </span>
      )}
    </span>
  )
}
