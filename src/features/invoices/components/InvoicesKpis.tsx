import {
  AlertTriangleIcon,
  CheckCircleIcon,
  FileTextIcon,
  PoundIcon,
} from '../../../components/ui/icons.tsx'
import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import type { InvoiceKindCount, InvoiceTotals } from '../../../lib/api/invoices.ts'
import { count, kindCountsText, money } from '../utils/format.ts'

/**
 * The figures above the list, read from the answer's `totals` block — they cover **every**
 * invoice the filters match, not just the page shown, and make no request of their own: **Total
 * invoices** (with what `kind_counts` says it is made of), **Net**, **Tax**, **Gross**, **Paid**
 * and **Outstanding amount**, and **Overdue invoices**. A dash shows until the answer arrives.
 */
export function InvoicesKpis({
  totals,
  total,
  kindCounts,
  currency,
}: {
  /** The answer's `totals`, or null when it has none (yet). */
  totals: InvoiceTotals | null
  /** The answer's own `total` — the fallback for the number of invoices. */
  total: number | null
  kindCounts: readonly InvoiceKindCount[]
  /** The invoices' currency (the first one's), pounds when the answer names none. */
  currency: string | null
}) {
  const outstanding = totals?.outstanding ?? null
  const overdue = totals?.overdue ?? null
  const kpis: Kpi[] = [
    {
      label: 'Total Invoices',
      value: count(totals?.invoices ?? total),
      hint: kindCountsText(kindCounts) || 'Everything matching the list',
      icon: FileTextIcon,
    },
    {
      label: 'Net Amount',
      value: money(totals?.net, currency),
      hint: 'Before tax',
      icon: PoundIcon,
    },
    {
      label: 'Tax Amount',
      value: money(totals?.tax, currency),
      hint: 'VAT on the invoices',
      icon: PoundIcon,
    },
    {
      label: 'Gross Amount',
      value: money(totals?.gross, currency),
      hint: 'Net plus tax',
      icon: PoundIcon,
    },
    {
      label: 'Paid Amount',
      value: money(totals?.paid, currency),
      hint: 'Received so far',
      icon: CheckCircleIcon,
      tone: 'good',
    },
    {
      label: 'Outstanding Amount',
      value: money(outstanding, currency),
      hint: 'Still to be paid',
      icon: PoundIcon,
      tone: outstanding !== null && outstanding > 0 ? 'warning' : 'default',
    },
    {
      label: 'Overdue Invoices',
      value: count(overdue),
      hint: 'Past their due date and not paid',
      icon: AlertTriangleIcon,
      tone: overdue !== null && overdue > 0 ? 'danger' : 'default',
    },
  ]
  return <KpiCards items={kpis} />
}
