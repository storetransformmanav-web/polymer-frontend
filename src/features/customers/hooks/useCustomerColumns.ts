import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  defaultColumnConfig,
  isDefaultColumnConfig,
  moveColumn,
  normalizeColumnConfig,
  shownColumns,
  toggleColumn,
  type ColumnConfig,
  type CustomerColumnId,
} from '../utils/columns.ts'

const STORAGE_KEY = 'polymer-crm:customer-columns:v2'

/** What was chosen last time on this browser; storage can be missing or damaged, so never trust it. */
function load(): ColumnConfig {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved ? normalizeColumnConfig(JSON.parse(saved)) : defaultColumnConfig()
  } catch {
    return defaultColumnConfig()
  }
}

/**
 * Which columns the customers table shows, and in what order — chosen in the Columns menu and
 * remembered on this browser (a per-viewer convenience: it works the same without storage).
 */
export function useCustomerColumns() {
  const [config, setConfig] = useState<ColumnConfig>(load)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch {
      // Private window or blocked storage: the choice just lasts until the page is closed.
    }
  }, [config])

  const toggle = useCallback(
    (id: CustomerColumnId) => setConfig((current) => toggleColumn(current, id)),
    [],
  )
  const move = useCallback(
    (id: CustomerColumnId, target: CustomerColumnId) =>
      setConfig((current) => moveColumn(current, id, target)),
    [],
  )
  const reset = useCallback(() => setConfig(defaultColumnConfig()), [])

  const columns = useMemo(() => shownColumns(config), [config])

  return {
    config,
    columns,
    toggle,
    move,
    reset,
    isDefault: isDefaultColumnConfig(config),
  }
}
