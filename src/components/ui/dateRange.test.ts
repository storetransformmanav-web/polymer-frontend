import { describe, expect, it } from 'vitest'
import { RANGE_PRESETS, matchingPreset, monthGrid, parseYmd, toYmd } from './dateRange.ts'

// Friday 16 October 2026.
const TODAY = new Date(2026, 9, 16)

const preset = (label: string) => {
  const found = RANGE_PRESETS.find((item) => item.label === label)
  if (!found) throw new Error(label)
  return found.range(TODAY)
}

describe('presets', () => {
  it('lists the quick choices in order', () => {
    expect(RANGE_PRESETS.map((item) => item.label)).toEqual([
      'All Time',
      'Today',
      'Last 7 Days',
      'Last 30 Days',
      'Last 60 Days',
    ])
  })

  it('works out each quick choice from today', () => {
    expect(preset('All Time')).toEqual({ from: '', to: '' })
    expect(preset('Today')).toEqual({ from: '2026-10-16', to: '2026-10-16' })
    expect(preset('Last 7 Days')).toEqual({ from: '2026-10-10', to: '2026-10-16' })
    expect(preset('Last 30 Days')).toEqual({ from: '2026-09-17', to: '2026-10-16' })
    expect(preset('Last 60 Days')).toEqual({ from: '2026-08-18', to: '2026-10-16' })
  })

  it('finds the preset a range equals, if any', () => {
    expect(matchingPreset({ from: '', to: '' }, TODAY)?.label).toBe('All Time')
    expect(matchingPreset({ from: '2026-10-10', to: '2026-10-16' }, TODAY)?.label).toBe(
      'Last 7 Days',
    )
    expect(
      matchingPreset({ from: '2026-10-14', to: '2026-10-20' }, TODAY),
    ).toBeUndefined()
  })
})

describe('days', () => {
  it('round-trips and rejects days that do not exist', () => {
    expect(toYmd(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(parseYmd('2026-10-16')?.getDate()).toBe(16)
    expect(parseYmd('2026-02-30')).toBeNull()
    expect(parseYmd('16/10/2026')).toBeNull()
  })

  it('lays a month out in six Sunday-first weeks', () => {
    // September 2026 starts on a Tuesday: 30 August (a Sunday) leads the first row.
    const grid = monthGrid(2026, 8)
    expect(grid).toHaveLength(42)
    expect(toYmd(grid[0])).toBe('2026-08-30')
    expect(toYmd(grid[2])).toBe('2026-09-01')
    expect(toYmd(grid[41])).toBe('2026-10-10')
    expect(grid[0].getDay()).toBe(0)
  })
})
