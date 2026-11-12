import { describe, expect, it } from 'vitest'
import {
  CUSTOMER_COLUMN_IDS,
  DEFAULT_VISIBLE_COLUMNS,
  defaultColumnConfig,
  moveColumn,
  normalizeColumnConfig,
  shownColumns,
  tableMinWidthRem,
  toggleColumn,
} from './columns.ts'

describe('customer table columns', () => {
  it('starts with Email, Email subscription, Location, Orders and Amount spent', () => {
    const config = defaultColumnConfig()
    expect(config.visible).toEqual([
      'email',
      'email_subscription',
      'location',
      'orders',
      'amount_spent',
    ])
    expect(config.visible).toEqual(DEFAULT_VISIBLE_COLUMNS)
    // Every column is in the list, the shown ones first.
    expect([...config.order].sort()).toEqual([...CUSTOMER_COLUMN_IDS].sort())
    expect(config.order.slice(0, 5)).toEqual(DEFAULT_VISIBLE_COLUMNS)
  })

  it('shows a hidden column where it stands in the order, and hides a shown one', () => {
    const shown = toggleColumn(defaultColumnConfig(), 'note')
    expect(shown.visible).toContain('note')
    expect(shown.visible.indexOf('note')).toBe(shown.visible.length - 1)

    const hidden = toggleColumn(shown, 'orders')
    expect(hidden.visible).not.toContain('orders')
    expect(hidden.order).toEqual(shown.order)
  })

  it('moves a column to where another is, and the table follows', () => {
    const moved = moveColumn(defaultColumnConfig(), 'amount_spent', 'email')
    expect(moved.order.slice(0, 5)).toEqual([
      'amount_spent',
      'email',
      'email_subscription',
      'location',
      'orders',
    ])
    expect(shownColumns(moved).map((column) => column.id)).toEqual(
      moved.order.slice(0, 5),
    )
    // Nothing to do for the same column.
    const config = defaultColumnConfig()
    expect(moveColumn(config, 'email', 'email')).toBe(config)
  })

  it('reads a saved choice defensively', () => {
    expect(normalizeColumnConfig(null)).toEqual(defaultColumnConfig())
    expect(normalizeColumnConfig('x')).toEqual(defaultColumnConfig())
    expect(normalizeColumnConfig({ order: 'a', visible: [] })).toEqual(
      defaultColumnConfig(),
    )

    const config = normalizeColumnConfig({
      order: ['orders', 'nope', 'orders', 'note'],
      visible: ['note', 'nope', 'phone'],
    })
    // Unknown and repeated names are dropped; columns the copy lacks are added, hidden.
    expect(config.order.slice(0, 2)).toEqual(['orders', 'note'])
    expect([...config.order].sort()).toEqual([...CUSTOMER_COLUMN_IDS].sort())
    // Shown ones, in the saved order (Note comes before Phone there).
    expect(config.visible).toEqual(['note', 'phone'])
  })

  it('works out the least width of the table from the shown columns', () => {
    const none = tableMinWidthRem([])
    const some = tableMinWidthRem(shownColumns(defaultColumnConfig()))
    expect(some).toBeGreaterThan(none)
  })
})
