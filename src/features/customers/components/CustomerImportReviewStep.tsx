import type { ReactNode } from 'react'
import {
  BUTTON_PLAIN,
  BUTTON_PRIMARY,
  formatNumber,
} from '../../../components/ui/csvImport/importFormat.ts'
import { CountChips, ImportProblems } from '../../../components/ui/csvImport/importUi.tsx'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { InfoIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'
import type { ImportChoice } from '../../../hooks/useCsvImport.ts'
import type { ProductImportPlan } from '../../../lib/api/productImport.ts'
import type { CustomerImportSummary } from '../utils/importCsv.ts'

interface CustomerImportReviewStepProps {
  summary: CustomerImportSummary
  /** What the store's check (`dry_run`) answered. */
  plan: ProductImportPlan | null
  choice: ImportChoice
  shopLabel: string
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
 * The second screen, **Preview your first customer**: how many customers the file holds, what
 * the two choices will do, the first customer as it will look, and anything the store's check
 * reported (rows it will skip). Nothing has changed in the store yet — "Import customers"
 * starts the real import.
 */
export function CustomerImportReviewStep({
  summary,
  plan,
  choice,
  shopLabel,
  starting,
  error,
  onChooseAnother,
  onImport,
  onClose,
}: CustomerImportReviewStepProps) {
  const { first } = summary
  const dash = <span className="text-text-muted">—</span>

  return (
    <Dialog
      title="Preview your first customer"
      role="dialog"
      wide
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
            {starting ? 'Starting…' : 'Import customers'}
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
        <strong>{plural(summary.customers, 'customer')}</strong> into{' '}
        <strong>{shopLabel}</strong>
        {summary.subscribed > 0 && (
          <>
            , <strong>{formatNumber(summary.subscribed)}</strong> of them accepting email
            marketing
          </>
        )}
        .{' '}
        {choice.updateExisting && choice.createNew && (
          <>
            Importing will <strong>overwrite any existing customers</strong> that have the
            same email, and create the others.
          </>
        )}
        {choice.updateExisting && !choice.createNew && (
          <>
            Importing will <strong>overwrite the customers</strong> that already have
            these emails; emails that aren’t in the store yet are skipped.
          </>
        )}
        {!choice.updateExisting && choice.createNew && (
          <>
            Importing will <strong>create new customers only</strong>; customers that
            already have these emails are left as they are.
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
        <Row label="Name">{first.name || dash}</Row>
        <Row label="Email">{first.email || dash}</Row>
        <Row label="Phone">{first.phone || dash}</Row>
        <Row label="Email marketing">{first.marketing || dash}</Row>
        <Row label="Location">{first.location || dash}</Row>
        <Row label="Tags">{first.tags || dash}</Row>
        <Row label="Note">
          {first.note ? <span className="line-clamp-3">{first.note}</span> : dash}
        </Row>
      </dl>

      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
