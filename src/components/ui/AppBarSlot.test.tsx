import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppBarSlot, InAppBar } from './AppBarSlot.tsx'

describe('InAppBar', () => {
  it('puts its children in the top bar’s slot, wherever it is rendered', () => {
    render(
      <>
        <header aria-label="bar">
          <AppBarSlot />
        </header>
        <main aria-label="page">
          <InAppBar>
            <button type="button">Export</button>
          </InAppBar>
        </main>
      </>,
    )

    const button = screen.getByRole('button', { name: 'Export' })
    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: 'Export' }),
    ).toBe(button)
    expect(within(screen.getByRole('main')).queryByRole('button')).toBeNull()
  })

  it('leaves its children where they are when there is no bar', () => {
    render(
      <main aria-label="page">
        <InAppBar>
          <button type="button">Export</button>
        </InAppBar>
      </main>,
    )

    expect(
      within(screen.getByRole('main')).getByRole('button', { name: 'Export' }),
    ).toBeInTheDocument()
  })
})
