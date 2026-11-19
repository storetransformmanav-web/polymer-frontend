import { useMemo } from 'react'
import { useColumnConfig } from '../../../hooks/useColumnConfig.ts'
import {
  DEFAULT_VISIBLE_SAGE_ORDER_COLUMNS,
  SAGE_ORDER_COLUMN_IDS,
  shownSageOrderColumns,
} from '../utils/columns.ts'

const STORAGE_KEY = 'polymer-crm:sage-order-columns'

/**
 * Which columns the Sage orders table shows, and in what order — chosen in the Columns menu and
 * remembered on this browser (see `useColumnConfig`).
 */
export function useSageOrderColumns() {
  const choice = useColumnConfig(
    STORAGE_KEY,
    SAGE_ORDER_COLUMN_IDS,
    DEFAULT_VISIBLE_SAGE_ORDER_COLUMNS,
  )
  const columns = useMemo(() => shownSageOrderColumns(choice.config), [choice.config])
  return { ...choice, columns }
}
