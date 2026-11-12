import { useMemo } from 'react'
import { useColumnConfig } from '../../../hooks/useColumnConfig.ts'
import {
  DEFAULT_VISIBLE_ORDER_COLUMNS,
  ORDER_COLUMN_IDS,
  shownOrderColumns,
} from '../utils/columns.ts'

const STORAGE_KEY = 'polymer-crm:order-columns'

/**
 * Which columns the orders table shows, and in what order — chosen in the Columns menu and
 * remembered on this browser (see `useColumnConfig`).
 */
export function useOrderColumns() {
  const choice = useColumnConfig(
    STORAGE_KEY,
    ORDER_COLUMN_IDS,
    DEFAULT_VISIBLE_ORDER_COLUMNS,
  )
  const columns = useMemo(() => shownOrderColumns(choice.config), [choice.config])
  return { ...choice, columns }
}
