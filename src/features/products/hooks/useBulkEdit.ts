import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  detailsKey,
  fetchProductDetails,
  fetchProducts,
  statusCountFilters,
  updateProduct,
} from '../../../app/store/productsSlice.ts'
import type {
  ProductDetail,
  ProductUpdateBody,
  ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import {
  buildUpdateBody,
  draftFromProduct,
  hasChanges,
  validateDraft,
  type DraftErrors,
  type ProductDraft,
  type VariantDraft,
} from '../utils/editDraft.ts'
import { productSyncPrefix } from './useProductSyncHistory.ts'

/** Product details fetched at once when the editor opens (a page can be 100 products). */
const LOAD_CONCURRENCY = 6
/** Saves in flight at once: gentle on the backend, which pushes each edit to Shopify. */
const SAVE_CONCURRENCY = 3

/** Which validation problems matter here: only the fields the bulk editor can change. */
const EDITABLE_ERRORS = ['title', 'vendor', 'productType', 'variants'] as const

/**
 * Warms the cache with many products' details at once (a few at a time), so the
 * bulk editor opens populated. Fresh cached ones are skipped by the thunk itself.
 */
export function usePrefetchDetails() {
  const dispatch = useAppDispatch()
  return useCallback(
    (ids: string[]) => {
      const queue = [...ids]
      async function worker() {
        for (let id = queue.shift(); id; id = queue.shift()) {
          await dispatch(fetchProductDetails({ id }))
        }
      }
      for (let i = 0; i < LOAD_CONCURRENCY; i += 1) void worker()
    },
    [dispatch],
  )
}

/** The draft's problems, limited to the fields this editor can change. */
function editableErrors(product: ProductDetail, draft: ProductDraft): DraftErrors {
  return Object.fromEntries(
    Object.entries(validateDraft(product, draft)).filter(([key]) =>
      EDITABLE_ERRORS.some((prefix) => key === prefix || key.startsWith(`${prefix}.`)),
    ),
  )
}

const STATUS_TABS = ['', 'ACTIVE', 'DRAFT', 'ARCHIVED', 'UNLISTED'] as const

/** What happened to a row on the last Save. */
export type RowResult =
  | { state: 'saving' }
  | { state: 'saved'; syncStatus: string; message: string }
  | { state: 'error'; message: string }

export interface BulkRow {
  id: string
  /** The product as the row was when editing it began (or as it is now, if untouched). */
  product: ProductDetail | null
  draft: ProductDraft | null
  /** Details are still loading, so there is nothing to edit yet. */
  loading: boolean
  loadError: string | null
  /** Has unsaved changes. */
  dirty: boolean
  /** Problems with the edited fields — empty until a save has been attempted. */
  errors: DraftErrors
  result: RowResult | null
}

export interface BulkSavedItem {
  product: ProductDetail
  body: ProductUpdateBody
  result: ProductWriteResult
}

export interface BulkSaveSummary {
  saved: BulkSavedItem[]
  failed: number
  /** Edited rows with problems that stopped the save before anything was sent. */
  blocked: number
}

/**
 * The state behind the bulk editor: many products edited at once, spreadsheet
 * style. Each product gets its own working copy the moment its first cell is
 * touched, frozen against the details it started from, so — as everywhere else
 * — only what *you* changed is sent and a colleague's change to another field
 * is never reverted. Untouched rows simply mirror the cache.
 *
 * Details come from the same Redux cache as everything else (hover on the menu
 * prefetches them, so usually they are already there) and the rest load a few
 * at a time. Saving is one `PUT` per changed product — the API has no bulk
 * endpoint — and every row reports its own result, so one failure never loses
 * the others.
 *
 * `ids` should be a stable array (memoise it): the rows are recomputed when it changes.
 */
export function useBulkEdit(ids: string[]) {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const filters = useAppSelector((state) => state.products.filters)
  const details = useAppSelector((state) => state.products.details)
  const [edits, setEdits] = useState<
    Record<string, { baseline: ProductDetail; draft: ProductDraft }>
  >({})
  const [results, setResults] = useState<Record<string, RowResult>>({})
  const [showErrors, setShowErrors] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const idsKey = ids.join('|')

  // Load every product's details, a few at a time (cached, fresh ones are skipped).
  useEffect(() => {
    const queue = idsKey ? idsKey.split('|') : []
    let cancelled = false
    async function worker() {
      for (let id = queue.shift(); id && !cancelled; id = queue.shift()) {
        await dispatch(fetchProductDetails({ id }))
      }
    }
    for (let i = 0; i < LOAD_CONCURRENCY; i += 1) void worker()
    return () => {
      cancelled = true
    }
  }, [dispatch, idsKey])

  const rows = useMemo<BulkRow[]>(
    () =>
      ids.map((id) => {
        const entry = details[detailsKey(id)]
        const live = entry?.data ?? null
        const edit = edits[id]
        const product = edit?.baseline ?? live
        const draft = edit?.draft ?? (live ? draftFromProduct(live) : null)
        const body = product && draft && edit ? buildUpdateBody(product, draft) : {}

        const errors =
          showErrors && product && draft && edit ? editableErrors(product, draft) : {}

        return {
          id,
          product,
          draft,
          loading: product === null && !entry?.error,
          loadError: product ? null : (entry?.error ?? null),
          dirty: hasChanges(body),
          errors,
          result: results[id] ?? null,
        }
      }),
    [ids, details, edits, results, showErrors],
  )

  const dirtyCount = rows.filter((row) => row.dirty).length

  const update = useCallback(
    (id: string, change: (draft: ProductDraft) => ProductDraft) => {
      const live = details[detailsKey(id)]?.data ?? null
      setEdits((current) => {
        const start =
          current[id] ?? (live ? { baseline: live, draft: draftFromProduct(live) } : null)
        if (!start) return current
        return {
          ...current,
          [id]: { baseline: start.baseline, draft: change(start.draft) },
        }
      })
      // Changing a row again clears what the last save said about it.
      setResults((current) => {
        if (!current[id] || current[id].state === 'saving') return current
        const { [id]: _gone, ...rest } = current
        return rest
      })
    },
    [details],
  )

  const change = useCallback(
    (id: string, patch: Partial<ProductDraft>) =>
      update(id, (draft) => ({ ...draft, ...patch })),
    [update],
  )

  const changeVariant = useCallback(
    (id: string, variantKey: string, patch: Partial<VariantDraft>) =>
      update(id, (draft) => ({
        ...draft,
        variants: draft.variants.map((variant) =>
          variant.key === variantKey ? { ...variant, ...patch } : variant,
        ),
      })),
    [update],
  )

  const retryLoad = useCallback(
    (id: string) => void dispatch(fetchProductDetails({ id, force: true })),
    [dispatch],
  )

  /** Throw away every unsaved change. */
  const discardAll = useCallback(() => {
    setEdits({})
    setResults({})
    setShowErrors(false)
  }, [])

  const saveAll = useCallback(async (): Promise<BulkSaveSummary> => {
    if (isSaving) return { saved: [], failed: 0, blocked: 0 }
    setShowErrors(true)

    const dirty = rows.filter((row) => row.dirty && row.product && row.draft)
    const blocked = dirty.filter(
      (row) =>
        row.product &&
        row.draft &&
        Object.keys(editableErrors(row.product, row.draft)).length > 0,
    )
    // Nothing is sent while anything is invalid: fix the highlighted cells first.
    if (blocked.length > 0) return { saved: [], failed: 0, blocked: blocked.length }

    setIsSaving(true)
    setResults((current) => ({
      ...current,
      ...Object.fromEntries(
        dirty.map((row) => [row.id, { state: 'saving' } as RowResult]),
      ),
    }))

    const queue = [...dirty]
    const saved: BulkSavedItem[] = []
    let failed = 0

    async function worker() {
      for (let row = queue.shift(); row; row = queue.shift()) {
        const { product, draft } = row
        if (!product || !draft) continue
        const body = buildUpdateBody(product, draft)
        const outcome = await dispatch(
          updateProduct({ id: row.id, body, shop: product.shop?.key }),
        )
        if (updateProduct.fulfilled.match(outcome)) {
          saved.push({ product, body, result: outcome.payload })
          // Back to mirroring the cache, which has just been patched with the edit.
          setEdits((current) => {
            const { [row.id]: _done, ...rest } = current
            return rest
          })
          setResults((current) => ({
            ...current,
            [row.id]: {
              state: 'saved',
              syncStatus: outcome.payload.sync_status,
              message: outcome.payload.message,
            },
          }))
        } else {
          failed += 1
          setResults((current) => ({
            ...current,
            [row.id]: {
              state: 'error',
              message: outcome.payload ?? 'Something went wrong. Please try again.',
            },
          }))
        }
      }
    }
    await Promise.all(Array.from({ length: SAVE_CONCURRENCY }, () => worker()))

    // Refresh the authoritative copies quietly; the patched values stay on screen meanwhile.
    for (const item of saved) {
      void queryClient.invalidateQueries({ queryKey: productSyncPrefix(item.product.id) })
      void dispatch(fetchProductDetails({ id: item.product.id, force: true }))
    }
    if (saved.length > 0) {
      void dispatch(fetchProducts({ filters, force: true }))
      if (saved.some((item) => item.body.status)) {
        for (const status of STATUS_TABS) {
          void dispatch(
            fetchProducts({ filters: statusCountFilters(filters, status), force: true }),
          )
        }
      }
    }

    setIsSaving(false)
    return { saved, failed, blocked: 0 }
  }, [dispatch, filters, isSaving, queryClient, rows])

  return {
    rows,
    dirtyCount,
    isSaving,
    change,
    changeVariant,
    retryLoad,
    discardAll,
    saveAll,
  }
}

export type BulkEdit = ReturnType<typeof useBulkEdit>
