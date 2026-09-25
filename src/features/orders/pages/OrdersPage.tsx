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

const FILTER_LABEL = 'text-text-muted flex flex-col gap-1 text-[0.72rem] font-semibold'
const FILTER_SELECT =
  'border-border bg-surface text-text min-w-40 rounded-md border px-2.5 py-1.5 text-[0.85rem]'
const CLEAR_BUTTON =
  'border-border bg-bg text-text-muted hover:text-danger hover:border-danger flex items-center gap-1.5 rounded-md border px-3 py-2 text-[0.82rem]'

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
    <div className="flex flex-col gap-7">
      <PageHeader title="Orders" description="Order pipeline at a glance." />

      <div className="border-border bg-bg flex flex-wrap items-end gap-4 rounded-xl border p-5">
        <label className={FILTER_LABEL}>
          <span>Customer</span>
          <select
            value={filters.customer}
            onChange={(event) =>
              updateFilter('customer', event.target.value as Filters['customer'])
            }
            className={FILTER_SELECT}
          >
            <option value="all">All customers</option>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
          </select>
        </label>

        <label className={FILTER_LABEL}>
          <span>Date range</span>
          <div className="border-border bg-surface text-text-muted flex items-center gap-1.5 rounded-md border px-2.5 py-1.5">
            <CalendarIcon />
            <input
              type="date"
              value={filters.from}
              onChange={(event) => updateFilter('from', event.target.value)}
              aria-label="From date"
              className="text-text border-none bg-transparent py-0.5 text-[0.85rem] outline-none"
            />
            <span>–</span>
            <input
              type="date"
              value={filters.to}
              onChange={(event) => updateFilter('to', event.target.value)}
              aria-label="To date"
              className="text-text border-none bg-transparent py-0.5 text-[0.85rem] outline-none"
            />
          </div>
        </label>

        <button
          type="button"
          className={CLEAR_BUTTON}
          onClick={() => setFilters(DEFAULT_FILTERS)}
        >
          <XIcon />
          Clear all
        </button>
      </div>

      <StatGrid>
        {buildStats(filteredOrders).map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </StatGrid>

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
