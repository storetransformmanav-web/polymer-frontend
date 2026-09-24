import { useState } from 'react'
import { PageHeader } from '../../../components/ui/PageHeader.jsx'
import { StatCard } from '../../../components/ui/StatCard.jsx'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ProductsIcon,
  XIcon,
} from '../../../components/ui/icons.jsx'
import './ProductsPage.css'

// TODO: replace with real data once features/products/api exists and
// calls the backend through src/lib/api/client.js. These are
// representative placeholder figures for the UI.
const PRODUCT_STATS = [
  {
    icon: ProductsIcon,
    label: 'Total products',
    value: '312',
    meta: 'Across all categories',
  },
  { icon: CheckCircleIcon, label: 'Active SKUs', value: '289', meta: '92% of catalog' },
  {
    icon: AlertTriangleIcon,
    label: 'Out of stock',
    value: '6',
    meta: 'Needs restocking',
    tone: 'danger',
  },
]

export function ProductsPage() {
  const [category, setCategory] = useState('all')

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
        {PRODUCT_STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
    </div>
  )
}
