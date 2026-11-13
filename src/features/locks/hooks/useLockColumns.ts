import { useMemo } from 'react'
import { useColumnConfig } from '../../../hooks/useColumnConfig.ts'
import {
  DEFAULT_VISIBLE_LOCK_COLUMNS,
  LOCK_COLUMN_IDS,
  shownLockColumns,
} from '../utils/columns.ts'

const STORAGE_KEY = 'polymer-crm:lock-columns'

/**
 * Which columns the locks table shows, and in what order — chosen in the Columns menu and
 * remembered on this browser (see `useColumnConfig`).
 */
export function useLockColumns() {
  const choice = useColumnConfig(
    STORAGE_KEY,
    LOCK_COLUMN_IDS,
    DEFAULT_VISIBLE_LOCK_COLUMNS,
  )
  const columns = useMemo(() => shownLockColumns(choice.config), [choice.config])
  return { ...choice, columns }
}
