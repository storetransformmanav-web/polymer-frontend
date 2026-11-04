import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DoubleClickEdit } from './DoubleClickEdit.tsx'

function setup(props: Partial<Parameters<typeof DoubleClickEdit>[0]> = {}) {
  const onCommit = vi.fn()
  const user = userEvent.setup()
  render(
    <DoubleClickEdit
      value="Blue bag"
      display={<span>Blue bag</span>}
      label="Alt text"
      onCommit={onCommit}
      {...props}
    />,
  )
  return { user, onCommit }
}

describe('DoubleClickEdit', () => {
  it('shows the value, and a single click changes nothing', async () => {
    const { user } = setup()
    await user.click(screen.getByText('Blue bag'))
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('turns into a box holding the value, selected, on a double-click', async () => {
    const { user } = setup()
    await user.dblClick(screen.getByText('Blue bag'))

    const box = screen.getByRole('textbox', { name: 'Alt text' })
    expect(box).toHaveValue('Blue bag')
    expect(box).toHaveFocus()
    expect((box as HTMLInputElement).selectionStart).toBe(0)
    expect((box as HTMLInputElement).selectionEnd).toBe('Blue bag'.length)
  })

  it('hands the new value over on Enter, trimmed', async () => {
    const { user, onCommit } = setup()
    await user.dblClick(screen.getByText('Blue bag'))
    await user.keyboard('  Red bag  {Enter}')

    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Red bag')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('keeps the edit when the box is left, like Enter', async () => {
    const { user, onCommit } = setup()
    await user.dblClick(screen.getByText('Blue bag'))
    await user.keyboard('Green bag')
    await user.tab()

    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Green bag')
  })

  it('puts the old value back on Escape and tells nobody', async () => {
    const { user, onCommit } = setup()
    await user.dblClick(screen.getByText('Blue bag'))
    await user.keyboard('Something else{Escape}')

    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText('Blue bag')).toBeInTheDocument()
  })

  it('does not hand over a value that did not change', async () => {
    const { user, onCommit } = setup()
    await user.dblClick(screen.getByText('Blue bag'))
    await user.keyboard('{Enter}')
    expect(onCommit).not.toHaveBeenCalled()

    await user.dblClick(screen.getByText('Blue bag'))
    await user.keyboard('{Control>}a{/Control}Blue bag {Enter}')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('keeps the box open with the reason when the value is refused', async () => {
    const { user, onCommit } = setup({
      validate: (next) => (next === '' ? 'Say something' : null),
    })
    await user.dblClick(screen.getByText('Blue bag'))
    await user.clear(screen.getByRole('textbox'))
    await user.keyboard('{Enter}')

    expect(screen.getByRole('alert')).toHaveTextContent('Say something')
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
    expect(onCommit).not.toHaveBeenCalled()

    // Typing again clears the message, and a good value goes through.
    await user.type(screen.getByRole('textbox'), 'Back')
    expect(screen.queryByRole('alert')).toBeNull()
    await user.keyboard('{Enter}')
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Back')
  })

  it('can be started from the keyboard, and not while busy', async () => {
    const first = setup()
    screen.getByRole('button').focus()
    await first.user.keyboard('{Enter}')
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('does not start while busy', async () => {
    const { user } = setup({ busy: true })
    await user.dblClick(screen.getByText('Blue bag'))
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('starts the edit from the small pencil, one click', async () => {
    const { user } = setup({ showIcon: true })
    const pencil = document.querySelector('[data-edit-icon]') as HTMLElement
    expect(pencil).not.toBeNull()
    await user.click(pencil)
    expect(screen.getByRole('textbox', { name: 'Alt text' })).toHaveValue('Blue bag')
  })

  it('draws no pencil unless asked, and centres the box when centred', async () => {
    const { user } = setup({ align: 'center' })
    expect(document.querySelector('[data-edit-icon]')).toBeNull()
    await user.dblClick(screen.getByText('Blue bag'))
    expect(screen.getByRole('textbox', { name: 'Alt text' })).toHaveClass('text-center')
  })

  it('fills its place by default', async () => {
    const { user } = setup()
    await user.dblClick(screen.getByText('Blue bag'))
    const box = screen.getByRole('textbox', { name: 'Alt text' })
    expect(box).toHaveClass('w-full')
    expect(box.style.width).toBe('')
  })

  it('with autoWidth, is as wide as the text and keeps growing with it, with no upper limit', async () => {
    const { user } = setup({ autoWidth: true, value: '25', display: <span>25</span> })
    await user.dblClick(screen.getByText('25'))
    const box = screen.getByRole('textbox', { name: 'Alt text' })
    expect(box).not.toHaveClass('w-full')
    expect(box).toHaveClass('max-w-none')
    // Two characters (and one spare).
    expect(box.style.width).toBe('calc(3ch + 1.25rem)')

    await user.clear(box)
    await user.type(box, '1234567890123456789012345')
    expect(box.style.width).toBe('calc(26ch + 1.25rem)')

    // An empty box keeps a width of its own.
    await user.clear(box)
    expect(box.style.width).toBe('calc(2ch + 1.25rem)')
  })
})
