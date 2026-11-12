import { useCallback, useEffect, useState } from 'react'
import {
  defaultColumnConfig,
  isDefaultColumnConfig,
  moveColumn,
  normalizeColumnConfig,
  toggleColumn,
  type ColumnConfig,
} from '../lib/columnConfig.ts'

/** What was chosen last time on this browser; storage can be missing or damaged, so never trust it. */
function load<Id extends string>(
  key: string,
  all: readonly Id[],
  defaults: readonly Id[],
): ColumnConfig<Id> {
  try {
    const saved = window.localStorage.getItem(key)
    return saved
      ? normalizeColumnConfig(JSON.parse(saved), all, defaults)
      : defaultColumnConfig(all, defaults)
  } catch {
    return defaultColumnConfig(all, defaults)
  }
}

/**
 * Which columns a list table shows, and in what order — chosen in the Columns menu and remembered
 * on this browser under `storageKey` (a per-viewer convenience: it works the same without
 * storage). `all` and `defaults` must be constants (not rebuilt on every render).
 */
export function useColumnConfig<Id extends string>(
  storageKey: string,
  all: readonly Id[],
  defaults: readonly Id[],
) {
  const [config, setConfig] = useState<ColumnConfig<Id>>(() =>
    load(storageKey, all, defaults),
  )

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(config))
    } catch {
      // Private window or blocked storage: the choice just lasts until the page is closed.
    }
  }, [config, storageKey])

  const toggle = useCallback(
    (id: Id) => setConfig((current) => toggleColumn(current, id)),
    [],
  )
  const move = useCallback(
    (id: Id, target: Id) => setConfig((current) => moveColumn(current, id, target)),
    [],
  )
  const reset = useCallback(
    () => setConfig(defaultColumnConfig(all, defaults)),
    [all, defaults],
  )

  return {
    config,
    toggle,
    move,
    reset,
    isDefault: isDefaultColumnConfig(config, all, defaults),
  }
}
