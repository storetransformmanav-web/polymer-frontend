import { useState } from 'react'
import { Panel } from '../../../components/ui/Panel.jsx'
import { StatCard } from '../../../components/ui/StatCard.jsx'
import {
  AlertTriangleIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  DollarSignIcon,
  InventoryIcon,
  OrdersIcon,
  ProductsIcon,
  XIcon,
} from '../../../components/ui/icons.jsx'
import './DashboardPage.css'

// TODO: replace with real data once features/dashboard/api exists and
// calls the backend through src/lib/api/client.js. These are
// representative placeholder figures for the UI.
const ORDER_STATS = [
  { icon: OrdersIcon, label: 'Total orders', value: '1,284', meta: 'All time' },
  {
    icon: ClockIcon,
    label: 'In progress',
    value: '37',
    meta: 'Being fulfilled',
    tone: 'warning',
  },
  {
    icon: AlertTriangleIcon,
    label: 'Awaiting payment',
    value: '9',
    meta: '$18,240 outstanding',
    tone: 'danger',
  },
]

const PRODUCT_STATS = [
  {
    icon: ProductsIcon,
    label: 'Total products',
    value: '312',
    meta: 'Across all categories',
  },
  {
    icon: CheckCircleIcon,
    label: 'Active SKUs',
    value: '289',
    meta: '92% of catalog',
  },
  {
    icon: AlertTriangleIcon,
    label: 'Out of stock',
    value: '6',
    meta: 'Needs restocking',
    tone: 'danger',
  },
]

const INVENTORY_STATS = [
  {
    icon: DollarSignIcon,
    label: 'Stock value',
    value: '$486,900',
    meta: 'Across all warehouses',
  },
  {
    icon: AlertTriangleIcon,
    label: 'Low stock alerts',
    value: '14',
    meta: 'Below reorder point',
    tone: 'warning',
  },
  { icon: InventoryIcon, label: 'Reorders due', value: '5', meta: 'This week' },
]

const DEFAULT_FILTERS = { category: 'all', customer: 'all', from: '', to: '' }

export function DashboardPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-page__header">
        <h1>Executive overview</h1>
        <p>A single source of truth for orders, products and inventory.</p>
      </header>

      <div className="dashboard-page__filters">
        <label className="dashboard-page__filter">
          <span>Category</span>
          <select
            value={filters.category}
            onChange={(event) => updateFilter('category', event.target.value)}
          >
            <option value="all">All categories</option>
            <option value="bags">Bags</option>
            <option value="cups">Cups</option>
            <option value="containers">Containers</option>
          </select>
        </label>

        <label className="dashboard-page__filter">
          <span>Customer</span>
          <select
            value={filters.customer}
            onChange={(event) => updateFilter('customer', event.target.value)}
          >
            <option value="all">All customers</option>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
          </select>
        </label>

        <label className="dashboard-page__filter dashboard-page__filter--date">
          <span>Date range</span>
          <div className="dashboard-page__date-range">
            <CalendarIcon />
            <input
              type="date"
              value={filters.from}
              onChange={(event) => updateFilter('from', event.target.value)}
              aria-label="From date"
            />
            <span>–</span>
            <input
              type="date"
              value={filters.to}
              onChange={(event) => updateFilter('to', event.target.value)}
              aria-label="To date"
            />
          </div>
        </label>

        <button
          type="button"
          className="dashboard-page__clear"
          onClick={() => setFilters(DEFAULT_FILTERS)}
        >
          <XIcon />
          Clear all
        </button>
      </div>

      <Panel icon={OrdersIcon} title="Orders" description="Order pipeline at a glance.">
        {ORDER_STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </Panel>

      <Panel icon={ProductsIcon} title="Products" description="Catalog health.">
        {PRODUCT_STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </Panel>

      <Panel
        icon={InventoryIcon}
        title="Inventory"
        description="Stock levels across warehouses."
      >
        {INVENTORY_STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </Panel>
    </div>
  )
}
