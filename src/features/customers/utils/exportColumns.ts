import type { CustomerListItem } from '../../../lib/api/endpoints.ts'
import type { ExportColumn } from '../../../lib/tableExport.ts'
import { capitalize, customerName } from './format.ts'

/**
 * Every column the customers export can contain: all the list API returns for a
 * customer, in a fixed order.
 */

export type CustomerExportColumnId =
  | 'id'
  | 'shopifyId'
  | 'name'
  | 'email'
  | 'phone'
  | 'role'
  | 'state'
  | 'active'
  | 'marketing'
  | 'orders'
  | 'spent'
  | 'currency'
  | 'tags'
  | 'store'
  | 'storeKey'
  | 'city'
  | 'country'
  | 'lastOrder'
  | 'createdAt'
  | 'lastLogin'

/** A column of the customers file. */
export type CustomerExportColumn = ExportColumn<CustomerListItem, CustomerExportColumnId>

export const CUSTOMER_EXPORT_COLUMNS: readonly CustomerExportColumn[] = [
  { id: 'id', header: 'Customer ID', kind: 'text', width: 38, value: (c) => c.id },
  {
    id: 'shopifyId',
    header: 'Shopify ID',
    // Text: a long id must never lose digits in a spreadsheet.
    kind: 'text',
    width: 18,
    value: (c) => (c.shopify_id == null ? '' : String(c.shopify_id)),
  },
  { id: 'name', header: 'Customer name', kind: 'text', width: 28, value: customerName },
  { id: 'email', header: 'Email', kind: 'text', width: 34, value: (c) => c.email },
  { id: 'phone', header: 'Phone', kind: 'text', width: 18, value: (c) => c.phone },
  {
    id: 'role',
    header: 'Role',
    kind: 'text',
    width: 14,
    value: (c) => capitalize(c.role),
  },
  {
    id: 'state',
    header: 'State',
    kind: 'text',
    width: 12,
    // No Shopify account state: the customer was created in the CRM.
    value: (c) => (c.shopify_state ? capitalize(c.shopify_state) : 'CRM'),
  },
  {
    id: 'active',
    header: 'Active',
    kind: 'text',
    width: 9,
    value: (c) => (c.is_active ? 'Yes' : 'No'),
  },
  {
    id: 'marketing',
    header: 'Email subscription',
    kind: 'text',
    width: 20,
    value: (c) =>
      c.accepts_marketing == null
        ? ''
        : c.accepts_marketing
          ? 'Subscribed'
          : 'Not subscribed',
  },
  {
    id: 'orders',
    header: 'Orders',
    kind: 'integer',
    width: 9,
    value: (c) => c.orders_count,
  },
  {
    id: 'spent',
    header: 'Amount spent',
    kind: 'decimal',
    width: 14,
    value: (c) => c.total_spent,
  },
  {
    id: 'currency',
    header: 'Currency',
    kind: 'text',
    width: 10,
    value: (c) => c.currency,
  },
  {
    id: 'tags',
    header: 'Tags',
    kind: 'text',
    width: 30,
    value: (c) => c.tags.join(', '),
  },
  { id: 'store', header: 'Store', kind: 'text', width: 20, value: (c) => c.shop?.name },
  {
    id: 'storeKey',
    header: 'Store key',
    kind: 'text',
    width: 18,
    value: (c) => c.shop?.key,
  },
  { id: 'city', header: 'City', kind: 'text', width: 20, value: (c) => c.city },
  { id: 'country', header: 'Country', kind: 'text', width: 20, value: (c) => c.country },
  {
    id: 'lastOrder',
    header: 'Last order',
    kind: 'text',
    width: 14,
    value: (c) => c.last_order_name,
  },
  {
    id: 'createdAt',
    header: 'Created (Shopify)',
    kind: 'text',
    width: 22,
    value: (c) => c.shopify_created_at,
  },
  {
    id: 'lastLogin',
    header: 'Last login',
    kind: 'text',
    width: 22,
    value: (c) => c.last_login_at,
  },
]
