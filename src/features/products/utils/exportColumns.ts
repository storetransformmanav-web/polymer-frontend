import type { ProductListItem } from '../../../lib/api/endpoints.ts'
import type { ExportColumn } from '../../../lib/tableExport.ts'
import { shopifyAdminProductUrl, statusLabel } from './format.ts'

/**
 * Every column the products export can contain: all the list API returns for a
 * product (plus the product's Shopify admin link), in a fixed order.
 */

export type ExportColumnId =
  | 'id'
  | 'shopifyId'
  | 'title'
  | 'handle'
  | 'status'
  | 'vendor'
  | 'productType'
  | 'category'
  | 'tags'
  | 'store'
  | 'storeKey'
  | 'storeDomain'
  | 'priceFrom'
  | 'priceTo'
  | 'currency'
  | 'variants'
  | 'inventory'
  | 'imageUrl'
  | 'adminUrl'
  | 'createdAt'
  | 'updatedAt'
  | 'syncedAt'

/** A column of the products file. */
export type ProductExportColumn = ExportColumn<ProductListItem, ExportColumnId>

export const EXPORT_COLUMNS: readonly ProductExportColumn[] = [
  { id: 'id', header: 'Product ID', kind: 'text', width: 38, value: (item) => item.id },
  {
    id: 'shopifyId',
    header: 'Shopify ID',
    // Text: a long id must never lose digits in a spreadsheet.
    kind: 'text',
    width: 18,
    value: (item) => String(item.shopify_id),
  },
  { id: 'title', header: 'Title', kind: 'text', width: 44, value: (item) => item.title },
  {
    id: 'handle',
    header: 'Handle',
    kind: 'text',
    width: 30,
    value: (item) => item.handle,
  },
  {
    id: 'status',
    header: 'Status',
    kind: 'text',
    width: 12,
    value: (item) => (item.status ? statusLabel(item.status) : ''),
  },
  {
    id: 'vendor',
    header: 'Vendor',
    kind: 'text',
    width: 24,
    value: (item) => item.vendor,
  },
  {
    id: 'productType',
    header: 'Product type',
    kind: 'text',
    width: 22,
    value: (item) => item.product_type,
  },
  {
    id: 'category',
    header: 'Category',
    kind: 'text',
    width: 24,
    value: (item) => item.category_name,
  },
  {
    id: 'tags',
    header: 'Tags',
    kind: 'text',
    width: 30,
    value: (item) => item.tags.join(', '),
  },
  {
    id: 'store',
    header: 'Store',
    kind: 'text',
    width: 20,
    value: (item) => item.shop?.name,
  },
  {
    id: 'storeKey',
    header: 'Store key',
    kind: 'text',
    width: 18,
    value: (item) => item.shop?.key,
  },
  {
    id: 'storeDomain',
    header: 'Store domain',
    kind: 'text',
    width: 32,
    value: (item) => item.shop?.domain,
  },
  {
    id: 'priceFrom',
    header: 'Price from',
    kind: 'decimal',
    width: 12,
    value: (item) => item.price_min,
  },
  {
    id: 'priceTo',
    header: 'Price to',
    kind: 'decimal',
    width: 12,
    value: (item) => item.price_max,
  },
  {
    id: 'currency',
    header: 'Currency',
    kind: 'text',
    width: 10,
    value: (item) => item.currency,
  },
  {
    id: 'variants',
    header: 'Variants',
    kind: 'integer',
    width: 10,
    value: (item) => item.variants_count,
  },
  {
    id: 'inventory',
    header: 'Inventory',
    kind: 'integer',
    width: 11,
    value: (item) => item.total_inventory,
  },
  {
    id: 'imageUrl',
    header: 'Image URL',
    kind: 'text',
    width: 40,
    value: (item) => item.image_url,
  },
  {
    id: 'adminUrl',
    header: 'Shopify admin URL',
    kind: 'text',
    width: 50,
    value: (item) => shopifyAdminProductUrl(item.shop, item.shopify_id),
  },
  {
    id: 'createdAt',
    header: 'Created (Shopify)',
    kind: 'text',
    width: 22,
    value: (item) => item.shopify_created_at,
  },
  {
    id: 'updatedAt',
    header: 'Updated (Shopify)',
    kind: 'text',
    width: 22,
    value: (item) => item.shopify_updated_at,
  },
  {
    id: 'syncedAt',
    header: 'Last synced',
    kind: 'text',
    width: 22,
    value: (item) => item.synced_at,
  },
]
