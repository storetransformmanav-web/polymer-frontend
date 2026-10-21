/**
 * The customers table always shows the checkbox, Customer name, Note, Email
 * subscription, Location, Orders, Amount spent and Actions. These are the extra
 * columns the "Columns" menu can add; all start hidden.
 */
export type OptionalColumn = 'store' | 'role' | 'state' | 'joined' | 'tags' | 'lastLogin'

export const OPTIONAL_COLUMNS: { id: OptionalColumn; label: string }[] = [
  { id: 'store', label: 'Store' },
  { id: 'role', label: 'Role' },
  { id: 'state', label: 'State' },
  { id: 'joined', label: 'Joined' },
  { id: 'tags', label: 'Tags' },
  { id: 'lastLogin', label: 'Last login' },
]
