import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { SuggestInput } from './SuggestInput.tsx'

const VENDORS = ['Polymer', 'Packaging By Polymer', 'Acme', 'polymer labs']

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <label htmlFor="vendor">Vendor</label>
      <SuggestInput
        id="vendor"
        value={value}
        onChange={setValue}
        suggestions={VENDORS}
        className="box"
      />
      <output data-testid="value">{value}</output>
    </>
  )
}

const options = () => screen.queryAllByRole('option').map((option) => option.textContent)

describe('SuggestInput', () => {
  it('lists every existing value when the box is focused, and nothing before', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.queryByRole('listbox')).toBeNull()

    await user.click(screen.getByLabelText('Vendor'))

    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(options()).toEqual(['Acme', 'Packaging By Polymer', 'Polymer', 'polymer labs'])
  })

  it('narrows to what is typed, any case, those starting with it first', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByLabelText('Vendor'), 'POLY')

    expect(options()).toEqual(['Polymer', 'polymer labs', 'Packaging By Polymer'])
  })

  it('fills the box when a suggestion is chosen with the pointer, and closes', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByLabelText('Vendor'))
    await user.click(screen.getByRole('option', { name: 'Acme' }))

    expect(screen.getByTestId('value')).toHaveTextContent('Acme')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByLabelText('Vendor')).toHaveFocus()
  })

  it('can be driven from the keyboard: arrows to move, Enter to choose, Escape to close', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const box = screen.getByLabelText('Vendor')
    await user.click(box)

    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByRole('option', { name: 'Packaging By Polymer' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('value')).toHaveTextContent('Packaging By Polymer')

    await user.clear(box)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('stays a free-text box: a value that is not in the list is just what you type', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByLabelText('Vendor'), 'Brand New Co')

    expect(screen.getByTestId('value')).toHaveTextContent('Brand New Co')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('does not offer the value that is already in the box', async () => {
    const user = userEvent.setup()
    render(<Harness initial="Acme" />)
    await user.click(screen.getByLabelText('Vendor'))

    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('closes when the box loses the focus', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByLabelText('Vendor'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.tab()
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('SuggestInput as a dropdown (asSelect)', () => {
  const SIZES = ['Small', 'Medium', 'large']

  function SizePicker({ initial = '' }: { initial?: string }) {
    const [value, setValue] = useState(initial)
    return (
      <>
        <label htmlFor="size">Size</label>
        <SuggestInput
          id="size"
          asSelect
          value={value}
          onChange={setValue}
          suggestions={SIZES}
          className="box"
        />
        <output data-testid="value">{value}</output>
      </>
    )
  }

  it('lists every value in the order given, not alphabetically', async () => {
    const user = userEvent.setup()
    render(<SizePicker />)
    await user.click(screen.getByLabelText('Size'))

    expect(options()).toEqual(['Small', 'Medium', 'large'])
  })

  it('still lists every value when one is already chosen, and marks it', async () => {
    const user = userEvent.setup()
    render(<SizePicker initial="Medium" />)
    await user.click(screen.getByLabelText('Size'))

    // An ordinary suggest box would hide the value it already holds; a dropdown shows them all.
    expect(options()).toEqual(['Small', 'Medium', 'large'])
    expect(screen.getByRole('option', { name: 'Medium' })).toHaveClass('font-semibold')
    expect(screen.getByRole('option', { name: 'Small' })).not.toHaveClass('font-semibold')

    await user.click(screen.getByRole('option', { name: 'large' }))
    expect(screen.getByTestId('value')).toHaveTextContent('large')
  })

  it('narrows while something else is typed, and a value outside the list can still be typed', async () => {
    const user = userEvent.setup()
    render(<SizePicker />)
    await user.type(screen.getByLabelText('Size'), 'med')
    expect(options()).toEqual(['Medium'])

    await user.clear(screen.getByLabelText('Size'))
    await user.type(screen.getByLabelText('Size'), 'XL')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByTestId('value')).toHaveTextContent('XL')
  })

  it('draws a chevron, and keeps the plain look when it is not a dropdown', async () => {
    const { container, unmount } = render(<SizePicker />)
    expect(container.querySelector('svg')).not.toBeNull()
    unmount()
    const plain = render(<Harness />)
    expect(plain.container.querySelector('svg')).toBeNull()
  })
})
