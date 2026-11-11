import { useCallback, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import { createCustomer, fetchCustomers } from '../../../app/store/customersSlice.ts'
import type {
  CustomerCreateBody,
  CustomerCreateResult,
} from '../../../lib/api/endpoints.ts'

/**
 * Makes a customer (`POST /customers`). Resolves with the store's answer, or null after showing
 * the backend's own message in `error` (a duplicate email, say) — everything typed stays. On
 * success every cached list page is marked stale and the current one is read again quietly, so
 * the new customer appears with no loader. Never retried (a repeat would make it twice).
 */
export function useCreateCustomer() {
  const dispatch = useAppDispatch()
  const filters = useAppSelector((state) => state.customers.filters)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useCallback(
    async (body: CustomerCreateBody): Promise<CustomerCreateResult | null> => {
      setIsCreating(true)
      setError(null)
      const result = await dispatch(createCustomer(body))
      setIsCreating(false)

      if (!createCustomer.fulfilled.match(result)) {
        setError(result.payload ?? 'Something went wrong. Please try again.')
        return null
      }

      void dispatch(fetchCustomers({ filters, force: true }))
      return result.payload
    },
    [dispatch, filters],
  )

  return { create, isCreating, error, clearError: () => setError(null) }
}
