import { useCallback, useEffect, useRef, useState } from 'react'
import { downloadBlob } from '../lib/download.ts'
import {
  buildTableFile,
  exportFilename,
  type ExportColumn,
  type ExportFormat,
} from '../lib/tableExport.ts'

/** One page of a list, as the list APIs answer it. */
export interface PageResult<T> {
  items: T[]
  total: number
  total_pages: number
}

/** What a feature tells the export about its list. Keep it a module-level constant. */
export interface ExportSource<T, F> {
  noun: { one: string; many: string }
  /** The start of file names: "products" → products-all-2026-10-22.xlsx. */
  filenameBase: string
  sheetName: string
  /** The most rows the API returns per request. */
  pageSize: number
  /** One page of the records that match `filters`. */
  fetchPage: (filters: F, page: number, pageSize: number) => Promise<PageResult<T>>
  /** Identifies a record, so one that moved between pages is only written once. */
  idOf: (item: T) => string
}

/** What to put in the file. */
export interface ExportOptions<T> {
  format: ExportFormat
  /** The chosen columns, in the file's order. */
  columns: readonly ExportColumn<T>[]
}

export interface ExportState {
  status: 'idle' | 'running' | 'done' | 'error'
  /** Rows read so far / in all (while running). */
  done: number
  total: number
  /** What to tell the user (the result, or the backend's message). */
  message: string
}

const IDLE: ExportState = { status: 'idle', done: 0, total: 0, message: '' }
/** Pages read at the same time. */
const CONCURRENCY = 4
/** A safety stop (50 000 rows) so a runaway query can never loop for ever. */
const MAX_PAGES = 500

const failed = (error: unknown): ExportState => ({
  status: 'error',
  done: 0,
  total: 0,
  message:
    error instanceof Error && error.message
      ? error.message
      : 'The export failed. Nothing was downloaded.',
})

interface FetchAllOptions {
  onProgress: (done: number, total: number) => void
  /** Checked between requests; when true the read stops and nothing is returned. */
  isCancelled: () => boolean
}

/**
 * Every record of the query behind the list — all pages, the current filters and sort,
 * a few requests at a time, in page order. Returns null when cancelled.
 */
export async function fetchAllPages<T, F>(
  source: ExportSource<T, F>,
  filters: F,
  { onProgress, isCancelled }: FetchAllOptions,
): Promise<T[] | null> {
  const first = await source.fetchPage(filters, 1, source.pageSize)
  const pages = new Map<number, T[]>([[1, first.items]])
  const totalPages = Math.min(first.total_pages, MAX_PAGES)
  let loaded = first.items.length
  onProgress(loaded, first.total)

  let nextPage = 2
  let failedRead = false
  async function worker() {
    while (!failedRead && !isCancelled()) {
      const page = nextPage
      nextPage += 1
      if (page > totalPages) return
      try {
        const result = await source.fetchPage(filters, page, source.pageSize)
        pages.set(page, result.items)
        loaded += result.items.length
        onProgress(loaded, first.total)
      } catch (error) {
        failedRead = true
        throw error
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, Math.max(0, totalPages - 1)) }, worker),
  )
  if (isCancelled()) return null

  const seen = new Set<string>()
  const items: T[] = []
  for (let page = 1; page <= totalPages; page += 1) {
    for (const item of pages.get(page) ?? []) {
      const id = source.idOf(item)
      if (seen.has(id)) continue
      seen.add(id)
      items.push(item)
    }
  }
  return items
}

/**
 * Exporting a list to a file: the page being shown (instant, nothing is requested),
 * that page of the records matching other filters, or every page of the current
 * search and filters (read from the API, with progress, and cancellable). Nothing is
 * downloaded if reading fails part-way.
 */
export function useTableExport<T, F>(source: ExportSource<T, F>) {
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

  const plural = useCallback(
    (count: number) =>
      `${count.toLocaleString('en-GB')} ${count === 1 ? source.noun.one : source.noun.many}`,
    [source],
  )

  /** Hands the file to the browser and says so. */
  const finish = useCallback(
    (
      items: readonly T[],
      scope: { kind: 'page'; page: number } | { kind: 'all' },
      options: ExportOptions<T>,
    ) => {
      const filename = exportFilename(source.filenameBase, scope, options.format)
      downloadBlob(
        filename,
        buildTableFile(options.format, items, options.columns, source.sheetName),
      )
      setState({
        status: 'done',
        done: items.length,
        total: items.length,
        message: `Exported ${plural(items.length)} to ${filename}`,
      })
    },
    [source, plural],
  )

  /** The rows already on screen. */
  const exportPage = useCallback(
    (items: readonly T[], page: number, options: ExportOptions<T>) => {
      run.current += 1
      finish(items, { kind: 'page', page }, options)
    },
    [finish],
  )

  /**
   * One page of the records that match `filters` — for "Current page" when the dialog's
   * filters differ from the list's, so the rows on screen are not the ones wanted.
   */
  const exportFilteredPage = useCallback(
    async (filters: F, page: number, pageSize: number, options: ExportOptions<T>) => {
      run.current += 1
      const mine = run.current
      const isCancelled = () => run.current !== mine
      setState({ status: 'running', done: 0, total: 0, message: '' })
      try {
        const result = await source.fetchPage(filters, page, pageSize)
        if (isCancelled()) return
        finish(result.items, { kind: 'page', page }, options)
      } catch (error) {
        if (!isCancelled()) setState(failed(error))
      }
    },
    [source, finish],
  )

  /** Every page of the records that match `filters`. */
  const exportAll = useCallback(
    async (filters: F, options: ExportOptions<T>) => {
      run.current += 1
      const mine = run.current
      const isCancelled = () => run.current !== mine
      setState({ status: 'running', done: 0, total: 0, message: '' })
      try {
        const items = await fetchAllPages(source, filters, {
          isCancelled,
          onProgress: (done, total) => {
            if (!isCancelled()) setState({ status: 'running', done, total, message: '' })
          },
        })
        if (items === null || isCancelled()) return
        finish(items, { kind: 'all' }, options)
      } catch (error) {
        if (!isCancelled()) setState(failed(error))
      }
    },
    [source, finish],
  )

  const cancel = useCallback(() => {
    run.current += 1
    setState(IDLE)
  }, [])

  const dismiss = useCallback(() => setState(IDLE), [])

  return { state, exportPage, exportFilteredPage, exportAll, cancel, dismiss }
}
