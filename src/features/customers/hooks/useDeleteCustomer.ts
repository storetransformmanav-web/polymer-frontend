import { useCallback, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  deleteCustomer,
  fetchCustomers,
  roleCountFilters,
} from '../../../app/store/customersSlice.ts'

/** Every role tab, so their counts can be refreshed (a deletion changes them). */
const ROLE_TABS = ['', 'administrator', 'subscriber'] as const

interface DeleteArg {
  id: string
  /** The customer's store key (sent as `shop=`), when known. */
  shop?: string | null
}

/**
 * Deletes a customer in the store and the CRM.
 *
 * The moment the server confirms, the customer is gone from every cached page and
 * details copy (see `deleteCustomer.fulfilled` in customersSlice) — no loader, no
 * waiting for a refetch. This hook then re-reads the list and the role counts
 * quietly. A failure (Shopify refuses a customer with orders, for one) is returned
 * as the backend's own message and nothing changes on screen.
 */
export function useDeleteCustomer() {
  const dispatch = useAppDispatch()
  const filters = useAppSelector((state) => state.customers.filters)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = useCallback(
    async ({ id, shop }: DeleteArg): Promise<{ message: string } | null> => {
      setIsDeleting(true)
      setError(null)
      const result = await dispatch(deleteCustomer({ id, shop }))
      setIsDeleting(false)

      if (!deleteCustomer.fulfilled.match(result)) {
        setError(result.payload ?? 'Something went wrong. Please try again.')
        return null
      }

      void dispatch(fetchCustomers({ filters, force: true }))
      for (const role of ROLE_TABS) {
        void dispatch(
          fetchCustomers({ filters: roleCountFilters(filters, role), force: true }),
        )
      }
      return result.payload
    },
    [dispatch, filters],
  )

  return { remove, isDeleting, error, clearError: () => setError(null) }
}
