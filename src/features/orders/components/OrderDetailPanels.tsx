import { ClockIcon } from '../../../components/ui/icons.tsx'
import type { OrderDetail } from '../../../lib/api/endpoints.ts'
import { EmptyNote, MiniCard, RecordList } from './OrderCompact.tsx'

/** The **Timeline** tab: the order's events, as small blocks of their plain fields. */
export function OrderEventsPanel({ order }: { order: OrderDetail }) {
  return (
    <MiniCard title="Timeline" icon={ClockIcon} count={order.events.length}>
      {order.events.length === 0 ? (
        <EmptyNote>No events yet.</EmptyNote>
      ) : (
        <RecordList records={order.events} empty="No events yet." />
      )}
    </MiniCard>
  )
}
