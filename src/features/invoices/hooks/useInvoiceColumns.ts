import { useMemo } from 'react'
import { useColumnConfig } from '../../../hooks/useColumnConfig.ts'
import {
  DEFAULT_VISIBLE_INVOICE_COLUMNS,
  INVOICE_COLUMN_IDS,
  shownInvoiceColumns,
} from '../utils/columns.ts'

const STORAGE_KEY = 'polymer-crm:invoice-columns'

/**
 * Which columns the invoice table shows, and in what order — chosen in the Columns menu and
 * remembered on this browser (see `useColumnConfig`).
 */
export function useInvoiceColumns() {
  const choice = useColumnConfig(
    STORAGE_KEY,
    INVOICE_COLUMN_IDS,
    DEFAULT_VISIBLE_INVOICE_COLUMNS,
  )
  const columns = useMemo(() => shownInvoiceColumns(choice.config), [choice.config])
  return { ...choice, columns }
}
