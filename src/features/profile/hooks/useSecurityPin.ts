import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toUserMessage, ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
  type PinRequestBody,
  type PinVerifyBody,
} from '../../../lib/api/endpoints.ts'

/**
 * The two calls behind the security PIN window: email a code, then check it. Neither is retried.
 * Nothing is kept once the window closes (`gcTime: 0`), because the answer can carry the PIN and
 * the request carries the code. After a change the profile is read again.
 */
export function useSecurityPin() {
  const queryClient = useQueryClient()

  const request = useMutation({
    mutationFn: (body: PinRequestBody) => api.hr.requestPinCode(body),
    retry: false,
    gcTime: 0,
  })
  const verify = useMutation({
    mutationFn: (body: PinVerifyBody) => api.hr.verifyPin(body),
    retry: false,
    gcTime: 0,
    onSuccess: (_result, body) => {
      if (body.action === 'change') {
        void queryClient.invalidateQueries({ queryKey: ['profile'] })
      }
    },
  })

  return {
    requestCode: request.mutateAsync,
    isRequesting: request.isPending,
    requestError: request.isError ? toUserMessage(request.error) : null,
    /** The backend refused a new code for now: one was already sent. */
    isRateLimited: request.error instanceof ApiError && request.error.status === 429,
    verifyCode: verify.mutateAsync,
    isVerifying: verify.isPending,
    verifyError: verify.isError ? toUserMessage(verify.error) : null,
    clearVerifyError: verify.reset,
  }
}
