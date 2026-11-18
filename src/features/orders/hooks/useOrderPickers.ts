import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
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

/** Products a page of the picker's list holds (the next page loads as the list is scrolled). */
export const PRODUCT_PAGE = 20

/**
 * The store's products **that are in stock** (`GET /products?in_stock=true&shop=`), A–Z, to add to
 * an order: every one of them when nothing is typed, narrowed by `search` as you type. 20 at a time —
 * `fetchNextPage` brings the next 20 when the list is scrolled to its end. Nothing is asked until
 * `enabled` (the box was focused or something typed); the previous answer stays while the next loads.
 */
export function usePickProducts(shop: string, text: string, enabled: boolean) {
  const search = usePaused(text)
  return useInfiniteQuery({
    queryKey: ['order-picker', 'products', shop, search],
    queryFn: ({ pageParam }) =>
      api.products.list({
        ...(search ? { search } : {}),
        shop: shop || undefined,
        in_stock: true,
        page: pageParam,
        page_size: PRODUCT_PAGE,
        sort: 'title',
        order: 'asc',
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.has_next ? last.page + 1 : undefined),
    enabled: enabled || search.length > 0,
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
