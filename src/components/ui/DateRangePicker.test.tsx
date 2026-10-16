import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DateRangePicker } from './DateRangePicker.tsx'

function Harness({
  initial = { from: '', to: '' },
}: {
  initial?: { from: string; to: string }
}) {
  const [range, setRange] = useState(initial)
  return (
    <>
      <DateRangePicker
        label="Date range"
        from={range.from}
        to={range.to}
        onChange={setRange}
      />
      <output aria-label="chosen">{`${range.from}|${range.to}`}</output>
    </>
  )
}

const chosen = () => screen.getByLabelText('chosen').textContent

describe('DateRangePicker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-16T10:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('says "All Time" until a range is chosen, and opens on this month', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const trigger = screen.getByRole('button', { name: 'Date range: All Time' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)

    const panel = screen.getByRole('dialog', { name: 'Date range' })
    expect(within(panel).getByText('October')).toBeInTheDocument()
    expect(within(panel).getByText('2026')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'All Time' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // Monday first, six weeks.
    expect(
      within(panel)
        .getAllByText(/^(Mo|Tu|We|Th|Fr|Sa|Su)$/)
        .map((el) => el.textContent),
    ).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'])
  })

  it('applies a quick choice at once and closes', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: /^Date range/ }))
    await user.click(screen.getByRole('button', { name: 'Last 7 days' }))

    expect(chosen()).toBe('2026-10-10|2026-10-16')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Date range: Last 7 days' })).toHaveFocus()
  })

  it('picks a range with two clicks, and reports nothing after the first', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: /^Date range/ }))
    await user.click(screen.getByRole('button', { name: '14 October 2026' }))
    expect(chosen()).toBe('|')
    expect(screen.getByText(/pick the last day/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '20 October 2026' }))
    expect(chosen()).toBe('2026-10-14|2026-10-20')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Date range: 14 Oct 2026 – 20 Oct 2026' }),
    ).toBeInTheDocument()
  })

  it('puts the two days in order whichever is clicked first', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: /^Date range/ }))
    await user.click(screen.getByRole('button', { name: '20 October 2026' }))
    await user.click(screen.getByRole('button', { name: '14 October 2026' }))

    expect(chosen()).toBe('2026-10-14|2026-10-20')
  })

  it('moves between months, and shows the days either side', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: /^Date range/ }))
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText('September')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '30 September 2026' }))
    // 1 October is shown in September's last row.
    await user.click(screen.getByRole('button', { name: '1 October 2026' }))

    expect(chosen()).toBe('2026-09-30|2026-10-01')
  })

  it('marks the chosen range, and reopens on its month', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ from: '2026-09-10', to: '2026-09-12' }} />)

    await user.click(screen.getByRole('button', { name: /^Date range/ }))

    expect(screen.getByText('September')).toBeInTheDocument()
    for (const day of ['10', '11', '12']) {
      expect(
        screen.getByRole('button', { name: `${day} September 2026` }),
      ).toHaveAttribute('aria-pressed', 'true')
    }
    expect(screen.getByRole('button', { name: '13 September 2026' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('clears with All Time, and closes on Escape', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ from: '2026-09-10', to: '2026-09-12' }} />)

    await user.click(screen.getByRole('button', { name: /^Date range/ }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Date range/ }))
    await user.click(screen.getByRole('button', { name: 'All Time' }))
    expect(chosen()).toBe('|')
  })
})
