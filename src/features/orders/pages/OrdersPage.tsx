import { useMemo, useState } from 'react'
import { Badge, type BadgeTone } from '../../../components/ui/Badge.tsx'
import { PageHeader } from '../../../components/ui/PageHeader.tsx'
import { StatCard, type StatCardProps } from '../../../components/ui/StatCard.tsx'
import { Table, TableState } from '../../../components/ui/Table.tsx'
import {
  AlertTriangleIcon,
  CalendarIcon,
  ClockIcon,
  OrdersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { formatCurrency, formatDate } from '../../../lib/format.ts'
import { useOrders } from '../hooks/useOrders.ts'
import type {
  CustomerType,
  FinancialStatus,
  FulfillmentStatus,
  Order,
} from '../api/mockOrders.ts'
import './OrdersPage.css'

const FINANCIAL_STATUS_TONE: Record<FinancialStatus, BadgeTone> = {
  paid: 'success',
  pending: 'warning',
  refunded: 'neutral',
}
const FULFILLMENT_STATUS_TONE: Record<FulfillmentStatus, BadgeTone> = {
  fulfilled: 'success',
  partial: 'warning',
  unfulfilled: 'neutral',
}

interface Filters {
  customer: CustomerType | 'all'
  from: string
  to: string
}

const DEFAULT_FILTERS: Filters = { customer: 'all', from: '', to: '' }

function buildStats(orders: Order[]): StatCardProps[] {
  return [
    {
      icon: OrdersIcon,
      label: 'Total orders',
      value: orders.length,
      meta: 'Matching filters',
    },
    {
      icon: ClockIcon,
      label: 'Unfulfilled',
      value: orders.filter((order) => order.fulfillmentStatus !== 'fulfilled').length,
      meta: 'Needs action',
      tone: 'warning',
    },
    {
      icon: AlertTriangleIcon,
      label: 'Awaiting payment',
      value: orders.filter((order) => order.financialStatus === 'pending').length,
      meta: 'Pending payment',
      tone: 'danger',
    },
  ]
}

export function OrdersPage() {
  const { orders, status } = useOrders()
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (filters.customer !== 'all' && order.customer.type !== filters.customer) {
        return false
      }
      if (filters.from && order.createdAt < filters.from) return false
      if (filters.to && order.createdAt > `${filters.to}T23:59:59`) return false
      return true
    })
  }, [orders, filters])

  return (
    <div className="orders-page">
      <PageHeader title="Orders" description="Order pipeline at a glance." />

      <div className="orders-page__filters">
        <label className="orders-page__filter">
          <span>Customer</span>
          <select
            value={filters.customer}
            onChange={(event) =>
              updateFilter('customer', event.target.value as Filters['customer'])
            }
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
        {buildStats(filteredOrders).map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <Table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Date</th>
            <th>Payment</th>
            <th>Fulfillment</th>
            <th>Items</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {status === 'loading' && <TableState colSpan={7}>Loading orders…</TableState>}
          {status === 'error' && (
            <TableState colSpan={7}>Couldn't load orders. Try again later.</TableState>
          )}
          {status === 'success' && filteredOrders.length === 0 && (
            <TableState colSpan={7}>No orders match these filters.</TableState>
          )}
          {status === 'success' &&
            filteredOrders.map((order) => (
              <tr key={order.id}>
                <td>{order.orderNumber}</td>
                <td>{order.customer.name}</td>
                <td>{formatDate(order.createdAt)}</td>
                <td>
                  <Badge tone={FINANCIAL_STATUS_TONE[order.financialStatus]}>
                    {order.financialStatus}
                  </Badge>
                </td>
                <td>
                  <Badge tone={FULFILLMENT_STATUS_TONE[order.fulfillmentStatus]}>
                    {order.fulfillmentStatus}
                  </Badge>
                </td>
                <td>{order.lineItemCount}</td>
                <td>{formatCurrency(order.total, order.currency)}</td>
              </tr>
            ))}
        </tbody>
      </Table>
    </div>
  )
}
