import { useMemo } from 'react'
import { useColumnConfig } from '../../../hooks/useColumnConfig.ts'
import {
  allowedConfig,
  ATTENDANCE_COLUMN_IDS,
  DEFAULT_VISIBLE_ATTENDANCE_COLUMNS,
  shownAttendanceColumns,
} from '../utils/columns.ts'

const STORAGE_KEY = 'polymer-crm:attendance-columns:v2'

/**
 * Which columns the attendance table shows, and in what order — chosen in the Columns menu and
 * remembered on this browser (see `useColumnConfig`). `menuConfig` is the choice limited to the
 * columns this person's list can have.
 */
export function useAttendanceColumns(isAdmin: boolean) {
  const choice = useColumnConfig(
    STORAGE_KEY,
    ATTENDANCE_COLUMN_IDS,
    DEFAULT_VISIBLE_ATTENDANCE_COLUMNS,
  )
  const columns = useMemo(
    () => shownAttendanceColumns(choice.config, isAdmin),
    [choice.config, isAdmin],
  )
  const menuConfig = useMemo(
    () => allowedConfig(choice.config, isAdmin),
    [choice.config, isAdmin],
  )
  return { ...choice, columns, menuConfig }
}
