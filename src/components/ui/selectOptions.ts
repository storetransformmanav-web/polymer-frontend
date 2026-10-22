import type { SelectOption } from './SelectField.tsx'

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
