import { useMemo } from 'react'
import { useColumnConfig } from '../../../hooks/useColumnConfig.ts'
import {
  CUSTOMER_COLUMN_IDS,
  DEFAULT_VISIBLE_COLUMNS,
  shownColumns,
} from '../utils/columns.ts'

// v2: the default columns changed, so a choice saved before is not kept.
const STORAGE_KEY = 'polymer-crm:customer-columns:v2'

/**
 * Which columns the customers table shows, and in what order — chosen in the Columns menu and
 * remembered on this browser (see `useColumnConfig`).
 */
export function useCustomerColumns() {
  const choice = useColumnConfig(
    STORAGE_KEY,
    CUSTOMER_COLUMN_IDS,
    DEFAULT_VISIBLE_COLUMNS,
  )
  const columns = useMemo(() => shownColumns(choice.config), [choice.config])
  return { ...choice, columns }
}
