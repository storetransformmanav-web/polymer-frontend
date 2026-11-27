import { InAppBar } from '../../../components/ui/AppBarSlot.tsx'
import { ExportButton } from '../../../components/ui/ExportControls.tsx'
import { HeaderRefresh } from '../../../components/ui/HeaderRefresh.tsx'
import { csvFile } from '../../../lib/csv.ts'
import { downloadBlob } from '../../../lib/download.ts'
import { CARD } from '../components/AnalyticsCard.tsx'
import { AnalyticsKpis } from '../components/AnalyticsKpis.tsx'
import { AnalyticsToolbar } from '../components/AnalyticsToolbar.tsx'
import { ProductHealth } from '../components/ProductHealth.tsx'
import { SalesChart } from '../components/SalesChart.tsx'
import { SalesLists } from '../components/SalesLists.tsx'
import { useSalesOverview } from '../hooks/useSalesOverview.ts'
import { buildSalesReportCsv, salesReportFilename } from '../utils/exportCsv.ts'

function Skeleton() {
  const block = `${CARD} bg-surface animate-pulse`
  return (
    <div role="status" aria-label="Loading analytics" className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className={`${block} h-72`} />
        <div className={`${block} h-72`} />
      </div>
      <div className={`${block} h-64`} />
    </div>
  )
}

/** Analytics → product performance: how the products sold in a period (`/analytics`). */
export function AnalyticsPage() {
  const {
    range,
    setRange,
    problem,
    params,
    shop,
    overview,
    isFetching,
    isShowingPrevious,
    error,
    retry,
  } = useSalesOverview()

  return (
    <div className="relative flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:*:shrink-0">
      <h1 className="sr-only">Analytics: product performance</h1>
      <HeaderRefresh refreshing={isFetching} onRefresh={retry} />
      {/* Export sits in the top bar, as on the Products page. */}
      <InAppBar>
        <ExportButton
          opensDialog={false}
          disabled={!overview || isShowingPrevious}
          onClick={() => {
            if (!overview) return
            downloadBlob(
              salesReportFilename(shop),
              csvFile(buildSalesReportCsv(overview), 'excel'),
            )
          }}
        />
      </InAppBar>

      <AnalyticsKpis overview={overview} />
      <AnalyticsToolbar range={range} period={overview?.period} onChange={setRange} />

      {problem && (
        <p role="alert" className="text-danger m-0 text-[0.85rem]">
          {problem}
        </p>
      )}

      {error && (
        <div
          role="alert"
          className={`${CARD} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}
        >
          <span className="text-danger text-[0.85rem]">{error}</span>
          <button
            type="button"
            onClick={retry}
            className="border-border text-text hover:border-accent hover:text-accent cursor-pointer rounded-lg border bg-transparent px-3 py-1.5 text-[0.82rem] font-semibold"
          >
            Try again
          </button>
        </div>
      )}

      {overview ? (
        <div
          aria-busy={isShowingPrevious}
          className={`flex flex-col gap-3 transition-opacity lg:flex-[1_0_auto] ${
            isShowingPrevious ? 'opacity-60' : ''
          }`}
        >
          <div className="grid gap-3 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_21rem]">
            <SalesChart overview={overview} />
            <ProductHealth overview={overview} />
          </div>
          {/* A new period or store starts the lists short again. */}
          <SalesLists key={JSON.stringify(params)} overview={overview} params={params} />
        </div>
      ) : (
        !error && !problem && <Skeleton />
      )}
    </div>
  )
}
