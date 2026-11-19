import { useMemo } from 'react'
import { useColumnConfig } from '../../../hooks/useColumnConfig.ts'
import {
  DEFAULT_VISIBLE_SAGE_CUSTOMER_COLUMNS,
  SAGE_CUSTOMER_COLUMN_IDS,
  shownSageCustomerColumns,
} from '../utils/columns.ts'

const STORAGE_KEY = 'polymer-crm:sage-customer-columns'

/**
 * Which columns the Sage customers table shows, and in what order — chosen in the Columns menu and
 * remembered on this browser (see `useColumnConfig`).
 */
export function useSageCustomerColumns() {
  const choice = useColumnConfig(
    STORAGE_KEY,
    SAGE_CUSTOMER_COLUMN_IDS,
    DEFAULT_VISIBLE_SAGE_CUSTOMER_COLUMNS,
  )
  const columns = useMemo(() => shownSageCustomerColumns(choice.config), [choice.config])
  return { ...choice, columns }
}
