import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api, type Profile, type ProfileUpdateBody } from '../../../lib/api/endpoints.ts'

/**
 * Updates the signed-in person's own profile (`PUT /hr/profile`). The moment the server confirms,
 * the updated profile it answers with replaces the cached one (so the page is right with no
 * loader), and the profile is then re-read quietly so what the backend worked out itself is true.
 * A write is never retried automatically; a refusal comes back as the backend's own message.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (body: ProfileUpdateBody) => api.hr.updateProfile(body),
    onSuccess: (result) => {
      if (result.profile) queryClient.setQueryData<Profile>(['profile'], result.profile)
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })

  return {
    update: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: mutation.isError ? toUserMessage(mutation.error) : null,
  }
}
