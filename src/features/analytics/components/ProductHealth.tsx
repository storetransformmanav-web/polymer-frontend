import { InfoTip } from '../../../components/ui/InfoTip.tsx'
import { InfoIcon, ProductsIcon } from '../../../components/ui/icons.tsx'
import type { SalesOverview } from '../../../lib/api/salesOverview.ts'
import { formatCount } from '../utils/format.ts'
import { CARD, CardTitle } from './AnalyticsCard.tsx'

const LEVELS = [
  { key: 'top', label: 'Top (strong sellers)', fill: 'bg-accent' },
  { key: 'good', label: 'Good (steady sales)', fill: 'bg-accent/45' },
  { key: 'low', label: 'Low (few sales)', fill: 'bg-warning/75' },
  { key: 'none', label: 'No sales', fill: 'bg-text-muted/25' },
] as const

const EXPLANATION =
  'How each store’s products sold in this period: the best of those that sold are Top, the lowest are Low, the rest are Good, and products with nothing sold are No sales. Cancelled and test orders are left out.'

/** How the catalogue split by sales level: one bar and, under it, each level's count. */
export function ProductHealth({ overview }: { overview: SalesOverview }) {
  const { levels } = overview
  const total = LEVELS.reduce((sum, level) => sum + levels[level.key], 0)

  return (
    <section
      aria-label="Product sales health"
      className={`${CARD} flex min-w-0 flex-col gap-3 p-4`}
    >
      <CardTitle
        icon={ProductsIcon}
        title="Product sales health"
        note={`Performance of ${formatCount(total)} products`}
      >
        <InfoTip label="Product sales health" text={EXPLANATION} />
      </CardTitle>

      <div
        aria-hidden="true"
        className="flex h-5 shrink-0 gap-0.5 overflow-hidden rounded-md"
      >
        {total === 0 ? (
          <span className="bg-surface h-full w-full" />
        ) : (
          LEVELS.filter((level) => levels[level.key] > 0).map((level) => (
            <span
              key={level.key}
              title={`${level.label}: ${formatCount(levels[level.key])}`}
              className={`h-full min-w-1 ${level.fill}`}
              style={{ flexGrow: levels[level.key], flexBasis: 0 }}
            />
          ))
        )}
      </div>

      <dl className="m-0 flex flex-col">
        {LEVELS.map((level) => (
          <div
            key={level.key}
            className="border-border flex items-center gap-2.5 border-b py-1 text-[0.8rem] last:border-b-0"
          >
            <span
              aria-hidden="true"
              className={`h-3 w-3 shrink-0 rounded-[3px] ${level.fill}`}
            />
            <dt className="text-text min-w-0">{level.label}</dt>
            <dd className="text-text m-0 ml-auto font-bold tabular-nums">
              {formatCount(levels[level.key])}
            </dd>
          </div>
        ))}
      </dl>

      {typeof levels.none_active === 'number' && (
        <p className="bg-accent-tint/70 text-text m-0 mt-auto flex items-start gap-2 rounded-lg px-3 py-2 text-[0.78rem]">
          <InfoIcon width={16} height={16} className="text-accent mt-px shrink-0" />
          <span>
            <strong className="font-bold">{formatCount(levels.none_active)}</strong>{' '}
            active products with no sales
          </span>
        </p>
      )}
    </section>
  )
}
