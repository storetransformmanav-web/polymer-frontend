import { useMutation, useQueries } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ALL_SHOPS, shopLabel, shopValue } from '../../../app/store/shopSlice.ts'
import { useShops } from '../../../hooks/useShops.ts'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api, type SyncRun } from '../../../lib/api/endpoints.ts'
import { useRefreshProductList } from './useRefreshProductList.ts'

export type ProductsSyncPhase = 'idle' | 'running' | 'done' | 'failed'

/** How often the run is checked while it is going. */
const POLL_MS = 3000
/** How long to wait for the backend to show the run it was just asked to start. */
const WAIT_FOR_RUN_MS = 60_000
/** A sync that has not finished after this long is no longer followed. */
const GIVE_UP_MS = 15 * 60_000
/** How long the result stays beside the button. */
const SHOW_RESULT_MS = 15_000
/** Tolerance for the server's clock being a little behind this browser's. */
const CLOCK_SLACK_MS = 15_000

const isFinished = (run: SyncRun) =>
  Boolean(run.finished_at) || /complete|success|done|finish|fail|error/i.test(run.status)
const isFailed = (run: SyncRun) => /fail/i.test(run.status)

/** The newest run that began at or after `since` — i.e. the one this click started. */
function runSince(runs: SyncRun[] | undefined, since: number): SyncRun | undefined {
  return (runs ?? [])
    .filter((run) => Date.parse(run.started_at) >= since - CLOCK_SLACK_MS)
    .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))[0]
}

/**
 * Syncing the products of a store from Shopify (`POST /sync/products`), and
 * following the run (`GET /sync/status`) until it ends.
 *
 * The sync runs in the background on the server, so the button answers at
 * once: it starts, shows the progress as it is read from the run's status, and
 * keeps the product list refreshing in the background while the run goes (each
 * time its progress moved), so products appear as the server saves them instead
 * of only at the end. When the run finishes the tab counts are refreshed too. With "All
 * shops" selected every store the user can see is synced (the API's own
 * default would cover only one store); with one store selected, just that one.
 */
export function useProductsSync() {
  const { shops, selected, status: shopsStatus } = useShops()
  const refreshList = useRefreshProductList()
  const [tracked, setTracked] = useState<{ shops: string[]; startedAt: number } | null>(
    null,
  )
  const [startError, setStartError] = useState<string | null>(null)

  const targets = useMemo(() => {
    if (selected === ALL_SHOPS) {
      return shops.filter((shop) => shop.connected && shop.is_active)
    }
    return shops.filter((shop) => shopValue(shop) === selected)
  }, [shops, selected])

  const start = useMutation({
    mutationFn: async (keys: string[]) => {
      const startedAt = Date.now()
      const started: string[] = []
      let failure: string | null = null
      // One store after another: a failure stops there but keeps the ones already started.
      for (const key of keys) {
        try {
          await api.sync.triggerProducts(key)
          started.push(key)
        } catch (error) {
          failure = toUserMessage(error)
          break
        }
      }
      return { started, failure, startedAt }
    },
    onMutate: () => setStartError(null),
    onSuccess: ({ started, failure, startedAt }) => {
      setStartError(failure)
      if (started.length > 0) setTracked({ shops: started, startedAt })
    },
  })

  const startedAt = tracked?.startedAt ?? 0
  const queries = useQueries({
    queries: (tracked?.shops ?? []).map((shop) => ({
      queryKey: ['sync-status', 'products', shop] as const,
      queryFn: () => api.sync.status({ entity: 'products', limit: 3, shop }),
      staleTime: 0,
      refetchInterval: (query: { state: { data: SyncRun[] | undefined } }) => {
        const run = runSince(query.state.data, startedAt)
        const age = Date.now() - startedAt
        if (!run) return age < WAIT_FOR_RUN_MS ? POLL_MS : false
        return !isFinished(run) && age < GIVE_UP_MS ? POLL_MS : false
      },
    })),
  })

  // The backend may take a moment to show the run it was asked to start; after a while stop waiting.
  const [waitedOutFor, setWaitedOutFor] = useState<number | null>(null)
  useEffect(() => {
    if (!tracked) return undefined
    const timer = window.setTimeout(
      () => setWaitedOutFor(tracked.startedAt),
      WAIT_FOR_RUN_MS,
    )
    return () => window.clearTimeout(timer)
  }, [tracked])

  const runs = queries.map((query) => runSince(query.data, startedAt))
  const waiting =
    tracked !== null && runs.some((run) => !run) && waitedOutFor !== tracked.startedAt
  const running = waiting || runs.some((run) => run && !isFinished(run))
  const failedRun = runs.find((run) => run && isFailed(run))

  const phase: ProductsSyncPhase = !tracked
    ? 'idle'
    : running
      ? 'running'
      : failedRun
        ? 'failed'
        : 'done'
  // Counts as read from the runs (not known until a run shows up).
  const processed = runs.reduce((sum, run) => sum + (run?.records_read ?? 0), 0)
  const saved = runs.reduce((sum, run) => sum + (run?.records_written ?? 0), 0)
  const sawRun = runs.some(Boolean)

  // While the run goes, show what it has saved so far: refresh the list each time its progress moved.
  const lastProgress = useRef('')
  useEffect(() => {
    if (!tracked) lastProgress.current = ''
  }, [tracked])
  useEffect(() => {
    if (phase !== 'running') return
    const progress = `${processed}:${saved}`
    if (progress === '0:0' || progress === lastProgress.current) return
    lastProgress.current = progress
    refreshList(false)
  }, [phase, processed, saved, refreshList])

  // The run ended: refresh what is on screen (once), then stop showing the result after a while.
  const refreshedFor = useRef<number | null>(null)
  useEffect(() => {
    if (!tracked || (phase !== 'done' && phase !== 'failed')) return undefined
    if (refreshedFor.current !== tracked.startedAt) {
      refreshedFor.current = tracked.startedAt
      refreshList(true)
    }
    const timer = window.setTimeout(() => setTracked(null), SHOW_RESULT_MS)
    return () => window.clearTimeout(timer)
  }, [phase, tracked, refreshList])

  return {
    /** The stores that would be synced now (the selected one, or every visible store). */
    targets: targets.map((shop) => ({ key: shopValue(shop), label: shopLabel(shop) })),
    /** The store list has loaded (so there is something to sync). */
    ready: shopsStatus === 'ready' && targets.length > 0,
    phase,
    /** Products processed so far (while running) / saved (when done); null if the run never showed. */
    processed,
    saved: sawRun ? saved : null,
    error:
      startError ??
      (phase === 'failed' ? (failedRun?.error ?? 'The sync failed.') : null),
    isStarting: start.isPending,
    start: () => start.mutate(targets.map((shop) => shopValue(shop))),
  }
}
