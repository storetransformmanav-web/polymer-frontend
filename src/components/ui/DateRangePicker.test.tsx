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
const trigger = (name = /^Date range:/) => screen.getByRole('button', { name })
const fromBox = () => screen.getByLabelText('From date')
const toBox = () => screen.getByLabelText('To date')
const day = (name: string) => screen.getByRole('button', { name })

async function chooseCustom(user: ReturnType<typeof userEvent.setup>) {
  await user.click(trigger())
  await user.click(screen.getByRole('option', { name: 'Custom Range' }))
}

describe('DateRangePicker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-16T10:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows "All Time" with no date boxes, and a menu of the quick choices', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(trigger()).toHaveAccessibleName('Date range: All Time')
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('From date')).toBeNull()

    await user.click(trigger())
    const options = screen.getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual([
      'All Time',
      'Today',
      'Last 7 Days',
      'Last 30 Days',
      'Last 60 Days',
      'Custom Range',
    ])
    // The chosen one is ticked.
    expect(screen.getByRole('option', { name: 'All Time' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('option', { name: 'Today' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('applies a quick choice at once and closes the menu', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(trigger())
    await user.click(screen.getByRole('option', { name: 'Last 7 Days' }))

    expect(chosen()).toBe('2026-10-10|2026-10-16')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger()).toHaveAccessibleName('Date range: Last 7 Days')
    expect(screen.queryByLabelText('From date')).toBeNull()

    await user.click(trigger())
    await user.click(screen.getByRole('option', { name: 'Last 60 Days' }))
    expect(chosen()).toBe('2026-08-18|2026-10-16')
  })

  it('Custom Range shows two yyyy-mm-dd boxes and a Sunday-first calendar under the first', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await chooseCustom(user)

    expect(trigger()).toHaveAccessibleName('Date range: Custom Range')
    expect(fromBox()).toHaveAttribute('placeholder', 'yyyy-mm-dd')
    expect(toBox()).toHaveAttribute('placeholder', 'yyyy-mm-dd')
    expect(fromBox()).toHaveFocus()

    const panel = await screen.findByRole('dialog', { name: 'Date range' })
    expect(within(panel).getByLabelText('Month')).toHaveValue('9')
    expect(within(panel).getByLabelText('Year')).toHaveValue('2026')
    expect(
      within(panel)
        .getAllByText(/^(Su|Mo|Tu|We|Th|Fr|Sa)$/)
        .map((el) => el.textContent),
    ).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'])
    expect(day('16 October 2026')).toHaveAttribute('aria-current', 'date')
    // Choosing it changed nothing yet.
    expect(chosen()).toBe('|')
  })

  it('opens already in Custom Range for a range that is not a quick choice', () => {
    render(<Harness initial={{ from: '2026-10-14', to: '2026-10-20' }} />)

    expect(trigger()).toHaveAccessibleName('Date range: Custom Range')
    expect(fromBox()).toHaveValue('2026-10-14')
    expect(toBox()).toHaveValue('2026-10-20')
  })

  it('picks the first day, moves on to the last day and greys out the days before it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await chooseCustom(user)

    await user.click(await screen.findByRole('button', { name: '15 October 2026' }))

    // Applied at once, open-ended; the cursor is now in the last-day box.
    expect(chosen()).toBe('2026-10-15|')
    expect(fromBox()).toHaveValue('2026-10-15')
    expect(toBox()).toHaveFocus()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(day('14 October 2026')).toBeDisabled()
    expect(day('15 October 2026')).toBeEnabled()

    await user.click(day('20 October 2026'))
    expect(chosen()).toBe('2026-10-15|2026-10-20')
    expect(toBox()).toHaveValue('2026-10-20')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the range, and greys out days after the last day when changing the first', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ from: '2026-10-10', to: '2026-10-12' }} />)

    await user.click(fromBox())

    for (const name of ['10', '11', '12']) {
      expect(day(`${name} October 2026`)).toHaveAttribute('aria-pressed', 'true')
    }
    expect(day('13 October 2026')).toBeDisabled()

    await user.click(day('8 October 2026'))
    expect(chosen()).toBe('2026-10-08|2026-10-12')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('moves between months with the arrows and the month and year boxes', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ from: '2026-10-01', to: '' }} />)

    await user.click(fromBox())
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByLabelText('Month')).toHaveValue('8')
    await user.click(day('30 September 2026'))
    expect(chosen()).toBe('2026-09-30|')

    await user.selectOptions(screen.getByLabelText('Month'), 'March')
    await user.selectOptions(screen.getByLabelText('Year'), '2027')
    await user.click(day('31 March 2027'))
    expect(chosen()).toBe('2026-09-30|2027-03-31')
  })

  it('applies a typed day as soon as it is a real one, and ignores half-typed text', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ from: '2026-10-01', to: '' }} />)

    await user.clear(fromBox())
    expect(chosen()).toBe('|')
    await user.type(fromBox(), '2026-10-1')
    expect(chosen()).toBe('|')
    await user.type(fromBox(), '4')
    expect(chosen()).toBe('2026-10-14|')

    await user.type(toBox(), '2026-02-30')
    expect(chosen()).toBe('2026-10-14|')
  })

  it('clears each box with its red cross, and the whole range with the pill’s cross', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ from: '2026-10-14', to: '2026-10-20' }} />)

    await user.click(screen.getByRole('button', { name: 'Clear to date' }))
    expect(chosen()).toBe('2026-10-14|')
    expect(toBox()).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Clear date range' }))
    expect(chosen()).toBe('|')
    expect(trigger()).toHaveAccessibleName('Date range: All Time')
    expect(screen.queryByLabelText('From date')).toBeNull()
  })

  it('moves through the menu with the arrow keys, and closes it on Escape', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(trigger())
    expect(screen.getByRole('option', { name: 'All Time' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: 'Today' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(chosen()).toBe('2026-10-16|2026-10-16')

    await user.click(trigger())
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes the calendar on Escape and when clicking elsewhere', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ from: '2026-10-14', to: '2026-10-20' }} />)

    await user.click(toBox())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(fromBox())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
