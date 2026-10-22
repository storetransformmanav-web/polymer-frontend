import { useCallback, useEffect, useRef, useState } from 'react'
import { toParams, type ProductFilters } from '../../../app/store/productsSlice.ts'
import { api, type ProductListItem } from '../../../lib/api/endpoints.ts'
import { downloadBlob } from '../../../lib/download.ts'
import type { ExportColumn } from '../utils/exportColumns.ts'
import {
  buildProductsFile,
  exportFilename,
  type ExportFormat,
} from '../utils/exportFile.ts'

/** The most products the API returns per request. */
export const EXPORT_PAGE_SIZE = 100
/** Pages read at the same time. */
const CONCURRENCY = 4
/** A safety stop (50 000 products) so a runaway query can never loop for ever. */
const MAX_PAGES = 500

export interface ExportState {
  status: 'idle' | 'running' | 'done' | 'error'
  /** Products read so far / in all (while running). */
  done: number
  total: number
  /** What to tell the user (the result, or the backend's message). */
  message: string
}

/** What to put in the file. */
export interface ExportOptions {
  format: ExportFormat
  /** The chosen columns, in the file's order. */
  columns: readonly ExportColumn[]
}

const IDLE: ExportState = { status: 'idle', done: 0, total: 0, message: '' }

const failed = (error: unknown): ExportState => ({
  status: 'error',
  done: 0,
  total: 0,
  message:
    error instanceof Error && error.message
      ? error.message
      : 'The export failed. Nothing was downloaded.',
})

const plural = (count: number) =>
  `${count.toLocaleString('en-GB')} product${count === 1 ? '' : 's'}`

interface FetchAllOptions {
  onProgress: (done: number, total: number) => void
  /** Checked between requests; when true the read stops and nothing is returned. */
  isCancelled: () => boolean
}

/**
 * Every product of the query behind the list — all pages, the current filters and
 * sort, 100 per request, a few requests at a time. Returns null when cancelled.
 * (A product that moved between pages while this ran is only listed once.)
 */
export async function fetchAllProducts(
  filters: ProductFilters,
  { onProgress, isCancelled }: FetchAllOptions,
): Promise<ProductListItem[] | null> {
  const query = (page: number) =>
    toParams({ ...filters, page, pageSize: EXPORT_PAGE_SIZE })

  const first = await api.products.list(query(1))
  const pages = new Map<number, ProductListItem[]>([[1, first.items]])
  const totalPages = Math.min(first.total_pages, MAX_PAGES)
  let loaded = first.items.length
  onProgress(loaded, first.total)

  let nextPage = 2
  let failed = false
  async function worker() {
    while (!failed && !isCancelled()) {
      const page = nextPage
      nextPage += 1
      if (page > totalPages) return
      try {
        const result = await api.products.list(query(page))
        pages.set(page, result.items)
        loaded += result.items.length
        onProgress(loaded, first.total)
      } catch (error) {
        failed = true
        throw error
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, Math.max(0, totalPages - 1)) }, worker),
  )
  if (isCancelled()) return null

  const seen = new Set<string>()
  const items: ProductListItem[] = []
  for (let page = 1; page <= totalPages; page += 1) {
    for (const item of pages.get(page) ?? []) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      items.push(item)
    }
  }
  return items
}

/**
 * Exporting products to a CSV file: the page being shown (instant, nothing is
 * requested) or every page of the current search and filters (read from the API,
 * with progress, and cancellable). Nothing is downloaded if reading fails part-way.
 */
export function useExportProducts() {
  const [state, setState] = useState<ExportState>(IDLE)
  // Bumped to cancel the run in flight (and by unmounting).
  const run = useRef(0)

  useEffect(
    () => () => {
      run.current += 1
    },
    [],
  )

  // A finished result goes away by itself after a while.
  const { status } = state
  useEffect(() => {
    if (status !== 'done') return undefined
    const timer = window.setTimeout(() => setState(IDLE), 10_000)
    return () => window.clearTimeout(timer)
  }, [status])

  const exportPage = useCallback(
    (items: readonly ProductListItem[], page: number, options: ExportOptions) => {
      run.current += 1
      const filename = exportFilename({ kind: 'page', page }, options.format)
      downloadBlob(filename, buildProductsFile(options.format, items, options.columns))
      setState({
        status: 'done',
        done: items.length,
        total: items.length,
        message: `Exported ${plural(items.length)} to ${filename}`,
      })
    },
    [],
  )

  const exportAll = useCallback(
    async (filters: ProductFilters, options: ExportOptions) => {
      run.current += 1
      const mine = run.current
      const isCancelled = () => run.current !== mine
      setState({ status: 'running', done: 0, total: 0, message: '' })

      try {
        const items = await fetchAllProducts(filters, {
          isCancelled,
          onProgress: (done, total) => {
            if (!isCancelled()) setState({ status: 'running', done, total, message: '' })
          },
        })
        if (items === null || isCancelled()) return
        const filename = exportFilename({ kind: 'all' }, options.format)
        downloadBlob(filename, buildProductsFile(options.format, items, options.columns))
        setState({
          status: 'done',
          done: items.length,
          total: items.length,
          message: `Exported ${plural(items.length)} to ${filename}`,
        })
      } catch (error) {
        if (isCancelled()) return
        setState(failed(error))
      }
    },
    [],
  )

  /**
   * One page of the products that match `filters` (its `page` and `pageSize`) — for
   * "Current page" when the dialog's filters differ from the list's, so the rows on
   * screen are not the ones wanted.
   */
  const exportFilteredPage = useCallback(
    async (filters: ProductFilters, options: ExportOptions) => {
      run.current += 1
      const mine = run.current
      const isCancelled = () => run.current !== mine
      setState({ status: 'running', done: 0, total: 0, message: '' })

      try {
        const result = await api.products.list(toParams(filters))
        if (isCancelled()) return
        const filename = exportFilename(
          { kind: 'page', page: filters.page },
          options.format,
        )
        downloadBlob(
          filename,
          buildProductsFile(options.format, result.items, options.columns),
        )
        setState({
          status: 'done',
          done: result.items.length,
          total: result.items.length,
          message: `Exported ${plural(result.items.length)} to ${filename}`,
        })
      } catch (error) {
        if (isCancelled()) return
        setState(failed(error))
      }
    },
    [],
  )

  const cancel = useCallback(() => {
    run.current += 1
    setState(IDLE)
  }, [])

  const dismiss = useCallback(() => setState(IDLE), [])

  return { state, exportPage, exportFilteredPage, exportAll, cancel, dismiss }
}
