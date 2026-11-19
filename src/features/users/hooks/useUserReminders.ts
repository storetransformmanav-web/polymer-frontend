import { useMutation } from '@tanstack/react-query'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'

/**
 * Switches one user's email reminders on (`PUT /users/reminders` with `enabled: true`). The
 * toggle only calls the API when it is turned on — turning it off sends nothing. A write is never
 * retried automatically — see lib/api/client.ts. A refusal is returned as the backend's message.
 */
export function useUserReminders() {
  const mutation = useMutation({
    mutationFn: (userId: string) => api.users.setReminders([userId], true),
  })

  return {
    enable: mutation.mutateAsync,
    isSaving: mutation.isPending,
    error: mutation.isError ? toUserMessage(mutation.error) : null,
    clearError: mutation.reset,
  }
}
