import { useMemo } from 'react'
import { useColumnConfig } from '../../../hooks/useColumnConfig.ts'
import {
  ATTENDANCE_COLUMN_IDS,
  DEFAULT_VISIBLE_ATTENDANCE_COLUMNS,
  shownAttendanceColumns,
} from '../utils/columns.ts'

const STORAGE_KEY = 'polymer-crm:attendance-columns:v3'

/**
 * Which columns an employee's attendance table shows, and in what order — chosen in the Columns menu
 * and remembered on this browser (see `useColumnConfig`).
 */
export function useAttendanceColumns() {
  const choice = useColumnConfig(
    STORAGE_KEY,
    ATTENDANCE_COLUMN_IDS,
    DEFAULT_VISIBLE_ATTENDANCE_COLUMNS,
  )
  const columns = useMemo(() => shownAttendanceColumns(choice.config), [choice.config])
  return { ...choice, columns }
}
