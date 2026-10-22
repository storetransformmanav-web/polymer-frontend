import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SelectField } from './SelectField.tsx'

const OPTIONS = [
  { value: '', label: 'All' },
  { value: 'a', label: 'A' },
]

describe('SelectField', () => {
  it('is the usual size: a 40px-high control with 0.85rem text', () => {
    render(
      <SelectField id="f" label="Thing" value="" options={OPTIONS} onChange={() => {}} />,
    )

    const select = screen.getByLabelText('Thing')
    expect(select.className).toContain('h-10')
    expect(select.className).toContain('text-[0.85rem]')
    expect(screen.getByText('Thing').className).toContain('text-[0.82rem]')
  })

  it('can be compact for a dense grid: shorter control, smaller text and label', () => {
    render(
      <SelectField
        compact
        id="f"
        label="Thing"
        value=""
        options={OPTIONS}
        onChange={() => {}}
      />,
    )

    const select = screen.getByLabelText('Thing')
    expect(select.className).toContain('h-8')
    expect(select.className).toContain('text-[0.76rem]')
    expect(select.className).not.toContain('h-10')
    expect(screen.getByText('Thing').className).toContain('text-[0.72rem]')
  })

  it('still lists its options when compact', () => {
    render(
      <SelectField
        compact
        id="f"
        label="Thing"
        value=""
        options={OPTIONS}
        onChange={() => {}}
      />,
    )

    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['All', 'A'])
  })
})
