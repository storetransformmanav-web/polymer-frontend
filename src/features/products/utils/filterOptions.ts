import type { SelectOption } from '../../../components/ui/SelectField.tsx'

export const STOCK_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any stock' },
  { value: 'in', label: 'In stock' },
  { value: 'out', label: 'Out of stock' },
]
