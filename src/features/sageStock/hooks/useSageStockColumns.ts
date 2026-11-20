import { useMemo } from 'react'
import { useColumnConfig } from '../../../hooks/useColumnConfig.ts'
import {
  DEFAULT_VISIBLE_SAGE_STOCK_COLUMNS,
  SAGE_STOCK_COLUMN_IDS,
  shownSageStockColumns,
} from '../utils/columns.ts'

// `:v2`: the default columns changed, so a choice saved under the older key is not kept.
const STORAGE_KEY = 'polymer-crm:sage-stock-columns:v2'

/**
 * Which columns the Sage stock table shows, and in what order — chosen in the Columns menu and
 * remembered on this browser (see `useColumnConfig`).
 */
export function useSageStockColumns() {
  const choice = useColumnConfig(
    STORAGE_KEY,
    SAGE_STOCK_COLUMN_IDS,
    DEFAULT_VISIBLE_SAGE_STOCK_COLUMNS,
  )
  const columns = useMemo(() => shownSageStockColumns(choice.config), [choice.config])
  return { ...choice, columns }
}
