import { Badge } from '../../../components/ui/Badge.tsx'
import {
  CheckCircleIcon,
  DollarSignIcon,
  ListChecksIcon,
  TagIcon,
} from '../../../components/ui/icons.tsx'
import type { OrderDetail } from '../../../lib/api/endpoints.ts'
import { formatDateTime, formatPrice } from '../../../lib/format.ts'
import { humanize } from '../utils/format.ts'
import { transactionMethod, transactionTone } from '../utils/payment.ts'
import {
  EmptyNote,
  FoldCard,
  MINI_ROW,
  MINI_TD,
  MINI_TH,
  MiniTable,
  RecordList,
} from './OrderCompact.tsx'

/**
 * The **Payments** tab: four small sections you can fold — Transactions (a compact table), Refunds,
 * Taxes and Discounts — each with a plain sentence when it is empty. Money is right-aligned.
 */
export function OrderPaymentsPanel({ order }: { order: OrderDetail }) {
  const money = (value: string | null | undefined) =>
    value === null || value === undefined ? '—' : formatPrice(value, order.currency)

  return (
    <div className="flex flex-col gap-2.5">
      <FoldCard
        title="Transactions"
        count={order.transactions.length}
        icon={DollarSignIcon}
      >
        {order.transactions.length === 0 ? (
          <EmptyNote>No payments yet.</EmptyNote>
        ) : (
          <div className="py-1">
            <MiniTable>
              <thead>
                <tr>
                  <th className={MINI_TH}>Type</th>
                  <th className={MINI_TH}>Status</th>
                  <th className={MINI_TH}>Gateway</th>
                  <th className={MINI_TH}>Method</th>
                  <th className={`${MINI_TH} text-right`}>Amount</th>
                  <th className={MINI_TH}>Processed</th>
                </tr>
              </thead>
              <tbody>
                {order.transactions.map((transaction) => (
                  <tr key={transaction.id} className={MINI_ROW}>
                    <td className={MINI_TD}>{humanize(transaction.kind) || '—'}</td>
                    <td className={MINI_TD}>
                      {transaction.status ? (
                        <Badge tone={transactionTone(transaction.status)}>
                          {humanize(transaction.status)}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={`${MINI_TD} break-all`}>
                      {transaction.gateway || '—'}
                    </td>
                    <td className={MINI_TD}>{transactionMethod(transaction) || '—'}</td>
                    <td className={`${MINI_TD} text-right font-semibold tabular-nums`}>
                      {money(transaction.amount)}
                    </td>
                    <td className={MINI_TD}>
                      {transaction.processed_at
                        ? formatDateTime(transaction.processed_at)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </MiniTable>
          </div>
        )}
      </FoldCard>

      <FoldCard title="Refunds" count={order.refunds.length} icon={CheckCircleIcon}>
        <RecordList records={order.refunds} empty="Nothing has been refunded." />
      </FoldCard>

      <FoldCard title="Taxes" count={order.tax_lines.length} icon={ListChecksIcon}>
        {order.tax_lines.length === 0 ? (
          <EmptyNote>No tax lines.</EmptyNote>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {order.tax_lines.map((line, index) => (
              <li
                key={`${line.title}-${index}`}
                className="border-border flex items-baseline justify-between gap-3 border-b py-1.5 text-[0.78rem] last:border-b-0"
              >
                <span>
                  {line.title || 'Tax'}
                  {line.rate !== null && line.rate !== undefined && (
                    <span className="text-text-muted"> ({Number(line.rate) * 100}%)</span>
                  )}
                </span>
                <span className="font-semibold tabular-nums">{money(line.price)}</span>
              </li>
            ))}
          </ul>
        )}
      </FoldCard>

      <FoldCard
        title="Discounts"
        count={order.discounts.length}
        icon={TagIcon}
        defaultOpen={order.discounts.length > 0}
      >
        <RecordList records={order.discounts} empty="No discounts were applied." />
      </FoldCard>
    </div>
  )
}
