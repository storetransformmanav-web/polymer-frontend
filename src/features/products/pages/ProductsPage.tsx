import { useMemo, useState } from 'react'
import { Badge, type BadgeTone } from '../../../components/ui/Badge.tsx'
import { PageHeader } from '../../../components/ui/PageHeader.tsx'
import {
  StatCard,
  StatGrid,
  type StatCardProps,
} from '../../../components/ui/StatCard.tsx'
import { Table, TableState } from '../../../components/ui/Table.tsx'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ProductsIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { formatCurrency } from '../../../lib/format.ts'
import { useProducts } from '../hooks/useProducts.ts'
import type { Product, ProductCategory, ProductStatus } from '../api/mockProducts.ts'

const STATUS_TONE: Record<ProductStatus, BadgeTone> = {
  active: 'success',
  draft: 'neutral',
  archived: 'danger',
}

const FILTER_LABEL = 'text-text-muted flex flex-col gap-1 text-[0.72rem] font-semibold'
const FILTER_SELECT =
  'border-border bg-surface text-text min-w-40 rounded-md border px-2.5 py-1.5 text-[0.85rem]'
const CLEAR_BUTTON =
  'border-border bg-bg text-text-muted hover:text-danger hover:border-danger flex items-center gap-1.5 rounded-md border px-3 py-2 text-[0.82rem]'

function buildStats(products: Product[]): StatCardProps[] {
  return [
    {
      icon: ProductsIcon,
      label: 'Total products',
      value: products.length,
      meta: 'Matching filters',
    },
    {
      icon: CheckCircleIcon,
      label: 'Active',
      value: products.filter((product) => product.status === 'active').length,
      meta: 'Visible in store',
    },
    {
      icon: AlertTriangleIcon,
      label: 'Out of stock',
      value: products.filter((product) => product.inventory === 0).length,
      meta: 'Needs restocking',
      tone: 'danger',
    },
  ]
}

type CategoryFilter = ProductCategory | 'all'

export function ProductsPage() {
  const { products, status } = useProducts()
  const [category, setCategory] = useState<CategoryFilter>('all')

  const filteredProducts = useMemo(() => {
    if (category === 'all') return products
    return products.filter((product) => product.category === category)
  }, [products, category])

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Products" description="Catalog health." />

      <div className="border-border bg-bg flex flex-wrap items-end gap-4 rounded-xl border p-5">
        <label className={FILTER_LABEL}>
          <span>Category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as CategoryFilter)}
            className={FILTER_SELECT}
          >
            <option value="all">All categories</option>
            <option value="bags">Bags</option>
            <option value="cups">Cups</option>
            <option value="containers">Containers</option>
          </select>
        </label>

        <button type="button" className={CLEAR_BUTTON} onClick={() => setCategory('all')}>
          <XIcon />
          Clear all
        </button>
      </div>

      <StatGrid>
        {buildStats(filteredProducts).map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </StatGrid>

      <Table>
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Category</th>
            <th>Price</th>
            <th>Inventory</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {status === 'loading' && <TableState colSpan={6}>Loading products…</TableState>}
          {status === 'error' && (
            <TableState colSpan={6}>Couldn't load products. Try again later.</TableState>
          )}
          {status === 'success' && filteredProducts.length === 0 && (
            <TableState colSpan={6}>No products match this filter.</TableState>
          )}
          {status === 'success' &&
            filteredProducts.map((product) => (
              <tr key={product.id}>
                <td>{product.title}</td>
                <td>{product.sku}</td>
                <td className="capitalize">{product.category}</td>
                <td>{formatCurrency(product.price, product.currency)}</td>
                <td>{product.inventory}</td>
                <td>
                  <Badge tone={STATUS_TONE[product.status]}>{product.status}</Badge>
                </td>
              </tr>
            ))}
        </tbody>
      </Table>
    </div>
  )
}
