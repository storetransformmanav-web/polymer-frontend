import type { SelectOption } from '../../../components/ui/SelectField.tsx'

export const ORDERS_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any' },
  { value: 'yes', label: 'Has orders' },
  { value: 'no', label: 'No orders' },
]
