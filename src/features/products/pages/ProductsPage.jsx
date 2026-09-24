import { useMemo, useState } from 'react'
import { Badge } from '../../../components/ui/Badge.jsx'
import { PageHeader } from '../../../components/ui/PageHeader.jsx'
import { StatCard } from '../../../components/ui/StatCard.jsx'
import { Table, TableState } from '../../../components/ui/Table.jsx'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ProductsIcon,
  XIcon,
} from '../../../components/ui/icons.jsx'
import { formatCurrency } from '../../../lib/format.js'
import { useProducts } from '../hooks/useProducts.js'
import './ProductsPage.css'

const STATUS_TONE = { active: 'success', draft: 'neutral', archived: 'danger' }

function buildStats(products) {
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

export function ProductsPage() {
  const { products, status } = useProducts()
  const [category, setCategory] = useState('all')

  const filteredProducts = useMemo(() => {
    if (category === 'all') return products
    return products.filter((product) => product.category === category)
  }, [products, category])

  return (
    <div className="products-page">
      <PageHeader title="Products" description="Catalog health." />

      <div className="products-page__filters">
        <label className="products-page__filter">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            <option value="bags">Bags</option>
            <option value="cups">Cups</option>
            <option value="containers">Containers</option>
          </select>
        </label>

        <button
          type="button"
          className="products-page__clear"
          onClick={() => setCategory('all')}
        >
          <XIcon />
          Clear all
        </button>
      </div>

      <div className="stat-grid">
        {buildStats(filteredProducts).map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

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
                <td className="products-page__category">{product.category}</td>
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
