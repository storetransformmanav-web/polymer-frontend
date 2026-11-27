import type { AttendanceEmployee } from '../../../lib/api/endpoints.ts'

export const employeeName = (employee: AttendanceEmployee | null | undefined) =>
  employee?.full_name?.trim() || employee?.employee_code || 'Employee'

/** What the API's `employee` filter takes: the CRM user id, else the employee ID. */
export const employeeKey = (employee: AttendanceEmployee | null | undefined) =>
  employee?.user_id || employee?.employee_code || ''
