import { describe, expect, it } from 'vitest'
import { formatMoney, formatPercent, profitAndMargin } from './margin.ts'

describe('profitAndMargin', () => {
  it('is the price less the cost, and that as a share of the price', () => {
    expect(profitAndMargin('40', '10')).toEqual({ profit: 30, margin: 75 })
    expect(profitAndMargin('39.99', '12.5')).toEqual({
      profit: 39.99 - 12.5,
      margin: ((39.99 - 12.5) / 39.99) * 100,
    })
  })

  it('can be a loss', () => {
    expect(profitAndMargin('10', '12.5')).toEqual({ profit: -2.5, margin: -25 })
  })

  it('gives nothing until both are real amounts', () => {
    expect(profitAndMargin('', '10')).toEqual({ profit: null, margin: null })
    expect(profitAndMargin('10', '')).toEqual({ profit: null, margin: null })
    expect(profitAndMargin('abc', '10')).toEqual({ profit: null, margin: null })
    expect(profitAndMargin('10', '1.')).toEqual({ profit: null, margin: null })
    expect(profitAndMargin(' 10 ', ' 4 ')).toEqual({ profit: 6, margin: 60 })
  })

  it('has no margin on a price of zero (nothing to divide by)', () => {
    expect(profitAndMargin('0', '5')).toEqual({ profit: -5, margin: null })
  })
})

describe('formatMoney / formatPercent', () => {
  it('writes an amount in the store’s currency, or plainly when it is not known', () => {
    expect(formatMoney(30, 'GBP')).toBe('£30.00')
    expect(formatMoney(2.5, null)).toBe('2.50')
    expect(formatMoney(null, 'GBP')).toBe('—')
  })

  it('writes a percentage with at most one decimal', () => {
    expect(formatPercent(75)).toBe('75%')
    expect(formatPercent(68.7171)).toBe('68.7%')
    expect(formatPercent(-25)).toBe('-25%')
    expect(formatPercent(null)).toBe('—')
  })
})
