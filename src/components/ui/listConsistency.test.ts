/// <reference types="node" />
// (Reads source files from disk, so it needs Node's types.)
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The Orders, Products and Customers lists must look alike: the same table text size,
 * the same header size, the same row-action buttons and icon size. This reads their source
 * so a change to one list that drifts from the others fails here.
 */

const LISTS = {
  Orders: 'src/features/orders/components/OrdersList.tsx',
  Products: 'src/features/products/components/ProductsList.tsx',
  Customers: 'src/features/customers/components/CustomersList.tsx',
}
const TOOLBARS = {
  Orders: 'src/features/orders/components/OrdersToolbar.tsx',
  Products: 'src/features/products/components/ProductsToolbar.tsx',
  Customers: 'src/features/customers/components/CustomersToolbar.tsx',
}
const ALL_TOOLBARS = [
  ...Object.values(TOOLBARS),
  'src/features/activity/components/ActivityToolbar.tsx',
  'src/features/users/components/UsersToolbar.tsx',
]
const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Orders, Products and Customers lists look alike', () => {
  it('use one table text size and one header text size', () => {
    for (const [name, path] of Object.entries(LISTS)) {
      const code = source(path)
      expect(code, name).toMatch(/table-fixed border-collapse text-\[0\.85rem\]/)
      expect(code, name).toMatch(/text-\[0\.7rem\] font-bold tracking-wide/)
    }
  })

  it('keep alignment out of the shared cell class, so a centred or right-aligned cell really is', () => {
    // `text-left` in the base class beats `text-center` added next to it (Tailwind orders
    // center, left, right), which pushed centred cells to the left, away from their header.
    for (const [name, path] of Object.entries(LISTS)) {
      expect(source(path), name).not.toMatch(/const TD = '[^']*text-(left|center|right)/)
    }
  })

  it('give the customers, orders and products tables a width for every column, from the column list', () => {
    // The columns are chosen in the Columns menu, so each one carries its own width (in rem) and
    // the header draws it — no column is left to share the rest by chance.
    for (const path of [LISTS.Customers, LISTS.Orders, LISTS.Products]) {
      const code = source(path)
      const header = code.slice(code.indexOf('<thead>'), code.indexOf('</thead>'))
      expect(header, path).toContain('style={{ width: `${column.width}rem` }}')
    }
  })

  it('use the shared row-action buttons (one size, one icon size) and no bare icon buttons', () => {
    for (const [name, path] of Object.entries(LISTS)) {
      const code = source(path)
      expect(code, name).toContain("from '../../../components/ui/rowActions.ts'")
      expect(code, name).toContain('className={ROW_ACTION}')
      // The old, differently-sized buttons are gone.
      expect(code, name).not.toMatch(/p-1 transition-colors/)
      expect(code, name).not.toMatch(
        /inline-flex h-8 w-8 items-center justify-center rounded-lg transition/,
      )
      // Icons keep the default 20px: no one-off size on the row actions.
      expect(code, name).not.toMatch(/<(Eye|Trash)Icon [^>]*(width|height)/)
    }
  })

  it('use the same thumbnail / avatar size in the first column', () => {
    expect(source(LISTS.Customers)).toContain('h-8 w-8 shrink-0')
    expect(source('src/features/products/components/ProductImage.tsx')).toContain(
      "sm: { box: 'h-8 w-8 rounded-md'",
    )
  })

  it('use the same search, button and filter text sizes in their toolbars', () => {
    for (const [name, path] of Object.entries(TOOLBARS)) {
      const code = source(path)
      // Search box: 44px tall, 0.9rem text.
      expect(code, name).toContain('h-11 min-w-0 items-center gap-2.5')
      expect(code, name).toContain('text-[0.9rem] outline-none')
      // Filters / Clear All: 40px tall, 0.82rem text, 16px and 14px icons.
      expect(code, name).toContain(
        'h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3.5 text-[0.82rem]',
      )
      expect(code, name).toContain('<SlidersIcon width={16} height={16} />')
      expect(code, name).toContain('<XIcon width={14} height={14} />')
      // The filter grid's selects are the compact ones.
      expect(code, name).toContain('compact')
    }
  })

  it('marks enabled Clear All buttons red and keeps them disabled without filters', () => {
    for (const path of ALL_TOOLBARS) {
      const code = source(path)
      const clearButtonStart = code.indexOf('onClick={onReset}')
      const clearButtonEnd = code.indexOf('</button>', clearButtonStart)
      const clearButton = code.slice(clearButtonStart, clearButtonEnd)

      expect(clearButton, path).toContain('disabled={!hasFilters')
      expect(clearButton, path).toContain('border-danger text-danger hover:bg-danger-bg')
      expect(clearButton, path).toContain(
        'border-border text-text-muted hover:border-danger',
      )
      expect(clearButton, path).toContain(
        'disabled:pointer-events-none disabled:opacity-50',
      )
    }

    expect(source(TOOLBARS.Products)).toContain('hasFilters || hasSelection')
  })
})
