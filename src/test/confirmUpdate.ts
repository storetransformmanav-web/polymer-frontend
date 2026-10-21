import { screen } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'

/**
 * Answers "Are you sure you want to update this?" with "Yes, update", if it is being
 * asked. A save that was stopped earlier (a field is invalid, nothing changed) never
 * asks, and then this does nothing — so it is safe after any click on Save.
 */
export async function confirmUpdate(user: UserEvent) {
  const yes = screen.queryByRole('button', { name: 'Yes, update' })
  if (yes) await user.click(yes)
}
