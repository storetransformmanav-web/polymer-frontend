import type { ColumnConfig as BaseColumnConfig } from '../../../lib/columnConfig.ts'

/**
 * The attendance table's columns. The opening chevron (a row's details) is fixed; every other column
 * can be shown, hidden and put in any order from the Columns menu (`components/ui/ColumnsMenu.tsx`).
 * Only what the attendance answer carries is a column.
 */
export const ATTENDANCE_COLUMN_IDS = [
  'date',
  'employee',
  'code',
  'status',
  'check_in',
  'check_out',
  'breaks',
  'worked',
  'late',
  'punches',
  'role',
  'position',
  'department',
  'day_type',
] as const

export type AttendanceColumnId = (typeof ATTENDANCE_COLUMN_IDS)[number]
export type AttendanceColumnConfig = BaseColumnConfig<AttendanceColumnId>

export interface AttendanceColumnDef {
  id: AttendanceColumnId
  label: string
  /** Width in rem (the table is fixed-layout, so every column has one). */
  width: number
  align: 'left' | 'center' | 'right'
  /** Only an administrator's list has these (they describe the employee). */
  adminOnly?: boolean
}

const column = (
  id: AttendanceColumnId,
  label: string,
  width: number,
  align: AttendanceColumnDef['align'] = 'left',
  adminOnly = false,
): [AttendanceColumnId, AttendanceColumnDef] => [
  id,
  { id, label, width, align, adminOnly },
]

export const ATTENDANCE_COLUMNS: Record<AttendanceColumnId, AttendanceColumnDef> =
  Object.fromEntries([
    column('date', 'Date', 9),
    column('employee', 'Employee', 14, 'left', true),
    column('code', 'Employee ID', 8, 'left', true),
    column('status', 'Status', 12.5, 'center'),
    column('check_in', 'Check In', 7),
    column('check_out', 'Check Out', 7),
    column('breaks', 'Breaks', 7.5),
    column('worked', 'Worked', 6),
    column('late', 'Late', 9),
    column('punches', 'Punches', 5.5, 'center'),
    column('role', 'Role', 10, 'left', true),
    column('position', 'Position', 10, 'left', true),
    column('department', 'Department', 10, 'left', true),
    column('day_type', 'Day type', 9),
  ]) as Record<AttendanceColumnId, AttendanceColumnDef>

/** Shown to begin with, in this order. */
export const DEFAULT_VISIBLE_ATTENDANCE_COLUMNS: AttendanceColumnId[] = [
  'date',
  'employee',
  'code',
  'status',
  'check_in',
  'check_out',
  'breaks',
  'worked',
  'late',
  'punches',
]

/** Width of the fixed opening column (the details chevron), in rem. */
export const ATTENDANCE_CHEVRON_COLUMN_REM = 2.75

/** Is this column part of the person's list (an employee-describing one is not for non-admins)? */
export const columnAllowed = (id: AttendanceColumnId, isAdmin: boolean) =>
  isAdmin || !ATTENDANCE_COLUMNS[id].adminOnly

/** The menu's choice limited to the columns this person's list can have. */
export function allowedConfig(
  config: AttendanceColumnConfig,
  isAdmin: boolean,
): AttendanceColumnConfig {
  return {
    order: config.order.filter((id) => columnAllowed(id, isAdmin)),
    visible: config.visible.filter((id) => columnAllowed(id, isAdmin)),
  }
}

/** The columns to draw, in order. */
export function shownAttendanceColumns(
  config: AttendanceColumnConfig,
  isAdmin: boolean,
): AttendanceColumnDef[] {
  return allowedConfig(config, isAdmin)
    .order.filter((id) => config.visible.includes(id))
    .map((id) => ATTENDANCE_COLUMNS[id])
}

/** The table's least width in rem: the chevron and the shown columns. */
export function attendanceTableMinWidthRem(columns: AttendanceColumnDef[]): number {
  return (
    ATTENDANCE_CHEVRON_COLUMN_REM +
    columns.reduce((total, shown) => total + shown.width, 0)
  )
}
