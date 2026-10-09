import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OtpInput } from './OtpInput.tsx'

function Harness({ onComplete }: { onComplete?: (value: string) => void }) {
  const [value, setValue] = useState('')
  return <OtpInput value={value} onChange={setValue} onComplete={onComplete} />
}

const box = (position: number) => screen.getByLabelText(`Digit ${position} of 6`)

describe('OtpInput', () => {
  it('renders one box per digit and focuses the first on mount', () => {
    render(<Harness />)

    expect(screen.getAllByRole('textbox')).toHaveLength(6)
    expect(box(1)).toHaveFocus()
  })

  it('advances focus as digits are typed and reports completion once', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    render(<Harness onComplete={onComplete} />)

    await user.keyboard('123')
    expect(box(1)).toHaveValue('1')
    expect(box(3)).toHaveValue('3')
    expect(box(4)).toHaveFocus()
    expect(onComplete).not.toHaveBeenCalled()

    await user.keyboard('456')
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('ignores non-digit characters', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.keyboard('1a2-3')

    expect(box(1)).toHaveValue('1')
    expect(box(2)).toHaveValue('2')
    expect(box(3)).toHaveValue('3')
    expect(box(4)).toHaveValue('')
  })

  it('fills every box from a pasted code', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    render(<Harness onComplete={onComplete} />)

    await user.paste('9 8 7-6 5 4')

    expect(box(1)).toHaveValue('9')
    expect(box(6)).toHaveValue('4')
    expect(onComplete).toHaveBeenCalledWith('987654')
  })

  it('moves back and clears the previous digit on Backspace in an empty box', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.keyboard('12')
    await user.keyboard('{Backspace}')

    expect(box(2)).toHaveValue('')
    expect(box(2)).toHaveFocus()

    await user.keyboard('{Backspace}')
    expect(box(1)).toHaveValue('')
    expect(box(1)).toHaveFocus()
  })
})
