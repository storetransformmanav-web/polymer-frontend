import { useState } from 'react'
import {
  ActivityIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  PoundIcon,
  TableIcon,
} from '../../../components/ui/icons.tsx'
import type { SageCustomerDetail } from '../../../lib/api/sageCustomers.ts'
import { dateText, money } from '../utils/format.ts'
import { CardShell, FigureCard, Row, RowList } from './SageCards.tsx'

type Months = NonNullable<NonNullable<SageCustomerDetail['activity']>['months']>

/** The three series of the chart and the table, with the colour of each (the theme's own tokens). */
const SERIES = [
  { key: 'invoices', label: 'Invoices', color: 'var(--color-accent)' },
  { key: 'credits', label: 'Credits', color: 'var(--color-warning)' },
  { key: 'payments', label: 'Payments', color: 'var(--color-text)' },
] as const

/** A round step (1, 2, 2.5, 5 × a power of ten) that covers `max` in about four gridlines. */
function niceStep(max: number): number {
  if (max <= 0) return 1
  const raw = max / 4
  const power = 10 ** Math.floor(Math.log10(raw))
  const unit = raw / power
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10
  return nice * power
}

const WIDTH = 760
const HEIGHT = 250
const LEFT = 70
const RIGHT = 10
const TOP = 12
const BOTTOM = 40

/**
 * The financial year month by month as grouped bars — invoices, credits and payments for each month
 * (a credit is drawn by its size) — with a money scale at the left and a legend. Every bar is one of
 * the backend's amounts for that month; the scale is worked out from the largest of them.
 */
function MonthlyChart({ months, currency }: { months: Months; currency: string | null }) {
  const values = months.flatMap((month) =>
    SERIES.map((series) => Math.abs(month[series.key] ?? 0)),
  )
  const max = Math.max(0, ...values)
  const step = niceStep(max)
  const top = max > 0 ? Math.ceil(max / step) * step : step
  const ticks = Array.from(
    { length: Math.round(top / step) + 1 },
    (_, index) => index * step,
  )
  const plotWidth = WIDTH - LEFT - RIGHT
  const plotHeight = HEIGHT - TOP - BOTTOM
  const group = plotWidth / Math.max(1, months.length)
  const bar = Math.min(18, group / 4)
  const y = (value: number) => TOP + plotHeight - (value / top) * plotHeight

  return (
    <div className="flex flex-col gap-2">
      <ul className="m-0 flex list-none flex-wrap justify-end gap-x-4 gap-y-1 p-0 text-[0.74rem]">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-sm"
              style={{ background: series.color }}
            />
            {series.label}
          </li>
        ))}
      </ul>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Invoices, credits and payments for each month of the financial year"
        className="h-auto w-full"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={LEFT}
              x2={WIDTH - RIGHT}
              y1={y(tick)}
              y2={y(tick)}
              style={{ stroke: 'var(--color-border)' }}
              strokeWidth={1}
            />
            <text
              x={LEFT - 8}
              y={y(tick) + 3.5}
              textAnchor="end"
              fontSize="10"
              style={{ fill: 'var(--color-text-muted)' }}
            >
              {money(tick, currency)}
            </text>
          </g>
        ))}
        {months.map((month, index) => {
          const x0 = LEFT + group * index + group / 2 - (bar * SERIES.length) / 2
          const [first, ...rest] = (month.month || String(month.period ?? '')).split(' ')
          return (
            <g key={`${month.month}-${index}`}>
              {SERIES.map((series, position) => {
                const value = Math.abs(month[series.key] ?? 0)
                if (value <= 0) return null
                return (
                  <rect
                    key={series.key}
                    x={x0 + bar * position}
                    y={y(value)}
                    width={bar - 1}
                    height={Math.max(1, y(0) - y(value))}
                    rx={1.5}
                    style={{ fill: series.color }}
                  >
                    <title>{`${month.month} · ${series.label}: ${money(month[series.key], currency)}`}</title>
                  </rect>
                )
              })}
              <text
                x={LEFT + group * index + group / 2}
                y={HEIGHT - BOTTOM + 14}
                textAnchor="middle"
                fontSize="10"
                style={{ fill: 'var(--color-text)' }}
              >
                {first}
              </text>
              {rest.length > 0 && (
                <text
                  x={LEFT + group * index + group / 2}
                  y={HEIGHT - BOTTOM + 26}
                  textAnchor="middle"
                  fontSize="10"
                  style={{ fill: 'var(--color-text)' }}
                >
                  {rest.join(' ')}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** The two ways the months can be read: as a chart or as a table. */
const VIEWS = [
  { id: 'chart', label: 'Chart', icon: ActivityIcon },
  { id: 'table', label: 'Table', icon: TableIcon },
] as const

type View = (typeof VIEWS)[number]['id']

/** A small two-tab switch (Chart | Table) for the Monthly Activity card's header. */
function ViewTabs({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Show the months as"
      className="border-border bg-bg inline-flex rounded-lg border p-0.5"
    >
      {VIEWS.map((item) => {
        const selected = item.id === view
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.id)}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md border-none px-3 py-1 text-[0.78rem] font-semibold transition-colors ${
              selected
                ? 'bg-accent text-accent-contrast'
                : 'text-text-muted hover:text-text bg-transparent'
            }`}
          >
            <item.icon width={14} height={14} />
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

/** Period, month and the three amounts for each month of the year, with the totals under them. */
function MonthlyBreakdown({
  months,
  currency,
}: {
  months: Months
  currency: string | null
}) {
  const suffix = currency ? ` (${currency})` : ''
  const NUMBER = 'px-3 py-1.5 text-right tabular-nums'
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-[0.82rem]">
        <thead>
          <tr className="bg-table-head text-text text-[0.7rem] tracking-wide uppercase">
            <th className="px-3 py-2 text-left font-bold">Period</th>
            <th className="px-3 py-2 text-left font-bold">Month</th>
            {SERIES.map((series) => (
              <th key={series.key} className="px-3 py-2 text-right font-bold">
                {series.label}
                {suffix}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((month, index) => (
            <tr key={`${month.month}-${index}`} className="border-border border-b">
              <td className="text-text-muted px-3 py-1.5">{month.period ?? '—'}</td>
              <td className="px-3 py-1.5 font-medium">{month.month || '—'}</td>
              {SERIES.map((series) => (
                <td key={series.key} className={NUMBER}>
                  {money(month[series.key], currency)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * **Activity** (after the shared reference design): a heading and six figures — the first and last invoice
 * dates, the last payment date and the turnover this month, this year and last year —, the **Monthly
 * Activity** chart and the **Monthly Breakdown** table of the financial year's months, and the **Financial
 * Year** (its start). It shows only the customer's details answer's `activity` — nothing worked out from it
 * and nothing from the answer's other blocks — and nothing is written in the app.
 */
export function ActivityPanel({
  detail,
  currency,
}: {
  detail: SageCustomerDetail
  currency: string | null
}) {
  const activity = detail.activity
  const months = activity?.months ?? []
  const [view, setView] = useState<View>('chart')

  return (
    <>
      <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <FigureCard
          label="First Invoice Date"
          value={dateText(activity?.first_invoice_date)}
          icon={CalendarIcon}
          tone="accent"
        />
        <FigureCard
          label="Last Invoice Date"
          value={dateText(activity?.last_invoice_date)}
          icon={CalendarIcon}
          tone="neutral"
        />
        <FigureCard
          label="Last Payment Date"
          value={dateText(activity?.last_payment_date)}
          icon={CheckCircleIcon}
          tone="good"
        />
        <FigureCard
          label="Turnover MTD"
          value={money(activity?.turnover_mtd, currency)}
          icon={PoundIcon}
          tone="warning"
        />
        <FigureCard
          label="Turnover YTD"
          value={money(activity?.turnover_ytd, currency)}
          icon={PoundIcon}
          tone="accent"
        />
        <FigureCard
          label="Prior Year Turnover"
          value={money(activity?.turnover_prior_year, currency)}
          icon={PoundIcon}
          tone="neutral"
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
        <div className="flex min-w-0 flex-col gap-4">
          <CardShell
            title="Monthly Activity"
            icon={CalendarIcon}
            action={
              months.length > 0 ? <ViewTabs view={view} onChange={setView} /> : undefined
            }
            flush={view === 'table' && months.length > 0}
          >
            {months.length === 0 ? (
              <p className="text-text-muted m-0 text-[0.85rem]">
                No activity this financial year.
              </p>
            ) : view === 'chart' ? (
              <MonthlyChart months={months} currency={currency} />
            ) : (
              <MonthlyBreakdown months={months} currency={currency} />
            )}
          </CardShell>
        </div>

        <CardShell title="Financial Year" icon={ClockIcon}>
          <RowList>
            <Row label="Financial Year Start">
              {dateText(activity?.financial_year_start)}
            </Row>
          </RowList>
        </CardShell>
      </div>
    </>
  )
}
