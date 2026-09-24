import { useState } from 'react'
import { PageHeader } from '../../../components/ui/PageHeader.jsx'
import { StatCard } from '../../../components/ui/StatCard.jsx'
import {
  AlertTriangleIcon,
  CalendarIcon,
  ClockIcon,
  OrdersIcon,
  XIcon,
} from '../../../components/ui/icons.jsx'
import './OrdersPage.css'

// TODO: replace with real data once features/orders/api exists and
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

const DEFAULT_FILTERS = { customer: 'all', from: '', to: '' }

export function OrdersPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="orders-page">
      <PageHeader title="Orders" description="Order pipeline at a glance." />

      <div className="orders-page__filters">
        <label className="orders-page__filter">
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

        <label className="orders-page__filter orders-page__filter--date">
          <span>Date range</span>
          <div className="orders-page__date-range">
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
          className="orders-page__clear"
          onClick={() => setFilters(DEFAULT_FILTERS)}
        >
          <XIcon />
          Clear all
        </button>
      </div>

      <div className="stat-grid">
        {ORDER_STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
    </div>
  )
}
