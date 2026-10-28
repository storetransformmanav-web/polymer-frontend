import type { ReactNode } from 'react'
import { Dialog } from '../../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../../components/ui/FormMessage.tsx'
import { InfoIcon, SpinnerIcon } from '../../../../components/ui/icons.tsx'
import { formatPrice } from '../../../../lib/format.ts'
import type { ProductImportPlan } from '../../../../lib/api/productImport.ts'
import type { ImportChoice } from '../../hooks/useProductsImport.ts'
import type { ImportSummary } from '../../utils/importCsv.ts'
import { CountChips, ImportProblems } from './importUi.tsx'
import { BUTTON_PLAIN, BUTTON_PRIMARY, formatNumber } from './importFormat.ts'

/** How many variants the preview table lists before "and N more". */
const VARIANTS_SHOWN = 8

interface ImportReviewStepProps {
  summary: ImportSummary
  /** What the store's check (`dry_run`) answered. */
  plan: ProductImportPlan | null
  choice: ImportChoice
  shopLabel: string
  /** The store's currency, for the prices ("£24.90"); null when it isn't known. */
  currency: string | null
  /** The import is being started. */
  starting: boolean
  /** The backend's message when starting failed. */
  error: string | null
  onChooseAnother: () => void
  onImport: () => void
  onClose: () => void
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${formatNumber(count)} ${count === 1 ? one : many}`

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-border grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 border-b py-3.5 last:border-b-0">
      <dt className="text-text text-[0.85rem] font-semibold">{label}</dt>
      <dd className="text-text min-w-0 text-[0.85rem] break-words">{children}</dd>
    </div>
  )
}

/**
 * The second screen, **Preview your first product**: what the file holds (products, variants,
 * images, and what the two choices will do), the first product as it will look, its variants
 * in a table, and anything the store's check reported (rows it will skip). Nothing has changed
 * in the store yet — "Import products" starts the real import.
 */
export function ImportReviewStep({
  summary,
  plan,
  choice,
  shopLabel,
  currency,
  starting,
  error,
  onChooseAnother,
  onImport,
  onClose,
}: ImportReviewStepProps) {
  const { first } = summary
  const shown = first.variants.slice(0, VARIANTS_SHOWN)
  const more = first.variants.length - shown.length
  const dash = <span className="text-text-muted">—</span>

  return (
    <Dialog
      title="Preview your first product"
      role="dialog"
      extraWide
      closeButton
      onClose={onClose}
      closeDisabled={starting}
      footer={
        <>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            disabled={starting}
            className={BUTTON_PLAIN}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={starting}
            className={BUTTON_PRIMARY}
          >
            {starting && <SpinnerIcon width={14} height={14} className="animate-spin" />}
            {starting ? 'Starting…' : 'Import products'}
          </button>
        </>
      }
    >
      <div className="bg-accent-tint text-text flex items-start gap-3 rounded-xl px-4 py-3 text-[0.85rem]">
        <InfoIcon width={18} height={18} className="text-accent mt-px shrink-0" />
        <p>
          You’re importing a file into <strong>{shopLabel}</strong>. If this preview
          doesn’t look right, check that the column headings in your CSV match Shopify’s
          template, or{' '}
          <button
            type="button"
            onClick={onChooseAnother}
            disabled={starting}
            className="text-accent hover:text-accent-hover cursor-pointer border-none bg-transparent p-0 font-medium underline disabled:opacity-50"
          >
            choose a different file
          </button>
          .
        </p>
      </div>

      <p className="text-text text-[0.88rem]">
        You will be importing approximately{' '}
        <strong>{plural(summary.products, 'product')}</strong> with a total of{' '}
        <strong>{plural(summary.variants, 'variant')}</strong> and{' '}
        <strong>{plural(summary.images, 'image')}</strong> into{' '}
        <strong>{shopLabel}</strong>.{' '}
        {choice.updateExisting && choice.createNew && (
          <>
            Importing will <strong>overwrite any existing products</strong> that have the
            same product handle, and create the others.
          </>
        )}
        {choice.updateExisting && !choice.createNew && (
          <>
            Importing will <strong>overwrite the products</strong> that already have these
            handles; handles that aren’t in the store yet are skipped.
          </>
        )}
        {!choice.updateExisting && choice.createNew && (
          <>
            Importing will <strong>create new products only</strong>; products that
            already have these handles are left as they are.
          </>
        )}
      </p>

      {plan && plan.problems.length > 0 && (
        <ImportProblems
          title={`${plural(plan.problems.length, 'row')} had a problem and will be skipped`}
          problems={plan.problems}
        />
      )}
      {plan && <CountChips counts={plan.counts} />}
      {plan?.message && <p className="text-[0.8rem]">{plan.message}</p>}

      <dl className="border-border bg-surface/50 rounded-xl border px-5">
        <Row label="Title">{first.title || dash}</Row>
        <Row label="Description">
          {first.description ? (
            <span className="line-clamp-3">{first.description}</span>
          ) : (
            dash
          )}
        </Row>
        <Row label="Product Status">{first.status || dash}</Row>
        <Row label="Product Category">{first.category || dash}</Row>
        <Row label="Product Type">{first.type || dash}</Row>
        <Row label="Vendor">{first.vendor || dash}</Row>
      </dl>

      {first.variants.length > 0 && (
        <div className="border-border overflow-x-auto rounded-xl border p-2">
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr className="bg-surface text-text-muted">
                <th className="rounded-l-lg px-3 py-2 text-left font-medium">Variant</th>
                <th className="px-3 py-2 text-left font-medium">SKU</th>
                <th className="px-3 py-2 text-left font-medium">Weight</th>
                <th className="rounded-r-lg px-3 py-2 text-right font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((variant, index) => (
                <tr key={`${variant.sku}-${index}`} className="text-text">
                  <td className="border-border border-b px-3 py-2.5">{variant.label}</td>
                  <td className="border-border border-b px-3 py-2.5">
                    {variant.sku || dash}
                  </td>
                  <td className="border-border border-b px-3 py-2.5">
                    {variant.weight || dash}
                  </td>
                  <td className="border-border border-b px-3 py-2.5 text-right">
                    {variant.price
                      ? currency
                        ? formatPrice(variant.price, currency)
                        : variant.price
                      : dash}
                  </td>
                </tr>
              ))}
              {more > 0 && (
                <tr className="text-text-muted">
                  <td colSpan={4} className="px-3 py-2.5">
                    and {plural(more, 'more variant')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
