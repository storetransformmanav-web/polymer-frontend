import { useCallback, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  fetchCustomerDetails,
  fetchCustomers,
  updateCustomer,
} from '../../../app/store/customersSlice.ts'
import type { CustomerUpdateBody } from '../../../lib/api/endpoints.ts'

interface UpdateArg {
  id: string
  /** The customer's store key (sent as `shop=`), when known. */
  shop?: string | null
  body: CustomerUpdateBody
}

/**
 * Saves a change to a customer (`PUT /customers/{ref}`).
 *
 * The moment the server confirms, every cached copy shows the new values (see
 * `updateCustomer.fulfilled` in customersSlice) — no loader. This hook then re-reads the
 * customer and the list quietly, so what stays on screen is what Shopify answered. A failure is
 * returned as the backend's own message and nothing changes on screen. Never retried.
 */
export function useUpdateCustomer() {
  const dispatch = useAppDispatch()
  const filters = useAppSelector((state) => state.customers.filters)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = useCallback(
    async ({ id, shop, body }: UpdateArg): Promise<{ message: string } | null> => {
      setIsUpdating(true)
      setError(null)
      const result = await dispatch(updateCustomer({ id, shop, body }))
      setIsUpdating(false)

      if (!updateCustomer.fulfilled.match(result)) {
        setError(result.payload ?? 'Something went wrong. Please try again.')
        return null
      }

      void dispatch(fetchCustomerDetails({ id, force: true }))
      void dispatch(fetchCustomers({ filters, force: true }))
      return { message: result.payload.message }
    },
    [dispatch, filters],
  )

  return { update, isUpdating, error, clearError: () => setError(null) }
}
