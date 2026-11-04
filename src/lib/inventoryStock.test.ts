import { describe, expect, it } from 'vitest'
import type { StockLine } from './api/endpoints.ts'
import {
  applyToLines,
  formatDelta,
  quantityLabel,
  reasonLabel,
  setQuantities,
  setQuantity,
  stockLevel,
  sumLines,
  validateDelta,
  validateSet,
} from './inventoryStock.ts'

const line = (over: Partial<StockLine> = {}): StockLine => ({
  location_id: 1,
  location_name: 'Unit 9',
  updated_at: null,
  available: 5,
  on_hand: 8,
  committed: 3,
  incoming: 0,
  reserved: 0,
  safety_stock: 0,
  damaged: 0,
  quality_control: 0,
  unavailable: 0,
  ...over,
})

describe('setQuantity — the numbers Shopify will show, worked out at once', () => {
  it('moves On hand by the same amount when Available is set', () => {
    const next = setQuantity(line(), 'available', 22)
    expect(next.available).toBe(22)
    expect(next.on_hand).toBe(25)
    // Committed, incoming and unavailable are not touched.
    expect([next.committed, next.incoming, next.unavailable]).toEqual([3, 0, 0])
  })

  it('moves Available when On hand is set, never below 0', () => {
    expect(setQuantity(line(), 'on_hand', 10).available).toBe(7)
    expect(setQuantity(line(), 'on_hand', 0).available).toBe(0)
  })

  it('moves Unavailable and On hand — not Available — when damaged stock is set', () => {
    const next = setQuantity(line(), 'damaged', 2)
    expect(next.damaged).toBe(2)
    expect(next.unavailable).toBe(2)
    expect(next.on_hand).toBe(10)
    expect(next.available).toBe(5)
  })

  it('works out Unavailable from its four parts when the line does not say', () => {
    const next = setQuantity(
      line({ unavailable: null, reserved: 1, safety_stock: 2 }),
      'damaged',
      1,
    )
    expect(next.unavailable).toBe(4)
  })

  it('applies several quantities in turn', () => {
    const next = setQuantities(line(), { on_hand: 25, damaged: 2 })
    expect(next.damaged).toBe(2)
    expect(next.on_hand).toBe(27)
  })
})

describe('sumLines and applyToLines', () => {
  it('adds every quantity up over the locations', () => {
    const totals = sumLines([
      line(),
      line({ location_id: 2, available: 10, on_hand: 12 }),
    ])
    expect(totals.available).toBe(15)
    expect(totals.on_hand).toBe(20)
    expect(totals.committed).toBe(6)
  })

  it('changes the line of a location, and adds a line for a location with none yet', () => {
    const lines = [line()]
    expect(
      applyToLines(lines, 1, (l) => setQuantity(l, 'available', 9))[0].available,
    ).toBe(9)

    const added = applyToLines(lines, 70137741495, (l) => setQuantity(l, 'available', 4))
    expect(added).toHaveLength(2)
    expect(added[1]).toMatchObject({ location_id: 70137741495, available: 4, on_hand: 4 })
  })
})

describe('validation', () => {
  it('"Set to" takes a whole number, 0 or more', () => {
    expect(validateSet('22')).toBeNull()
    expect(validateSet('0')).toBeNull()
    expect(validateSet('')).toBe('Enter a number')
    expect(validateSet('-1')).toBe('Enter a whole number, 0 or more')
    expect(validateSet('2.5')).toBe('Enter a whole number, 0 or more')
  })

  it('"Adjust by" is not 0, within ±100000, and never takes the quantity below 0', () => {
    expect(validateDelta('12', 5)).toBeNull()
    expect(validateDelta('-5', 5)).toBeNull()
    expect(validateDelta('0', 5)).toMatch(/can.t be 0/)
    expect(validateDelta('-6', 5)).toBe('That would take the quantity below 0')
    expect(validateDelta('100001', 5)).toMatch(/between -100,000 and 100,000/)
    expect(validateDelta('abc', 5)).toMatch(/whole number/)
    expect(validateDelta('', 5)).toBe('Enter an amount')
  })
})

describe('small helpers', () => {
  it('stockLevel: out at 0 or below, low under the threshold, else in', () => {
    expect(stockLevel(0)).toBe('out')
    expect(stockLevel(-2)).toBe('out')
    expect(stockLevel(9)).toBe('low')
    expect(stockLevel(10)).toBe('in')
    expect(stockLevel(4, 5)).toBe('low')
    expect(stockLevel(null)).toBe('out')
  })

  it('names the quantities and reasons in words, and signs a change', () => {
    expect(quantityLabel('safety_stock')).toBe('Safety stock')
    expect(quantityLabel('something_new')).toBe('something new')
    expect(reasonLabel('cycle_count_available')).toBe('Cycle count')
    expect(reasonLabel('brand_new')).toBe('brand_new')
    expect(formatDelta(12)).toBe('+12')
    expect(formatDelta(-3)).toBe('-3')
    expect(formatDelta(0)).toBe('0')
  })
})
