import { describe, expect, it } from 'vitest'
import {
  RANGE_PRESETS,
  describeRange,
  matchingPreset,
  monthGrid,
  parseYmd,
  toYmd,
} from './dateRange.ts'

// Friday 16 October 2026.
const TODAY = new Date(2026, 9, 16)

const preset = (label: string) => {
  const found = RANGE_PRESETS.find((item) => item.label === label)
  if (!found) throw new Error(label)
  return found.range(TODAY)
}

describe('presets', () => {
  it('works out each quick choice from today', () => {
    expect(preset('All Time')).toEqual({ from: '', to: '' })
    expect(preset('Today')).toEqual({ from: '2026-10-16', to: '2026-10-16' })
    expect(preset('Yesterday')).toEqual({ from: '2026-10-15', to: '2026-10-15' })
    expect(preset('Last 7 days')).toEqual({ from: '2026-10-10', to: '2026-10-16' })
    expect(preset('Last 2 weeks')).toEqual({ from: '2026-10-03', to: '2026-10-16' })
    expect(preset('Last 30 days')).toEqual({ from: '2026-09-17', to: '2026-10-16' })
    expect(preset('This month')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(preset('Last month')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('takes "last week" as the whole of the previous Monday to Sunday', () => {
    expect(preset('Last week')).toEqual({ from: '2026-10-05', to: '2026-10-11' })
    // On a Monday, last week ended yesterday.
    const monday = RANGE_PRESETS.find((item) => item.label === 'Last week')?.range(
      new Date(2026, 9, 12),
    )
    expect(monday).toEqual({ from: '2026-10-05', to: '2026-10-11' })
  })

  it('finds the preset a range equals, and describes anything else as dates', () => {
    expect(matchingPreset({ from: '', to: '' }, TODAY)?.label).toBe('All Time')
    expect(matchingPreset({ from: '2026-10-10', to: '2026-10-16' }, TODAY)?.label).toBe(
      'Last 7 days',
    )
    expect(describeRange({ from: '', to: '' }, TODAY)).toBe('All Time')
    expect(describeRange({ from: '2026-10-14', to: '2026-10-14' }, TODAY)).toBe(
      '14 Oct 2026',
    )
    expect(describeRange({ from: '2026-10-14', to: '2026-10-20' }, TODAY)).toBe(
      '14 Oct 2026 – 20 Oct 2026',
    )
  })
})

describe('days', () => {
  it('round-trips and rejects days that do not exist', () => {
    expect(toYmd(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(parseYmd('2026-10-16')?.getDate()).toBe(16)
    expect(parseYmd('2026-02-30')).toBeNull()
    expect(parseYmd('16/10/2026')).toBeNull()
  })

  it('lays a month out in six Monday-first weeks', () => {
    // September 2026 starts on a Tuesday: 31 August leads the first row.
    const grid = monthGrid(2026, 8)
    expect(grid).toHaveLength(42)
    expect(toYmd(grid[0])).toBe('2026-08-31')
    expect(toYmd(grid[1])).toBe('2026-09-01')
    expect(toYmd(grid[41])).toBe('2026-10-11')
    expect(grid[0].getDay()).toBe(1)
  })
})
