import { useState, type ComponentType, type ReactNode } from 'react'
import { BADGE_TONE_CLASSES, type BadgeTone } from '../../../components/ui/badgeTones.ts'
import {
  AlertTriangleIcon,
  BoxesIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DatabaseIcon,
  FileTextIcon,
  GridIcon,
  ImageIcon,
  InfoIcon,
  InventoryIcon,
  LayersIcon,
  ListChecksIcon,
  PencilIcon,
  PoundIcon,
  SearchIcon,
  StoreIcon,
  TagIcon,
  UploadIcon,
  UsersIcon,
  type IconProps,
} from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import {
  PRODUCT_ACTIVITY_GROUPS,
  PRODUCT_ACTIVITY_SOURCES,
  type ProductActivityItem,
} from '../../../lib/api/endpoints.ts'
import { formatDate } from '../../../lib/format.ts'
import { formatStoreClockAmPm } from '../../../lib/storeTime.ts'
import { useProductActivity } from '../hooks/useProductActivity.ts'

const SKELETON_ROWS = 6

/** "price_change" → "Price change": a word the API sends, written for people. */
function humanize(value: string | null | undefined): string {
  const words = (value ?? '').replace(/[_-]+/g, ' ').trim().toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
}

/** Where a change was made: the sources the API names, in words (an unknown one as it is). */
function sourceLabel(source: string | null | undefined): string {
  switch ((source ?? '').toLowerCase()) {
    case 'crm':
      return 'CRM'
    case 'shopify':
      return 'Shopify'
    case 'csv_import':
      return 'CSV import'
    default:
      return humanize(source)
  }
}

const SOURCE_ICONS: Record<string, ComponentType<IconProps>> = {
  crm: DatabaseIcon,
  shopify: StoreIcon,
  csv_import: UploadIcon,
}

/** What a change did, in the past tense, for the actions the API names (another one as it is). */
function actionWord(action: string | null | undefined): string {
  switch ((action ?? '').toLowerCase()) {
    case 'update':
      return 'Updated'
    case 'create':
      return 'Created'
    case 'delete':
      return 'Deleted'
    default:
      return humanize(action)
  }
}

/** The icon of a kind of change (the API's own `field_group` values). */
const GROUP_ICONS: Record<string, ComponentType<IconProps>> = {
  title: PencilIcon,
  description: FileTextIcon,
  category: LayersIcon,
  tags: TagIcon,
  collections: LayersIcon,
  price: PoundIcon,
  variants: BoxesIcon,
  stock: InventoryIcon,
  images: ImageIcon,
  status: TagIcon,
  seo: SearchIcon,
  metafields: ListChecksIcon,
  options: GridIcon,
  other: InfoIcon,
}

/** A before / after value as plain text: nothing as a dash, yes / no as True / False, a list or object as JSON. */
function valueText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  try {
    return JSON.stringify(value) ?? '—'
  } catch {
    return '—'
  }
}

/**
 * The colour of a value's chip: true is green and false red, a product status its usual colour
 * (active green, draft amber, archived red), the value it was before grey and the one it became green.
 */
function valueTone(item: ProductActivityItem, value: unknown, isNew: boolean): BadgeTone {
  if (typeof value === 'boolean') return value ? 'success' : 'danger'
  if (typeof value === 'string' && item.field === 'status') {
    switch (value.toUpperCase()) {
      case 'ACTIVE':
        return 'success'
      case 'DRAFT':
        return 'warning'
      case 'ARCHIVED':
        return 'danger'
      default:
        return 'neutral'
    }
  }
  return isNew ? 'success' : 'neutral'
}

function ValueChip({
  item,
  value,
  isNew,
}: {
  item: ProductActivityItem
  value: unknown
  isNew: boolean
}) {
  const text = valueText(value)
  return (
    <span
      title={text}
      className={`inline-block max-w-[14rem] truncate rounded-lg px-3 py-1.5 text-[0.82rem] font-semibold ${
        BADGE_TONE_CLASSES[valueTone(item, value, isNew)]
      }`}
    >
      {text}
    </span>
  )
}

const GROUP_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Changes' },
  ...PRODUCT_ACTIVITY_GROUPS.map((value) => ({ value, label: humanize(value) })),
]
const SOURCE_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Sources' },
  ...PRODUCT_ACTIVITY_SOURCES.map((value) => ({ value, label: sourceLabel(value) })),
]

const changedBy = (item: ProductActivityItem) =>
  item.changed_by?.trim() || item.user?.full_name?.trim() || ''

/** One labelled fact of an opened record. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-text-muted text-[0.66rem] font-bold tracking-wide uppercase">
        {label}
      </dt>
      <dd className="m-0 mt-0.5 text-[0.82rem] font-medium break-words">
        {children || <span className="text-text-muted">—</span>}
      </dd>
    </div>
  )
}

/**
 * One recorded change as a row of the timeline: a dot on the line, the day and the time, and a card with
 * the icon and name of the change (and the variant), the field, **before → after** as coloured chips,
 * where it was made, who made it and a chevron that opens the rest — the kind of change, the store, the
 * variant, whether it was sent to the store and the whole values. Everything is the backend's text.
 */
function ActivityRow({ item }: { item: ProductActivityItem }) {
  const [open, setOpen] = useState(false)
  const Icon =
    (item.field === 'online_store'
      ? StoreIcon
      : GROUP_ICONS[(item.field_group ?? '').toLowerCase()]) ?? InfoIcon
  const SourceIcon = SOURCE_ICONS[(item.source ?? '').toLowerCase()] ?? DatabaseIcon
  const field = item.field_label || humanize(item.field)
  const title = [field, actionWord(item.action)].filter(Boolean).join(' ')
  const who = changedBy(item)
  const subtitle = [field, item.variant ? `Variant: ${String(item.variant)}` : '']
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="group relative flex items-start gap-4 pb-3.5 pl-7 last:pb-0">
      <span
        aria-hidden="true"
        className="bg-bg border-accent absolute top-5 left-0 z-[1] size-3.5 rounded-full border-[3px]"
      />
      <span
        aria-hidden="true"
        className="bg-border-strong absolute top-5 -bottom-3.5 left-[6px] w-px group-last:hidden"
      />

      <div className="w-28 shrink-0 pt-2.5">
        <p className="m-0 text-[0.85rem] leading-tight font-bold">
          {item.created_at ? formatDate(item.created_at) : '—'}
        </p>
        <p className="text-text-muted m-0 text-[0.74rem]">
          {formatStoreClockAmPm(item.created_at)}
        </p>
      </div>

      <div className="border-border bg-bg min-w-0 flex-1 rounded-xl border">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 lg:flex-nowrap">
          <div className="flex min-w-0 items-center gap-3 lg:w-64 lg:shrink-0">
            <span
              aria-hidden="true"
              className="bg-accent-tint text-accent flex size-10 shrink-0 items-center justify-center rounded-xl"
            >
              <Icon width={19} height={19} />
            </span>
            <div className="min-w-0">
              <p
                className="m-0 truncate text-[0.9rem] leading-snug font-bold"
                title={title}
              >
                {title || '—'}
              </p>
              {subtitle && (
                <p
                  className="text-text-muted m-0 truncate text-[0.76rem] leading-snug"
                  title={subtitle}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="border-border flex min-w-0 flex-1 flex-wrap items-center gap-3 lg:border-l lg:pl-5">
            <ValueChip item={item} value={item.old_value} isNew={false} />
            <ChevronRightIcon
              width={15}
              height={15}
              className="text-text-muted shrink-0"
              aria-hidden="true"
            />
            <ValueChip item={item} value={item.new_value} isNew />
          </div>

          <span className="bg-surface text-text border-border inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-[0.8rem] font-semibold">
            <SourceIcon
              width={15}
              height={15}
              className="text-text-muted"
              aria-hidden="true"
            />
            {sourceLabel(item.source) || '—'}
          </span>

          <span className="border-border flex min-w-0 items-center gap-2 text-[0.84rem] lg:w-36 lg:shrink-0 lg:border-l lg:pl-5">
            <UsersIcon
              width={16}
              height={16}
              className="text-text-muted shrink-0"
              aria-hidden="true"
            />
            <span className="truncate" title={who}>
              {who || '—'}
            </span>
          </span>

          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? 'Hide' : 'Show'} details of ${title}`}
            onClick={() => setOpen(!open)}
            className="text-text-muted hover:text-text ml-auto flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent"
          >
            <ChevronDownIcon
              width={17}
              height={17}
              className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {open && (
          <dl className="border-border m-0 grid grid-cols-2 gap-x-6 gap-y-3 border-t px-4 py-3 md:grid-cols-4">
            <Fact label="Kind of change">{humanize(item.field_group)}</Fact>
            <Fact label="Field">{item.field}</Fact>
            <Fact label="Variant">{item.variant ? String(item.variant) : ''}</Fact>
            <Fact label="Sent to store">{humanize(item.push_status)}</Fact>
            <Fact label="Changed by">{who}</Fact>
            <Fact label="Source">{sourceLabel(item.source)}</Fact>
            <div className="col-span-2 min-w-0 md:col-span-2">
              <dt className="text-text-muted text-[0.66rem] font-bold tracking-wide uppercase">
                Before
              </dt>
              <dd className="m-0 mt-0.5 text-[0.82rem] break-words whitespace-pre-wrap">
                {valueText(item.old_value)}
              </dd>
            </div>
            <div className="col-span-2 min-w-0 md:col-span-2">
              <dt className="text-text-muted text-[0.66rem] font-bold tracking-wide uppercase">
                After
              </dt>
              <dd className="m-0 mt-0.5 text-[0.82rem] font-semibold break-words whitespace-pre-wrap">
                {valueText(item.new_value)}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </li>
  )
}

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="text-text-muted flex flex-col items-center gap-3 px-4 py-14 text-center text-[0.9rem]">
      {children}
    </div>
  )
}

const MESSAGE_BUTTON =
  'border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors'

/**
 * A product's **Activity** tab (after the shared reference design): a bar with the **Change Group** and
 * **Source** filters and Reset, and under it a timeline of everything recorded for the product, newest
 * first — `GET /products/{id}/activity`, filtered and paged by the server — with the products list's own
 * pagination at the foot. There is no search box and no Export, because the API has neither. Nothing is
 * written in the app: every name, value and status is the backend's, and shown as text.
 */
export function ProductActivityPanel({
  productId,
  shop,
}: {
  /** The product's CRM id (UUID). */
  productId: string
  /** The product's store key. */
  shop?: string
}) {
  const activity = useProductActivity(productId, shop, true)
  const { filters, data, items } = activity

  let body: ReactNode
  if (activity.error) {
    body = (
      <Message>
        <AlertTriangleIcon width={28} height={28} className="text-danger" />
        <div>
          <p className="text-text font-semibold">Couldn&apos;t load activity</p>
          <p>{activity.error}</p>
        </div>
        <button type="button" className={MESSAGE_BUTTON} onClick={activity.retry}>
          Try again
        </button>
      </Message>
    )
  } else if (!activity.isPending && items.length === 0) {
    body = (
      <Message>
        <SearchIcon width={28} height={28} />
        <div>
          <p className="text-text font-semibold">No activity found</p>
          <p>
            {activity.hasFilters
              ? 'Nothing matches the current filters.'
              : 'Nothing has been recorded for this product yet.'}
          </p>
        </div>
        {activity.hasFilters && (
          <button
            type="button"
            className={MESSAGE_BUTTON}
            onClick={activity.resetFilters}
          >
            Clear all filters
          </button>
        )}
      </Message>
    )
  } else {
    body = (
      <ol
        aria-busy={activity.isPending || activity.isShowingPrevious}
        className={`m-0 list-none p-5 transition-opacity duration-150 lg:min-h-0 lg:flex-1 lg:overflow-y-auto ${
          activity.isShowingPrevious ? 'opacity-60' : ''
        }`}
      >
        {activity.isPending && (
          <li role="status" className="sr-only">
            Loading activity…
          </li>
        )}
        {activity.isPending
          ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <li
                key={index}
                aria-hidden="true"
                className="border-border bg-surface mb-2.5 ml-6 h-14 animate-pulse rounded-xl border"
              />
            ))
          : items.map((item) => <ActivityRow key={item.id} item={item} />)}
      </ol>
    )
  }

  return (
    <div className="flex flex-col lg:min-h-0 lg:flex-1">
      <section
        aria-label="Product activity"
        className="border-border bg-bg relative flex flex-col overflow-hidden rounded-2xl border lg:min-h-0 lg:flex-1"
      >
        {/* Thin activity bar: results stay on screen while a refresh runs. */}
        <div
          aria-hidden="true"
          className={`bg-accent absolute inset-x-0 top-0 z-[2] h-0.5 origin-left transition-opacity duration-200 ${
            activity.isFetching && !activity.isPending
              ? 'animate-pulse opacity-100'
              : 'opacity-0'
          }`}
        />
        <div className="border-border flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2.5">
          <h3 className="m-0 text-[0.95rem] font-semibold">
            {data ? data.total.toLocaleString('en-GB') : '—'} Activity{' '}
            {data?.total === 1 ? 'Record' : 'Records'}
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-64">
              <SelectField
                compact
                inline
                id="product-activity-group"
                label="Change Group"
                value={filters.group}
                options={GROUP_OPTIONS}
                onChange={(group) => activity.setFilters({ group })}
              />
            </div>
            <div className="w-56">
              <SelectField
                compact
                inline
                id="product-activity-source"
                label="Source"
                value={filters.source}
                options={SOURCE_OPTIONS}
                onChange={(source) => activity.setFilters({ source })}
              />
            </div>
          </div>
        </div>
        {body}
        {data && data.total > 0 && (
          <PaginationFooter
            page={data.page}
            pageSize={filters.pageSize}
            total={data.total}
            totalPages={data.total_pages}
            onPageChange={(page) => activity.setFilters({ page })}
            onPageSizeChange={(pageSize) => activity.setFilters({ pageSize })}
          />
        )}
      </section>
    </div>
  )
}
