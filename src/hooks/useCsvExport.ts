import { useCallback, useEffect, useRef, useState } from 'react'
import { toUserMessage } from '../lib/api/ApiError.ts'
import { csvFile, type ExportFileFormat } from '../lib/csv.ts'
import { downloadBlob } from '../lib/download.ts'

/** Shaped like what `ExportStatus` shows. */
export interface CsvExportState {
  status: 'idle' | 'running' | 'done' | 'error'
  done: number
  total: number
  message: string
}

/** One export: where the text comes from and how the file is saved. */
export interface CsvExportJob {
  read: (signal: AbortSignal) => Promise<string>
  filename: () => string
  format: ExportFileFormat
  /** What was exported, for the message ("25 products", "all products"). */
  summary: string
}

const IDLE: CsvExportState = { status: 'idle', done: 0, total: 0, message: '' }

/**
 * Exporting through an endpoint that answers with a CSV: one request, the backend builds the
 * whole file, and the browser saves it. Cancelling (or leaving the page) aborts the request;
 * nothing is downloaded if it fails. The request is never retried by hand — a failure shows
 * the backend's message and the user decides.
 */
export function useCsvExport() {
  const [state, setState] = useState<CsvExportState>(IDLE)
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

  const start = useCallback(async (job: CsvExportJob) => {
    controller.current?.abort()
    const mine = new AbortController()
    controller.current = mine
    setState({ status: 'running', done: 0, total: 0, message: '' })
    try {
      const text = await job.read(mine.signal)
      if (mine.signal.aborted) return
      const filename = job.filename()
      downloadBlob(filename, csvFile(text, job.format))
      setState({
        status: 'done',
        done: 0,
        total: 0,
        message: `Exported ${job.summary} to ${filename}`,
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
