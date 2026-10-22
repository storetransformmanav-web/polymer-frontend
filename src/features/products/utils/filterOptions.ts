import type { SelectOption } from '../../../components/ui/SelectField.tsx'

export const STOCK_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any stock' },
  { value: 'in', label: 'In stock' },
  { value: 'out', label: 'Out of stock' },
]

/** "All X" plus every value seen so far; the selected value is always listed. */
export function withAll(
  allLabel: string,
  values: string[],
  selected: string,
): SelectOption[] {
  const list = selected && !values.includes(selected) ? [...values, selected] : values
  return [
    { value: '', label: allLabel },
    ...list.map((value) => ({ value, label: value })),
  ]
}
