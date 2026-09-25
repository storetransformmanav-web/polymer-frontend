import { productSchema, type Product } from '../schemas/product.ts'

export type { Product, ProductCategory, ProductStatus } from '../schemas/product.ts'

/**
 * Mock product data, shaped after the fields this app will eventually
 * sync from the client's Shopify catalog (title, SKU, product type,
 * status, inventory quantity, price in the store's currency).
 *
 * TODO: same note as features/orders/api/mockOrders.ts — this will be
 * replaced by a call through src/lib/api/client.ts to our backend's
 * Shopify-synced product data, not a direct Shopify Admin API call
 * from the browser. Validate that response with
 * `productSchema.array().parse(response)` before returning it.
 */

type MockProductSeed = Omit<Product, 'id' | 'currency'>

const PRODUCT_SEEDS: MockProductSeed[] = [
  {
    title: 'Kraft Paper Bag — Small',
    sku: 'PLY-BAG-1000',
    category: 'bags',
    status: 'active',
    price: 4.2,
    inventory: 210,
  },
  {
    title: 'Kraft Paper Bag — Large',
    sku: 'PLY-BAG-1001',
    category: 'bags',
    status: 'active',
    price: 5.6,
    inventory: 165,
  },
  {
    title: 'Compostable Carrier Bag',
    sku: 'PLY-BAG-1002',
    category: 'bags',
    status: 'draft',
    price: 6.4,
    inventory: 0,
  },
  {
    title: 'Double-Wall Coffee Cup 8oz',
    sku: 'PLY-CUP-1003',
    category: 'cups',
    status: 'active',
    price: 3.1,
    inventory: 340,
  },
  {
    title: 'Double-Wall Coffee Cup 12oz',
    sku: 'PLY-CUP-1004',
    category: 'cups',
    status: 'active',
    price: 3.6,
    inventory: 198,
  },
  {
    title: 'Compostable Cup Lid',
    sku: 'PLY-CUP-1005',
    category: 'cups',
    status: 'active',
    price: 1.2,
    inventory: 412,
  },
  {
    title: 'Cold Cup 16oz',
    sku: 'PLY-CUP-1006',
    category: 'cups',
    status: 'archived',
    price: 3.9,
    inventory: 0,
  },
  {
    title: 'Clear Deli Container 500ml',
    sku: 'PLY-CON-1007',
    category: 'containers',
    status: 'active',
    price: 7.8,
    inventory: 88,
  },
  {
    title: 'Clear Deli Container 750ml',
    sku: 'PLY-CON-1008',
    category: 'containers',
    status: 'active',
    price: 8.9,
    inventory: 52,
  },
  {
    title: 'Burger Box — Medium',
    sku: 'PLY-CON-1009',
    category: 'containers',
    status: 'draft',
    price: 9.4,
    inventory: 30,
  },
  {
    title: 'Ice Cream Tub 16oz',
    sku: 'PLY-CON-1010',
    category: 'containers',
    status: 'active',
    price: 6.2,
    inventory: 74,
  },
  {
    title: 'Pizza Box 12"',
    sku: 'PLY-CON-1011',
    category: 'containers',
    status: 'active',
    price: 10.5,
    inventory: 120,
  },
]

const MOCK_PRODUCTS: Product[] = productSchema.array().parse(
  PRODUCT_SEEDS.map((product, index) => ({
    id: `product-${index + 1}`,
    currency: 'GBP',
    ...product,
  })),
)

/**
 * Resolves with mock products after a short simulated delay, so
 * callers exercise real loading states even though there's no network
 * call yet.
 */
export function getProducts(): Promise<Product[]> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(MOCK_PRODUCTS), 350)
  })
}
