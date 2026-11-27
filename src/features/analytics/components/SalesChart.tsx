import { useEffect, useId, useRef, useState } from 'react'
import { toYmd } from '../../../components/ui/dateRange.ts'
import type { SalesOverview, SalesTrendPoint } from '../../../lib/api/salesOverview.ts'
import { formatPrice } from '../../../lib/format.ts'
import { storeToday } from '../../../lib/storeTime.ts'
import {
  formatCompactMoney,
  formatCount,
  formatPeriod,
  formatPointName,
  formatTick,
  niceTicks,
  smoothPath,
} from '../utils/format.ts'
import { CARD, CardTitle } from './AnalyticsCard.tsx'

const MEASURES = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'orders', label: 'Orders' },
  { key: 'units_sold', label: 'Units' },
] as const

type Measure = (typeof MEASURES)[number]['key']

const PAD = { top: 14, right: 14, bottom: 28, left: 50 }
/** The least room a date under the axis needs. */
const TICK_ROOM = 64

/** The box's size, so the chart is drawn at its real size (text never stretches). */
function useSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 720, height: 240 })
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setSize({ width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}

/**
 * Sales over time: one measure at a time on one scale (revenue, orders or units — never two
 * scales on one chart), with every figure of a point in its tooltip. Point at the chart, or
 * focus it and use the arrow keys. The same figures follow as a table for screen readers.
 */
export function SalesChart({ overview }: { overview: SalesOverview }) {
  const [measure, setMeasure] = useState<Measure>('revenue')
  const [active, setActive] = useState<number | null>(null)
  const [box, { width, height }] = useSize()
  const fillId = useId()

  const { trend, period } = overview
  const currency = overview.currency || 'GBP'
  const groupBy = period.group_by || 'day'
  const step = groupBy === 'week' ? 'Weekly' : groupBy === 'month' ? 'Monthly' : 'Daily'
  const label = MEASURES.find((item) => item.key === measure)!.label

  const plotWidth = Math.max(1, width - PAD.left - PAD.right)
  const plotHeight = Math.max(1, height - PAD.top - PAD.bottom)
  const values = trend.map((point) => point[measure])
  const ticks = niceTicks(Math.max(0, ...values), 4, measure !== 'revenue')
  const top = ticks[ticks.length - 1]
  const x = (index: number) =>
    PAD.left +
    (trend.length > 1 ? (index / (trend.length - 1)) * plotWidth : plotWidth / 2)
  const y = (value: number) => PAD.top + plotHeight * (1 - Math.max(0, value) / top)
  const points = values.map((value, index) => ({ x: x(index), y: y(value) }))
  const line = smoothPath(points)
  const base = PAD.top + plotHeight
  const area = points.length
    ? `${line} L${points[points.length - 1].x},${base} L${points[0].x},${base} Z`
    : ''
  const every = Math.max(
    1,
    Math.ceil(trend.length / Math.floor(plotWidth / TICK_ROOM || 1)),
  )
  const markers = trend.length <= 62 && plotWidth / Math.max(1, trend.length) >= 9

  const money = (value: number) => formatPrice(value, currency)
  const today = toYmd(storeToday())
  const shown: SalesTrendPoint | null = active === null ? null : (trend[active] ?? null)

  function pointAt(clientX: number, left: number) {
    if (!trend.length) return
    const ratio = (clientX - left - PAD.left) / plotWidth
    const index = Math.round(ratio * (trend.length - 1))
    setActive(Math.min(trend.length - 1, Math.max(0, index)))
  }

  return (
    <section
      aria-label="Sales over time"
      className={`${CARD} relative flex min-w-0 flex-col p-4`}
    >
      <CardTitle
        title="Sales over time"
        note={`${step} ${label.toLowerCase()}, ${formatPeriod(period.date_from, period.date_to)}`}
      >
        <div
          role="group"
          aria-label="Chart shows"
          className="border-border bg-surface flex gap-1 rounded-lg border p-1"
        >
          {MEASURES.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={measure === item.key}
              onClick={() => setMeasure(item.key)}
              className={`cursor-pointer rounded-md border-none px-3 py-1 text-[0.76rem] font-semibold transition-colors ${
                measure === item.key
                  ? 'bg-accent text-accent-contrast'
                  : 'text-text-muted hover:text-text bg-transparent'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </CardTitle>

      <div
        ref={box}
        className="relative mt-3 h-60 w-full xl:h-auto xl:min-h-40 xl:flex-1"
      >
        {trend.length === 0 ? (
          <p className="text-text-muted m-0 py-16 text-center text-[0.85rem]">
            There are no sales to chart for this period.
          </p>
        ) : (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${label} chart. Use the left and right arrow keys to read each point.`}
            tabIndex={0}
            className="focus-visible:outline-accent absolute inset-0 block max-w-full touch-pan-y rounded-lg focus-visible:outline-2"
            onPointerMove={(event) =>
              pointAt(event.clientX, event.currentTarget.getBoundingClientRect().left)
            }
            onPointerDown={(event) =>
              pointAt(event.clientX, event.currentTarget.getBoundingClientRect().left)
            }
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive((current) => current ?? trend.length - 1)}
            onBlur={() => setActive(null)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
              event.preventDefault()
              const move = event.key === 'ArrowLeft' ? -1 : 1
              setActive((current) =>
                Math.min(
                  trend.length - 1,
                  Math.max(0, (current ?? trend.length - 1) + move),
                ),
              )
            }}
          >
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.03" />
              </linearGradient>
            </defs>
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  className="stroke-border"
                />
                <text
                  x={PAD.left - 8}
                  y={y(tick) + 4}
                  textAnchor="end"
                  className="fill-text-muted text-[0.68rem] tabular-nums"
                >
                  {measure === 'revenue'
                    ? formatCompactMoney(tick, currency)
                    : formatCount(tick)}
                </text>
              </g>
            ))}
            {trend.map((point, index) =>
              // Every nth date, and the last one in place of a neighbour it would run into.
              (index % every === 0 && trend.length - 1 - index >= every) ||
              index === trend.length - 1 ? (
                <text
                  key={point.period_start}
                  x={x(index)}
                  y={height - 8}
                  textAnchor={
                    index === 0 ? 'start' : index === trend.length - 1 ? 'end' : 'middle'
                  }
                  className="fill-text-muted text-[0.68rem]"
                >
                  {formatTick(point.period_start, groupBy)}
                </text>
              ) : null,
            )}
            <path d={area} fill={`url(#${fillId})`} />
            <path
              d={line}
              fill="none"
              className="stroke-accent"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {markers &&
              points.map((point, index) => (
                <circle
                  key={trend[index].period_start}
                  cx={point.x}
                  cy={point.y}
                  r={2.5}
                  className="fill-bg stroke-accent"
                  strokeWidth={1.5}
                />
              ))}
            {active !== null && points[active] && (
              <g>
                <line
                  x1={points[active].x}
                  x2={points[active].x}
                  y1={PAD.top}
                  y2={base}
                  className="stroke-border-strong"
                  strokeDasharray="4 4"
                />
                <circle
                  cx={points[active].x}
                  cy={points[active].y}
                  r={5}
                  className="fill-accent stroke-bg"
                  strokeWidth={2}
                />
              </g>
            )}
          </svg>
        )}

        {shown && active !== null && (
          <div
            role="status"
            className="border-border bg-bg pointer-events-none absolute top-1 z-10 w-44 rounded-lg border px-3 py-2 shadow-lg"
            style={{
              // Beside the point, on whichever side has room.
              left:
                x(active) + 188 > width ? Math.max(0, x(active) - 188) : x(active) + 12,
            }}
          >
            <p className="text-text m-0 mb-1 text-[0.76rem] font-bold">
              {formatPointName(shown.period_start, groupBy)}
              {groupBy === 'day' && shown.period_start === today && (
                <span className="text-text-muted font-normal"> · today so far</span>
              )}
            </p>
            {(
              [
                ['Revenue', money(shown.revenue), 'revenue'],
                ['Orders', formatCount(shown.orders), 'orders'],
                ['Units', formatCount(shown.units_sold), 'units_sold'],
              ] as const
            ).map(([name, value, key]) => (
              <p
                key={key}
                className="text-text-muted m-0 flex items-center gap-1.5 text-[0.74rem]"
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    key === measure ? 'bg-accent' : 'bg-border-strong'
                  }`}
                />
                {name}
                <strong className="text-text ml-auto font-bold tabular-nums">
                  {value}
                </strong>
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="sr-only">
        <table>
          <caption>Sales over time</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Revenue</th>
              <th scope="col">Orders</th>
              <th scope="col">Units sold</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((point) => (
              <tr key={point.period_start}>
                <th scope="row">{formatPointName(point.period_start, groupBy)}</th>
                <td>{money(point.revenue)}</td>
                <td>{formatCount(point.orders)}</td>
                <td>{formatCount(point.units_sold)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
