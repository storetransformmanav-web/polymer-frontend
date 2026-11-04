import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '../../../lib/api/endpoints.ts'

/** How long typing must pause before the backend is asked. */
const PAUSE_MS = 250
/** Rows a search shows. */
export const PICK_LIMIT = 8

/** `text`, once typing has paused (trimmed). */
export function usePaused(text: string): string {
  const [paused, setPaused] = useState(text.trim())
  useEffect(() => {
    const timer = window.setTimeout(() => setPaused(text.trim()), PAUSE_MS)
    return () => window.clearTimeout(timer)
  }, [text])
  return paused
}

/**
 * The store's products matching what was typed (`GET /products?search=&shop=`), to add to an
 * order. Nothing is asked until something is typed; the previous answer stays while the next
 * loads.
 */
export function usePickProducts(shop: string, text: string) {
  const search = usePaused(text)
  return useQuery({
    queryKey: ['order-picker', 'products', shop, search],
    queryFn: () =>
      api.products.list({
        search,
        shop: shop || undefined,
        page_size: PICK_LIMIT,
        sort: 'title',
        order: 'asc',
      }),
    enabled: search.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

/** One product's variants (from its details), once it is opened in the picker. */
export function usePickVariants(productId: string | null) {
  return useQuery({
    queryKey: ['order-picker', 'product', productId],
    queryFn: () => api.products.details(productId ?? ''),
    enabled: Boolean(productId),
    staleTime: 60_000,
  })
}

/** The store's customers matching what was typed (`GET /customers?role=all&search=&shop=`). */
export function usePickCustomers(shop: string, text: string) {
  const search = usePaused(text)
  return useQuery({
    queryKey: ['order-picker', 'customers', shop, search],
    queryFn: () =>
      api.customers.list({
        search,
        role: 'all',
        shop: shop || undefined,
        page_size: PICK_LIMIT,
      }),
    enabled: search.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}
