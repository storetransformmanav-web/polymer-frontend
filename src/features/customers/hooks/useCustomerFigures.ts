import { useEffect, useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  customerFigureFilters,
  customersCacheKey,
  fetchCustomers,
  type CustomerFilters,
} from '../../../app/store/customersSlice.ts'
import type { CustomerListResponse } from '../../../lib/api/endpoints.ts'

/** What the cards above the list show: the answer's `totals` and its `total`. */
export interface CustomerFigures {
  totals: CustomerListResponse['totals']
  total: number | null
}

/**
 * The figures of the cards above the list. Normally they are the list answer's own `totals` and
 * `total` (no request of their own). While a card is pressed (the Orders or the email-marketing
 * filter), that answer describes only the narrowed list — "With orders" on makes "Without
 * orders" read 0 — so the cards then read the answer for the same list **without** those two
 * filters: one cached one-row query (`customerFigureFilters`), asked for only while a card is
 * on. Until it arrives they keep showing the figures they had, so pressing a card never zeroes
 * the others.
 */
export function useCustomerFigures(
  filters: CustomerFilters,
  data: CustomerListResponse | null,
): CustomerFigures {
  const dispatch = useAppDispatch()
  const narrowed = filters.orders !== '' || filters.marketing !== ''
  const unfiltered = useMemo(() => customerFigureFilters(filters), [filters])
  const own = useAppSelector(
    (state) => state.customers.entries[customersCacheKey(unfiltered)]?.data,
  )

  // The last answer of a list that had neither filter: shown at once when a card is pressed.
  const [last, setLast] = useState<CustomerFigures>({ totals: undefined, total: null })
  if (!narrowed && data && (last.totals !== data.totals || last.total !== data.total)) {
    setLast({ totals: data.totals, total: data.total })
  }

  // Already-cached fresh answers are skipped by fetchCustomers' own `condition`.
  useEffect(() => {
    if (narrowed) void dispatch(fetchCustomers({ filters: unfiltered }))
  }, [dispatch, narrowed, unfiltered])

  if (narrowed) {
    return { totals: own?.totals ?? last.totals, total: own?.total ?? last.total }
  }
  return { totals: data?.totals, total: data?.total ?? null }
}
