import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILTERS,
  filtersChanged,
  filtersReset,
  hasActiveFilters,
  inventoryReducer,
  toParams,
} from './inventorySlice.ts'
import { ALL_SHOPS, shopSelected } from './shopSlice.ts'

const initial = () => inventoryReducer(undefined, { type: 'init' })

describe('the inventory list follows the top-bar store', () => {
  it('sends no shop for "All shops", and the chosen store otherwise', () => {
    expect(toParams(DEFAULT_FILTERS)).not.toHaveProperty('shop')
    expect(toParams({ ...DEFAULT_FILTERS, shop: 'polymer-uk' }).shop).toBe('polymer-uk')
  })

  it('picking a store lists it from page 1 and drops the location (another store has others)', () => {
    let state = inventoryReducer(
      initial(),
      filtersChanged({ page: 3, location: '60465184951', search: 'box' }),
    )
    expect(state.filters.page).toBe(3)

    state = inventoryReducer(state, shopSelected('polymer-uk'))
    expect(state.filters).toMatchObject({
      shop: 'polymer-uk',
      page: 1,
      location: '',
      search: 'box',
    })

    state = inventoryReducer(state, shopSelected(ALL_SHOPS))
    expect(state.filters.shop).toBe('')
  })

  it('Clear All keeps the store, and the store alone is not a filter to clear', () => {
    let state = inventoryReducer(initial(), shopSelected('polymer-uk'))
    expect(hasActiveFilters(state.filters)).toBe(false)

    state = inventoryReducer(state, filtersChanged({ search: 'box', status: 'low' }))
    state = inventoryReducer(state, filtersReset())
    expect(state.filters.shop).toBe('polymer-uk')
    expect(state.filters.search).toBe('')
  })
})
