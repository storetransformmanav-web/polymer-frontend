import { DateRangePicker } from '../../../components/ui/DateRangePicker.tsx'
import { XIcon } from '../../../components/ui/icons.tsx'
import type { SalesOverview } from '../../../lib/api/salesOverview.ts'
import type { SalesRange } from '../hooks/useSalesOverview.ts'
import { formatPeriod, SALES_RANGE_PRESETS } from '../utils/format.ts'

/**
 * The filter card under the figures, looking like the Products page's: the period, Clear All and,
 * at the right, the dates the figures cover (and the ones they are compared with).
 */
export function AnalyticsToolbar({
  range,
  period,
  onChange,
}: {
  range: SalesRange
  /** The answer's period; missing until it arrives. */
  period: SalesOverview['period'] | undefined
  onChange: (range: SalesRange) => void
}) {
  const filtered = Boolean(range.from || range.to)

  return (
    <section
      aria-label="Analytics filters"
      className="border-border bg-bg flex flex-wrap items-center gap-3 rounded-2xl border p-3 text-[0.82rem] sm:px-5"
    >
      <span className="text-text font-semibold">Period</span>
      <DateRangePicker
        label="Period"
        from={range.from}
        to={range.to}
        presets={SALES_RANGE_PRESETS}
        onChange={onChange}
      />
      <button
        type="button"
        onClick={() => onChange({ from: '', to: '' })}
        disabled={!filtered}
        className={`flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 ${
          filtered
            ? 'border-danger text-danger hover:bg-danger-bg'
            : 'border-border text-text-muted hover:border-danger hover:text-danger'
        }`}
      >
        <XIcon width={14} height={14} />
        Clear All
      </button>
      {period && (
        <p className="text-text-muted m-0 sm:ml-auto">
          Showing{' '}
          <strong className="text-text font-semibold">
            {formatPeriod(period.date_from, period.date_to)}
          </strong>
          {period.previous_from && period.previous_to && (
            <> · compared with {formatPeriod(period.previous_from, period.previous_to)}</>
          )}
        </p>
      )}
    </section>
  )
}
