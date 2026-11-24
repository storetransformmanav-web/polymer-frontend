import { useMutation } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useAppDispatch } from '../../../app/store/hooks.ts'
import { fetchCustomerDetails } from '../../../app/store/customersSlice.ts'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import {
  api,
  type CustomerPasswordBody,
  type CustomerPasswordResult,
} from '../../../lib/api/endpoints.ts'

interface SetPasswordArg {
  /** The customer's CRM id (UUID), Shopify id or email. */
  id: string
  /** The customer's store key (sent as `shop=`), when known. */
  shop?: string | null
  body: CustomerPasswordBody
}

/**
 * Sets or resets a customer's website password (`PUT /customers/{ref}/password`). Every rule —
 * strength, the two boxes matching, once per customer per minute — is the backend's: a refusal is
 * returned as its own message (`error`) and nothing is kept. On success the customer is re-read
 * quietly (the account state becomes `ENABLED`). Never retried: the password is not resent.
 */
export function useSetCustomerPassword() {
  const dispatch = useAppDispatch()
  const mutation = useMutation({
    mutationFn: ({ id, shop, body }: SetPasswordArg) =>
      api.customers.setPassword(id, body, shop),
    retry: false,
    onSuccess: (_result, { id }) => {
      void dispatch(fetchCustomerDetails({ id, force: true }))
    },
  })

  const { mutateAsync, reset } = mutation
  /** Resolves with the backend's answer, or its refusal in its own words (also in `error`). */
  const setPassword = useCallback(
    async (
      arg: SetPasswordArg,
    ): Promise<{ result: CustomerPasswordResult } | { error: string }> => {
      try {
        return { result: await mutateAsync(arg) }
      } catch (caught) {
        return { error: toUserMessage(caught) }
      }
    },
    [mutateAsync],
  )

  return {
    setPassword,
    isSaving: mutation.isPending,
    error: mutation.isError ? toUserMessage(mutation.error) : null,
    clearError: reset,
  }
}
