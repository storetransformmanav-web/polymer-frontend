import { describe, expect, it } from 'vitest'
import { readableSummary } from './format.ts'

describe('readableSummary', () => {
  it('drops a UUID from the summary', () => {
    expect(
      readableSummary(
        'Kairav viewed inventory 1228e801-88b1-4b0d-a4ec-4add01767c7d',
        'get_inventory',
      ),
    ).toBe('Kairav viewed inventory')
  })

  it('drops an order number and reads "an order"', () => {
    expect(readableSummary('Kairav viewed order 17516', 'get_order')).toBe(
      'Kairav viewed an order',
    )
    expect(readableSummary('Kairav viewed order #17516', 'get_order')).toBe(
      'Kairav viewed an order',
    )
  })

  it('drops Shopify ids', () => {
    expect(
      readableSummary(
        'Kairav updated product gid://shopify/Product/8123456789',
        'update',
      ),
    ).toBe('Kairav updated a product')
    expect(readableSummary('Kairav pushed product 8123456789', 'push')).toBe(
      'Kairav pushed a product',
    )
  })

  it('leaves a summary without ids alone', () => {
    expect(readableSummary('Kairav viewed the products list', 'list_products')).toBe(
      'Kairav viewed the products list',
    )
    expect(readableSummary('Kairav viewed product 42', 'get_product')).toBe(
      'Kairav viewed product 42',
    )
    expect(readableSummary('Manav created user jane@company.com', 'create_user')).toBe(
      'Manav created user jane@company.com',
    )
  })

  it('falls back to the action name', () => {
    expect(readableSummary('', 'list_orders')).toBe('List orders')
    expect(readableSummary(null, 'list_orders')).toBe('List orders')
    expect(readableSummary('4add01767c7d-1228e801-88b1-4b0d-a4ec', 'sync')).not.toBe('')
  })
})
