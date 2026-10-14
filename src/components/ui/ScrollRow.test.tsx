import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ScrollRow } from './ScrollRow.tsx'

/** jsdom has no layout, so give the list the measurements a browser would report. */
function measure(
  list: HTMLElement,
  { clientWidth, scrollWidth, scrollLeft }: Record<string, number>,
) {
  Object.defineProperty(list, 'clientWidth', { configurable: true, value: clientWidth })
  Object.defineProperty(list, 'scrollWidth', { configurable: true, value: scrollWidth })
  Object.defineProperty(list, 'scrollLeft', {
    configurable: true,
    writable: true,
    value: scrollLeft,
  })
  fireEvent.scroll(list)
}

function renderRow() {
  render(
    <ScrollRow label="Photos">
      {['a', 'b', 'c', 'd', 'e', 'f'].map((id) => (
        <li key={id}>
          <button type="button">{id}</button>
        </li>
      ))}
    </ScrollRow>,
  )
  return screen.getByRole('list', { name: 'Photos' })
}

const back = () => screen.queryByRole('button', { name: 'Scroll Photos back' })
const forward = () => screen.queryByRole('button', { name: 'Scroll Photos forward' })

describe('ScrollRow', () => {
  it('renders every item in one labelled list, with no arrows when everything fits', () => {
    const list = renderRow()
    measure(list, { clientWidth: 300, scrollWidth: 300, scrollLeft: 0 })

    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(back()).not.toBeInTheDocument()
    expect(forward()).not.toBeInTheDocument()
  })

  it('shows only the forward arrow at the start of a row that overflows', () => {
    const list = renderRow()
    measure(list, { clientWidth: 300, scrollWidth: 600, scrollLeft: 0 })

    expect(forward()).toBeInTheDocument()
    expect(back()).not.toBeInTheDocument()
  })

  it('shows both arrows in the middle and only the back arrow at the end', () => {
    const list = renderRow()

    measure(list, { clientWidth: 300, scrollWidth: 600, scrollLeft: 120 })
    expect(back()).toBeInTheDocument()
    expect(forward()).toBeInTheDocument()

    measure(list, { clientWidth: 300, scrollWidth: 600, scrollLeft: 300 })
    expect(back()).toBeInTheDocument()
    expect(forward()).not.toBeInTheDocument()
  })

  it("scrolls most of a screenful per click, in the arrow's direction", async () => {
    const user = userEvent.setup()
    const list = renderRow()
    const scrollBy = vi.fn()
    list.scrollBy = scrollBy
    measure(list, { clientWidth: 300, scrollWidth: 900, scrollLeft: 300 })

    await user.click(forward() as HTMLElement)
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 240, behavior: 'smooth' })

    await user.click(back() as HTMLElement)
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -240, behavior: 'smooth' })
  })

  it('keeps the items themselves reachable by keyboard', async () => {
    const user = userEvent.setup()
    const list = renderRow()
    measure(list, { clientWidth: 300, scrollWidth: 600, scrollLeft: 0 })

    await user.tab()
    // Focus lands on the first item; the arrows are extra, never in the way.
    expect(screen.getByRole('button', { name: 'a' })).toHaveFocus()
  })
})
