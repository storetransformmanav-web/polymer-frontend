import { useId, useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { CopyButton } from './CopyButton.tsx'
import { ChevronDownIcon, ListChecksIcon, SpinnerIcon, type IconProps } from './icons.tsx'

interface DetailSectionProps {
  title: string
  count?: number
  icon: ComponentType<IconProps>
  defaultOpen?: boolean
  /**
   * Opens the card whenever this turns true (e.g. a problem appeared inside a
   * collapsed section). It never closes it again, and nothing inside is
   * remounted, so whatever the user has open or typed stays as it is.
   */
  forceOpen?: boolean
  children: ReactNode
}

/** Collapsible card used for each group of product information. */
export function DetailSection({
  title,
  count,
  icon: Icon,
  defaultOpen = true,
  forceOpen = false,
  children,
}: DetailSectionProps) {
  const [open, setOpen] = useState(defaultOpen || forceOpen)
  const [wasForced, setWasForced] = useState(forceOpen)
  // React's "adjust state while rendering" pattern: react to the flag turning on.
  if (forceOpen !== wasForced) {
    setWasForced(forceOpen)
    if (forceOpen) setOpen(true)
  }
  const bodyId = useId()

  return (
    <section className="border-border bg-bg rounded-xl border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
        className="text-text flex w-full cursor-pointer items-center gap-2.5 border-none bg-transparent px-5 py-4 text-left"
      >
        <Icon width={18} height={18} className="text-accent shrink-0" />
        <h3 className="text-[0.95rem] font-semibold">{title}</h3>
        {count !== undefined && (
          <span className="bg-surface text-text-muted border-border rounded-full border px-2 py-0.5 text-[0.68rem] font-bold">
            {count}
          </span>
        )}
        <ChevronDownIcon
          width={16}
          height={16}
          className={`text-text-muted ml-auto transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <div
        id={bodyId}
        inert={!open}
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-border border-t p-5">{children}</div>
        </div>
      </div>
    </section>
  )
}

/** Label + value grid for a DetailSection. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-5 min-[520px]:grid-cols-2 xl:grid-cols-3">
      {children}
    </dl>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-text-muted mb-1 text-[0.68rem] font-bold tracking-wide uppercase">
        {label}
      </dt>
      <dd className="text-[0.92rem] font-medium break-words">
        {children === null || children === undefined || children === '' ? (
          <span className="text-text-muted">—</span>
        ) : (
          children
        )}
      </dd>
    </div>
  )
}

// --- Pieces shared by the product and customer details panels -----------------

export const DETAIL_CARD = 'border-border bg-bg rounded-xl border'
export const DETAIL_TH =
  'text-text-muted border-border bg-accent-tint/60 border-b px-3.5 py-2.5 text-left text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase'
export const DETAIL_TD = 'px-3.5 py-2.5 text-[0.85rem] whitespace-nowrap'

/** Centered "nothing here" card for an empty tab. */
export function DetailEmpty({
  icon: Icon,
  children,
}: {
  icon: ComponentType<IconProps>
  children: ReactNode
}) {
  return (
    <div
      className={`${DETAIL_CARD} text-text-muted flex flex-col items-center gap-2 px-4 py-14 text-center text-[0.9rem]`}
    >
      <Icon width={28} height={28} />
      {children}
    </div>
  )
}

/** Bordered, horizontally scrollable table shell. */
export function DetailTable({ children }: { children: ReactNode }) {
  return (
    <div className={`${DETAIL_CARD} overflow-x-auto`}>
      <table className="w-full min-w-[640px] border-collapse">{children}</table>
    </div>
  )
}

/** Placeholder cards shown while a record's details are still loading. */
export function DetailSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      {[0, 1].map((n) => (
        <div key={n} className={`${DETAIL_CARD} flex flex-col gap-4 p-5`}>
          <div className="bg-border/70 h-5 w-48 animate-pulse rounded" />
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="bg-border/70 h-3 w-20 animate-pulse rounded" />
                <div className="bg-border/70 h-4 w-32 animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

interface RawJsonPanelProps {
  raw: Record<string, unknown> | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
}

/** The original Shopify payload as copyable JSON, with loading and error states. */
export function RawJsonPanel({ raw, isLoading, error, onRetry }: RawJsonPanelProps) {
  const json = useMemo(() => (raw ? JSON.stringify(raw, null, 2) : ''), [raw])

  if (error) {
    return (
      <DetailEmpty icon={ListChecksIcon}>
        <p className="text-text font-semibold">Couldn&apos;t load the raw data</p>
        <p>{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="border-border bg-bg text-text hover:border-accent mt-1 cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors"
        >
          Try again
        </button>
      </DetailEmpty>
    )
  }
  if (!raw) {
    return (
      <div
        role="status"
        className={`${DETAIL_CARD} text-text-muted flex items-center justify-center gap-2 px-4 py-14 text-[0.9rem]`}
      >
        {isLoading && <SpinnerIcon width={16} height={16} className="animate-spin" />}
        {isLoading ? 'Loading Shopify data…' : 'No raw data available.'}
      </div>
    )
  }

  return (
    <div className={DETAIL_CARD}>
      <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <p className="text-text-muted text-[0.78rem]">Original Shopify payload</p>
        <CopyButton value={json} label="Copy raw JSON" />
      </div>
      <pre className="max-h-[65svh] overflow-auto p-4 font-mono text-[0.78rem] leading-relaxed">
        {json}
      </pre>
    </div>
  )
}
