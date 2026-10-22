import type { SelectOption } from '../../../components/ui/SelectField.tsx'

export const ROLE_OPTIONS: SelectOption[] = [
  { value: '', label: 'All roles' },
  { value: 'administrator', label: 'Administrators' },
  { value: 'subscriber', label: 'Subscribers' },
]
export const STATE_OPTIONS: SelectOption[] = [
  { value: '', label: 'All States' },
  { value: 'ENABLED', label: 'Enabled' },
  { value: 'DISABLED', label: 'Disabled' },
  { value: 'INVITED', label: 'Invited' },
  { value: 'DECLINED', label: 'Declined' },
]
export const MARKETING_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any' },
  { value: 'yes', label: 'Subscribed' },
  { value: 'no', label: 'Not subscribed' },
]
export const ORDERS_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any' },
  { value: 'yes', label: 'Has orders' },
  { value: 'no', label: 'No orders' },
]
