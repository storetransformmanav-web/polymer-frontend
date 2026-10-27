import { useCallback, useEffect, useRef, useState } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'
import { downloadBlob } from '../../../lib/download.ts'
import {
  csvFile,
  exportFilename,
  type ProductsExportRequest,
} from '../utils/exportRequest.ts'

/** Shaped like what `ExportStatus` shows. */
export interface ProductsExportState {
  status: 'idle' | 'running' | 'done' | 'error'
  done: number
  total: number
  message: string
}

const IDLE: ProductsExportState = { status: 'idle', done: 0, total: 0, message: '' }

/**
 * Exporting products through `GET /products/export`: one request, the backend builds the
 * whole CSV, and the browser saves it. Cancelling (or leaving the page) aborts the
 * request; nothing is downloaded if it fails. The request is never retried by hand — a
 * failure shows the backend's message and the user decides.
 */
export function useProductsExport() {
  const [state, setState] = useState<ProductsExportState>(IDLE)
  const controller = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      controller.current?.abort()
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

  const start = useCallback(async (request: ProductsExportRequest) => {
    controller.current?.abort()
    const mine = new AbortController()
    controller.current = mine
    setState({ status: 'running', done: 0, total: 0, message: '' })
    try {
      const text = await api.products.export(request.params, mine.signal)
      if (mine.signal.aborted) return
      const filename = exportFilename(request.params.shop)
      downloadBlob(filename, csvFile(text, request.format))
      setState({
        status: 'done',
        done: 0,
        total: 0,
        message: `Exported ${request.summary} to ${filename}`,
      })
    } catch (error) {
      if (mine.signal.aborted) return
      setState({ status: 'error', done: 0, total: 0, message: toUserMessage(error) })
    }
  }, [])

  const cancel = useCallback(() => {
    controller.current?.abort()
    setState(IDLE)
  }, [])

  const dismiss = useCallback(() => setState(IDLE), [])

  return { state, start, cancel, dismiss }
}
