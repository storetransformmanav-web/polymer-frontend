import { useMemo } from 'react'
import { useColumnConfig } from '../../../hooks/useColumnConfig.ts'
import {
  DEFAULT_VISIBLE_PRODUCT_COLUMNS,
  PRODUCT_COLUMN_IDS,
  shownProductColumns,
} from '../utils/columns.ts'

const STORAGE_KEY = 'polymer-crm:product-columns'

/**
 * Which columns the products table shows, and in what order — chosen in the Columns menu and
 * remembered on this browser (see `useColumnConfig`).
 */
export function useProductColumns() {
  const choice = useColumnConfig(
    STORAGE_KEY,
    PRODUCT_COLUMN_IDS,
    DEFAULT_VISIBLE_PRODUCT_COLUMNS,
  )
  const columns = useMemo(() => shownProductColumns(choice.config), [choice.config])
  return { ...choice, columns }
}
