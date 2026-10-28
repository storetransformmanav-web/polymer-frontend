import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'
import type {
  ProductImportOptions,
  ProductImportPlan,
  ProductImportProgress,
} from '../../../lib/api/productImport.ts'
import { summarizeImportCsv, type ImportSummary } from '../utils/importCsv.ts'

/** The biggest file the page will read (the preview is built from its text in the browser). */
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024

const POLL_MS = 2000
/** After this long the page stops asking; the import itself carries on in the background. */
const MAX_WAIT_MS = 15 * 60_000

/** Where the person is: choosing a file, reading the check's answer, or watching the import. */
export type ImportPhase =
  'pick' | 'checking' | 'review' | 'starting' | 'running' | 'finished'

/** The choices on the first screen. */
export interface ImportChoice {
  /** The store key the products belong to. */
  shop: string
  createNew: boolean
  updateExisting: boolean
}

/** How an import ended, for the dialog and the bar. */
export interface ImportOutcome {
  kind: 'done' | 'failed' | 'sent' | 'timeout'
  message: string
}

/** Why a chosen file can't be used (before anything is read), or null. */
export function fileProblem(file: File): string | null {
  if (!/\.csv$/i.test(file.name) && !/csv/i.test(file.type)) {
    return `“${file.name}” isn’t a CSV file. Choose a .csv file in Shopify’s product layout.`
  }
  if (file.size === 0) return `“${file.name}” is empty.`
  if (file.size > MAX_IMPORT_BYTES) {
    return `“${file.name}” is too big (the limit is ${MAX_IMPORT_BYTES / 1024 / 1024} MB). Split it into smaller files.`
  }
  return null
}

/** The file's text (a `FileReader`, which every browser — and the test DOM — has). */
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsText(file)
  })
}

/**
 * Importing products from a Shopify-format CSV (`POST /products/import`).
 *
 * The flow, one screen each: **pick** a file (it is read in the browser at once, for the
 * preview and to refuse a file that isn't a products file), **check** it (`dry_run=true`: the
 * store reads it and says what would happen; nothing changes), **review** the preview, then
 * **import** (`dry_run=false`). The import runs in the background on the server and is followed
 * with `GET /products/import/{import_id}` every 2 s until it says it has finished (or 15 min
 * have passed); `onFinished` then lets the page re-read its list. The two writes are
 * mutations and are never retried — a repeat could import the file twice.
 */
export function useProductsImport({
  defaultShop,
  onFinished,
}: {
  /** The store used until another is chosen. */
  defaultShop: string
  /** The import has ended (done, failed or given up on): the products may have changed. */
  onFinished?: () => void
}) {
  const [phase, setPhase] = useState<ImportPhase>('pick')
  const [file, setFile] = useState<File | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState({
    shop: '',
    createNew: true,
    updateExisting: true,
  })
  const [checkPlan, setCheckPlan] = useState<ProductImportPlan | null>(null)
  const [started, setStarted] = useState<ProductImportPlan | null>(null)
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)
  const startedAt = useRef(0)
  const finishedOnce = useRef(true)
  const latestFile = useRef<File | null>(null)

  const onFinishedRef = useRef(onFinished)
  useEffect(() => {
    onFinishedRef.current = onFinished
  })

  const choice: ImportChoice = useMemo(
    () => ({ ...options, shop: options.shop || defaultShop }),
    [options, defaultShop],
  )
  const setChoice = useCallback((patch: Partial<ImportChoice>) => {
    setOptions((current) => ({ ...current, ...patch }))
  }, [])

  const send = useMutation({
    mutationFn: ({
      upload,
      withOptions,
    }: {
      upload: File
      withOptions: ProductImportOptions
    }) => api.products.import(upload, withOptions),
  })

  const finish = useCallback((result: ImportOutcome) => {
    setOutcome(result)
    setPhase('finished')
    if (!finishedOnce.current) {
      finishedOnce.current = true
      onFinishedRef.current?.()
    }
  }, [])

  /** Takes a file (or none): checks it is usable and reads it for the preview. */
  const chooseFile = useCallback(async (next: File | null) => {
    latestFile.current = next
    setError(null)
    setCheckPlan(null)
    setSummary(null)
    if (!next) {
      setFile(null)
      setFileError(null)
      return
    }
    const problem = fileProblem(next)
    if (problem) {
      setFile(null)
      setFileError(problem)
      return
    }
    setFile(next)
    setFileError(null)
    let text: string
    try {
      text = await readFileText(next)
    } catch {
      if (latestFile.current !== next) return
      setFile(null)
      setFileError(`“${next.name}” could not be read.`)
      return
    }
    // A newer choice came in while this one was being read: that one counts.
    if (latestFile.current !== next) return
    const result = summarizeImportCsv(text)
    if (result.ok) {
      setSummary(result.summary)
    } else {
      setFile(null)
      setFileError(result.error)
    }
  }, [])

  const canCheck =
    file !== null &&
    summary !== null &&
    choice.shop !== '' &&
    (choice.createNew || choice.updateExisting)

  /** `dry_run=true`: the store checks the file; then the preview is shown. */
  const check = useCallback(async () => {
    if (!file || !canCheck) return
    setError(null)
    setPhase('checking')
    try {
      const plan = await send.mutateAsync({
        upload: file,
        withOptions: { ...choice, dryRun: true },
      })
      setCheckPlan(plan)
      setPhase('review')
    } catch (failure) {
      setError(toUserMessage(failure))
      setPhase('pick')
    }
  }, [file, canCheck, choice, send])

  /** `dry_run=false`: the import starts on the server; its progress is followed from here. */
  const start = useCallback(async () => {
    if (!file || !canCheck) return
    setError(null)
    setPhase('starting')
    try {
      const plan = await send.mutateAsync({
        upload: file,
        withOptions: { ...choice, dryRun: false },
      })
      finishedOnce.current = false
      startedAt.current = Date.now()
      setStarted(plan)
      if (plan.importId) {
        setPhase('running')
      } else {
        // Nothing to follow it with: say it was sent, and re-read the list.
        finish({
          kind: 'sent',
          message:
            plan.message ||
            'The file was sent to the store. The import carries on in the background — the list updates as products arrive.',
        })
      }
    } catch (failure) {
      setError(toUserMessage(failure))
      setPhase('review')
    }
  }, [file, canCheck, choice, send, finish])

  const importId = started?.importId ?? null
  const progress = useQuery({
    queryKey: ['product-import', importId],
    queryFn: () => api.products.importStatus(importId as string),
    enabled: phase === 'running' && importId !== null,
    staleTime: 0,
    refetchInterval: (query) => {
      const data = query.state.data
      // Finished, or can't be followed: stop asking.
      if ((data && data.state !== 'running') || query.state.error) return false
      return Date.now() - startedAt.current > MAX_WAIT_MS ? false : POLL_MS
    },
  })

  // How a followed run ended — worked out from the latest answer rather than stored: it is
  // `null` while the run goes on, or when it can't be followed (the answer failed).
  const data = progress.data
  const followed: ImportOutcome | null =
    phase !== 'running'
      ? null
      : data && data.state !== 'running'
        ? {
            kind: data.state === 'done' ? 'done' : 'failed',
            message:
              data.message ||
              (data.state === 'done' ? 'The import finished.' : 'The import failed.'),
          }
        : progress.error
          ? {
              kind: 'failed',
              message: `Could not read the import’s progress: ${toUserMessage(progress.error)} It may still be running — check the list in a moment.`,
            }
          : null

  // The run has ended: let the list re-read (once per import).
  const ended = followed !== null
  useEffect(() => {
    if (ended && !finishedOnce.current) {
      finishedOnce.current = true
      onFinishedRef.current?.()
    }
  }, [ended])

  useEffect(() => {
    if (phase !== 'running') return undefined
    const wait = Math.max(0, MAX_WAIT_MS - (Date.now() - startedAt.current))
    const timer = window.setTimeout(
      () =>
        finish({
          kind: 'timeout',
          message:
            'The import is taking longer than expected. It carries on in the background — refresh the list in a few minutes.',
        }),
      wait,
    )
    return () => window.clearTimeout(timer)
  }, [phase, finish])

  /** Back to the file and choices (from the review). */
  const backToPick = useCallback(() => {
    setError(null)
    setCheckPlan(null)
    setPhase('pick')
  }, [])

  /** Forgets everything: the next open starts with no file. */
  const reset = useCallback(() => {
    latestFile.current = null
    finishedOnce.current = true
    setPhase('pick')
    setFile(null)
    setSummary(null)
    setFileError(null)
    setError(null)
    setCheckPlan(null)
    setStarted(null)
    setOutcome(null)
  }, [])

  return {
    /** Where the person is (`finished` as soon as the followed run has ended). */
    phase: followed ? ('finished' as ImportPhase) : phase,
    file,
    summary,
    fileError,
    error,
    choice,
    setChoice,
    canCheck,
    checkPlan,
    started,
    /** The latest answer of the progress call (null before the first). */
    progress: (progress.data ?? null) as ProductImportProgress | null,
    outcome: followed ?? outcome,
    chooseFile,
    check,
    start,
    backToPick,
    reset,
  }
}
