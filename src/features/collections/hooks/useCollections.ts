import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { ALL_SHOPS, shopLabel, shopValue } from '../../../app/store/shopSlice.ts'
import { useShops } from '../../../hooks/useShops.ts'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import {
  api,
  type CollectionCreateBody,
  type CollectionDetail,
  type CollectionListParams,
  type CollectionProductSort,
  type CollectionProductsParams,
  type CollectionUpdateBody,
} from '../../../lib/api/endpoints.ts'

const STALE_MS = 30_000

/** Every cached collection read starts with this (a write marks them all stale). */
const ROOT = 'collections'

/** The list's filters (local to the page). */
export interface CollectionFilters {
  search: string
  type: '' | 'custom' | 'smart'
  sort: 'title' | 'products' | 'updated'
  order: 'asc' | 'desc'
  page: number
  pageSize: number
}

export const DEFAULT_COLLECTION_FILTERS: CollectionFilters = {
  search: '',
  type: '',
  sort: 'title',
  order: 'asc',
  page: 1,
  pageSize: 50,
}

/**
 * The store the page works on. The list follows the top-bar dropdown (`shop`, or every store with
 * "All shops"); a new collection needs exactly one store — the one picked, else the first
 * connected one.
 */
export function useCollectionShop() {
  const { shops, selected, status } = useShops()
  return useMemo(() => {
    const live = shops.filter((shop) => shop.connected && shop.is_active)
    const usable = live.length > 0 ? live : shops
    const chosen =
      selected !== ALL_SHOPS
        ? usable.find((shop) => shopValue(shop) === selected)
        : undefined
    const createIn = chosen ?? usable[0]
    return {
      /** Sent as `shop` on the list: '' means every store. */
      listShop: selected !== ALL_SHOPS ? selected : '',
      /** The store a new collection is made in. */
      createShop: createIn ? shopValue(createIn) : '',
      createShopName: createIn ? shopLabel(createIn) : '',
      status,
    }
  }, [shops, selected, status])
}

/** `GET /collections`: one page, searched, filtered and sorted by the backend. */
export function useCollections(shop: string) {
  const [filters, setFiltersState] = useState(DEFAULT_COLLECTION_FILTERS)
  const params: CollectionListParams = {
    sort: filters.sort,
    order: filters.order,
    page: filters.page,
    page_size: filters.pageSize,
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(shop ? { shop } : {}),
  }
  const query = useQuery({
    queryKey: [ROOT, 'list', params],
    queryFn: () => api.collections.list(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  })
  return {
    filters,
    data: query.data ?? null,
    items: query.data?.items ?? [],
    isPending: query.isPending,
    isFetching: query.isFetching,
    isShowingPrevious: query.isPlaceholderData,
    error: query.isError && !query.data ? toUserMessage(query.error) : null,
    hasFilters: filters.search.trim() !== '' || filters.type !== '',
    retry: () => void query.refetch(),
    /** Anything but an explicit page change goes back to page 1. */
    setFilters: (changes: Partial<CollectionFilters>) =>
      setFiltersState((current) => ({
        ...current,
        ...changes,
        page: 'page' in changes ? (changes.page ?? 1) : 1,
      })),
    resetFilters: () =>
      setFiltersState((current) => ({
        ...DEFAULT_COLLECTION_FILTERS,
        sort: current.sort,
        order: current.order,
        pageSize: current.pageSize,
      })),
  }
}

/** `GET /collections/rule-options`: loaded once and kept (it rarely changes). */
export function useCollectionRuleOptions(enabled = true) {
  const query = useQuery({
    queryKey: [ROOT, 'rule-options'],
    queryFn: () => api.collections.ruleOptions(),
    staleTime: 60 * 60_000,
    gcTime: 60 * 60_000,
    enabled,
  })
  return {
    options: query.data ?? null,
    columns: query.data?.columns ?? [],
    isPending: query.isPending,
    error: query.isError ? toUserMessage(query.error) : null,
    retry: () => void query.refetch(),
  }
}

/** The product table's own state on a collection's page. */
export interface CollectionProductsState {
  search: string
  sort: CollectionProductSort
  order: 'asc' | 'desc'
  page: number
  pageSize: number
}

export const DEFAULT_PRODUCTS_STATE: CollectionProductsState = {
  search: '',
  sort: 'position',
  order: 'asc',
  page: 1,
  pageSize: 20,
}

const detailKey = (id: string) => [ROOT, 'detail', id] as const

/**
 * One collection (`GET /collections/{id}`, its first page of products included) and the page of
 * products the table shows. The first page with the default sort comes with the details; any other
 * page, search or sort asks the lighter `GET /collections/{id}/products`.
 */
export function useCollectionDetails(id: string, shop: string) {
  const [table, setTableState] = useState(DEFAULT_PRODUCTS_STATE)
  const details = useQuery({
    queryKey: [...detailKey(id), shop],
    queryFn: () => api.collections.detail(id, shop ? { shop } : {}),
    staleTime: STALE_MS,
    enabled: id !== '',
  })

  const isFirstPage =
    table.page === 1 &&
    table.search.trim() === '' &&
    table.sort === DEFAULT_PRODUCTS_STATE.sort &&
    table.order === DEFAULT_PRODUCTS_STATE.order &&
    table.pageSize === DEFAULT_PRODUCTS_STATE.pageSize
  const params: CollectionProductsParams = {
    page: table.page,
    page_size: table.pageSize,
    sort: table.sort,
    order: table.order,
    ...(table.search.trim() ? { search: table.search.trim() } : {}),
    ...(shop ? { shop } : {}),
  }
  const products = useQuery({
    queryKey: [...detailKey(id), 'products', params],
    queryFn: () => api.collections.products(id, params),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
    enabled: id !== '' && !isFirstPage,
  })

  const collection = details.data ?? null
  const fromDetails = collection
    ? {
        items: collection.products,
        page: collection.products_page?.page ?? 1,
        page_size: collection.products_page?.page_size ?? table.pageSize,
        total: collection.products_page?.total ?? collection.products_count ?? 0,
        total_pages: collection.products_page?.total_pages ?? 1,
      }
    : null
  const page = isFirstPage ? fromDetails : (products.data ?? null)

  return {
    collection,
    isPending: details.isPending,
    isFetching: details.isFetching,
    error: details.isError && !details.data ? toUserMessage(details.error) : null,
    retry: () => void details.refetch(),
    table,
    products: page?.items ?? [],
    productsPage: page,
    productsPending: isFirstPage ? details.isPending : products.isPending,
    productsFetching: isFirstPage ? false : products.isFetching,
    productsError:
      !isFirstPage && products.isError && !products.data
        ? toUserMessage(products.error)
        : null,
    retryProducts: () => void products.refetch(),
    setTable: (changes: Partial<CollectionProductsState>) =>
      setTableState((current) => ({
        ...current,
        ...changes,
        page: 'page' in changes ? (changes.page ?? 1) : 1,
      })),
  }
}

/** Puts a collection's answer (from a create, an update or a refresh) in the cache at once. */
function useStoreCollection() {
  const queryClient = useQueryClient()
  return (collection: CollectionDetail, shop: string) => {
    for (const ref of [collection.id, collection.handle]) {
      queryClient.setQueryData([...detailKey(ref), shop], collection)
    }
    void queryClient.invalidateQueries({ queryKey: [ROOT, 'list'] })
    void queryClient.invalidateQueries({
      queryKey: [...detailKey(collection.id), 'products'],
    })
  }
}

/** `POST /collections`. Never retried (a repeat would make the collection twice). */
export function useCreateCollection() {
  const store = useStoreCollection()
  const mutation = useMutation({
    mutationFn: (body: CollectionCreateBody) => api.collections.create(body),
    onSuccess: (result, body) => store(result.collection, body.shop),
  })
  return { create: mutation.mutateAsync, isCreating: mutation.isPending }
}

/** `PUT /collections/{id}`: only the changed fields. The answer replaces the page's data. */
export function useUpdateCollection(id: string, shop: string) {
  const store = useStoreCollection()
  const mutation = useMutation({
    mutationFn: (body: CollectionUpdateBody) =>
      api.collections.update(id, body, shop || null),
    onSuccess: (result) => store(result.collection, shop),
  })
  return { update: mutation.mutateAsync, isUpdating: mutation.isPending }
}

/** `POST /collections/{id}/refresh`: re-reads it from Shopify; the answer replaces the page's data. */
export function useRefreshCollection(id: string, shop: string) {
  const store = useStoreCollection()
  const mutation = useMutation({
    mutationFn: () => api.collections.refresh(id, shop || null),
    onSuccess: (result) => store(result.collection, shop),
  })
  return {
    refresh: mutation.mutateAsync,
    isRefreshing: mutation.isPending,
    error: mutation.isError ? toUserMessage(mutation.error) : null,
    clearError: mutation.reset,
  }
}

/**
 * The store's products for picking (`GET /products?search=&shop=`), asked only once something is
 * typed. Used to add products to a manual collection.
 */
export function usePickProducts(shop: string, search: string, page: number) {
  const text = search.trim()
  const query = useQuery({
    queryKey: [ROOT, 'pick-products', shop, text, page],
    queryFn: () =>
      api.products.list({
        search: text,
        page,
        page_size: 10,
        ...(shop ? { shop } : {}),
      }),
    enabled: text !== '',
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  })
  return {
    items: text ? (query.data?.items ?? []) : [],
    total: text ? (query.data?.total ?? 0) : 0,
    totalPages: query.data?.total_pages ?? 1,
    isFetching: query.isFetching,
    error: query.isError ? toUserMessage(query.error) : null,
  }
}
