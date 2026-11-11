import { useId, useMemo, useState, type ComponentType } from 'react'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { DETAIL_CARD, DetailEmpty } from '../../../components/ui/DetailSection.tsx'
import {
  ChevronDownIcon,
  CheckCircleIcon,
  CodeIcon,
  FilterIcon,
  LayersIcon,
  ListChecksIcon,
  SearchIcon,
  TagIcon,
  type IconProps,
} from '../../../components/ui/icons.tsx'
import { SELECT_THEME } from '../../../components/ui/SelectField.tsx'
import type { CustomerDetail } from '../../../lib/api/endpoints.ts'
import { humanize } from '../utils/format.ts'

type Metafield = CustomerDetail['metafields'][number]
type Kind = 'text' | 'boolean' | 'number' | 'json' | 'other'

const KINDS: { id: Kind; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'boolean', label: 'Boolean' },
  { id: 'number', label: 'Number' },
  { id: 'json', label: 'JSON' },
  { id: 'other', label: 'Other' },
]

/** Shopify's metafield type name → one of the few groups the table shows. */
function kindOf(type: string | null | undefined): Kind {
  const value = (type ?? '').toLowerCase()
  if (value === 'boolean') return 'boolean'
  if (value === 'json' || value === 'json_string' || value.startsWith('list.'))
    return 'json'
  if (value.startsWith('number_') || value === 'rating') return 'number'
  if (value.includes('text') || value === 'url' || value === 'color') return 'text'
  return 'other'
}

const KIND_ICON: Record<Kind, ComponentType<IconProps>> = {
  text: TagIcon,
  boolean: CheckCircleIcon,
  number: ListChecksIcon,
  json: CodeIcon,
  other: LayersIcon,
}

const PILL =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.78rem] font-semibold whitespace-nowrap'

/** The type shown as a small pill: "Aa Text", "# Number", "{} JSON", "Boolean". */
function TypePill({ kind, type }: { kind: Kind; type: string | null | undefined }) {
  if (kind === 'boolean') {
    return (
      <span className={`${PILL} border-border bg-bg text-text`}>
        <CheckCircleIcon width={14} height={14} className="text-accent" />
        Boolean
      </span>
    )
  }
  if (kind === 'json') {
    return (
      <span className={`${PILL} border-border bg-accent-tint/60 text-text`}>
        <span aria-hidden="true" className="font-mono">
          {'{}'}
        </span>
        JSON
      </span>
    )
  }
  const label = kind === 'other' ? humanize(type) || 'Other' : kindLabel(kind)
  return (
    <span className={`${PILL} border-border bg-bg text-text`}>
      <span aria-hidden="true" className="text-text-muted font-mono">
        {kind === 'number' ? '#' : kind === 'text' ? 'Aa' : ''}
      </span>
      {label}
    </span>
  )
}

const kindLabel = (kind: Kind) => KINDS.find((item) => item.id === kind)?.label ?? 'Other'

/** A JSON value on one line, with spaces after the colons and commas: `{ "a": 1, "b": 2 }`. */
function oneLineJson(value: string): string {
  try {
    const text = JSON.stringify(JSON.parse(value))
    return text
      .replace(/([,:])(?=\S)/g, '$1 ')
      .replace(/^([[{])(?=\S)/, '$1 ')
      .replace(/(\S)([\]}])$/, '$1 $2')
  } catch {
    return value
  }
}

function prettyJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function ValueCell({ field, kind }: { field: Metafield; kind: Kind }) {
  const [expanded, setExpanded] = useState(false)
  const value = field.value ?? ''

  if (!value) return <span className="text-text-muted">—</span>

  if (kind === 'boolean') {
    const on = value.toLowerCase() === 'true'
    return (
      <span
        className={`${PILL} ${
          on
            ? 'border-accent/30 bg-accent-tint text-accent'
            : 'border-border bg-surface text-text-muted'
        }`}
      >
        {on ? 'True' : 'False'}
      </span>
    )
  }

  if (kind === 'json') {
    return (
      <div className="bg-surface border-border flex min-w-0 items-start gap-2 rounded-lg border px-3 py-1.5 font-mono text-[0.8rem]">
        {expanded ? (
          <pre className="m-0 min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap">
            {prettyJson(value)}
          </pre>
        ) : (
          <span className="min-w-0 flex-1 truncate" title={value}>
            {oneLineJson(value)}
          </span>
        )}
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${field.namespace}.${field.key}`}
          onClick={() => setExpanded((open) => !open)}
          className="text-text-muted hover:text-accent flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0"
        >
          <ChevronDownIcon
            width={14}
            height={14}
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
    )
  }

  return (
    <span className="block truncate" title={value}>
      {value}
    </span>
  )
}

/**
 * The customer's metafields: a card with a heading, a search box and a type filter, then a table
 * of field (with a small icon for its type), type pill and value — booleans as True / False pills,
 * JSON on one line in a box that opens to the full value — each with a copy button.
 */
export function CustomerMetafieldsPanel({ customer }: { customer: CustomerDetail }) {
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<Kind | 'all'>('all')
  const searchId = useId()
  const fields = customer.metafields

  const rows = useMemo(() => {
    const text = search.trim().toLowerCase()
    return fields
      .map((field) => ({ field, kind: kindOf(field.type) }))
      .filter(
        (row) =>
          (kind === 'all' || row.kind === kind) &&
          (!text ||
            `${row.field.namespace}.${row.field.key}`.toLowerCase().includes(text) ||
            (row.field.value ?? '').toLowerCase().includes(text)),
      )
  }, [fields, search, kind])

  if (fields.length === 0) {
    return <DetailEmpty icon={ListChecksIcon}>No metafields.</DetailEmpty>
  }

  return (
    <section className={`${DETAIL_CARD} flex flex-col gap-5 p-4 sm:p-5`}>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden="true"
            className="bg-accent-tint text-accent flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
          >
            <LayersIcon width={24} height={24} />
          </span>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              Metafields
              <span className="bg-accent-tint text-accent rounded-full px-2 py-0.5 text-[0.72rem] font-bold">
                {fields.length}
              </span>
            </h2>
            <p className="text-text-muted m-0 text-[0.85rem]">
              Custom data and additional attributes for this customer.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label
            htmlFor={searchId}
            className="border-border bg-bg focus-within:border-accent flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 sm:w-64 sm:flex-none"
          >
            <SearchIcon width={16} height={16} className="text-text-muted shrink-0" />
            <input
              id={searchId}
              type="search"
              value={search}
              maxLength={100}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search metafields…"
              aria-label="Search metafields"
              className="text-text min-w-0 flex-1 border-none bg-transparent text-[0.85rem] outline-none"
            />
          </label>
          <label className="border-border bg-bg focus-within:border-accent relative flex h-10 items-center gap-2 rounded-lg border pr-8 pl-3">
            <FilterIcon width={16} height={16} className="text-text-muted shrink-0" />
            <select
              value={kind}
              aria-label="Filter by type"
              onChange={(event) => setKind(event.target.value as Kind | 'all')}
              className={`text-text h-full min-w-28 cursor-pointer appearance-none border-none bg-transparent pr-2 text-[0.85rem] font-semibold outline-none ${SELECT_THEME}`}
            >
              <option value="all">All Types</option>
              {KINDS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <ChevronDownIcon
              width={14}
              height={14}
              className="text-text-muted pointer-events-none absolute right-3"
            />
          </label>
        </div>
      </header>

      <div className="border-border-strong overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[760px] border-collapse text-[0.85rem]">
          <thead>
            <tr>
              <th className={`${TH} w-[34%] pl-5`}>Field</th>
              <th className={`${TH} w-[16%]`}>Type</th>
              <th className={TH}>Value</th>
              <th className={`${TH} w-14`}>
                <span className="sr-only">Copy</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-text-muted px-4 py-10 text-center">
                  No metafields match.
                </td>
              </tr>
            ) : (
              rows.map(({ field, kind: rowKind }) => {
                const name = `${field.namespace}.${field.key}`
                const Icon = KIND_ICON[rowKind]
                return (
                  <tr
                    key={name}
                    className="border-border even:bg-surface hover:bg-accent-tint/60 border-b align-middle transition-colors last:border-b-0"
                  >
                    <td className="px-4 py-3 pl-5">
                      <span className="flex min-w-0 items-center gap-3">
                        {rowKind === 'number' ? (
                          <span
                            aria-hidden="true"
                            className="text-accent flex w-[18px] shrink-0 justify-center text-[1.05rem] font-bold"
                          >
                            #
                          </span>
                        ) : (
                          <Icon width={18} height={18} className="text-accent shrink-0" />
                        )}
                        <span className="truncate font-semibold" title={name}>
                          {name}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <TypePill kind={rowKind} type={field.type} />
                    </td>
                    <td className="max-w-0 px-4 py-3">
                      <ValueCell field={field} kind={rowKind} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex h-5 items-center">
                        <CopyButton value={field.value ?? ''} label={`Copy ${name}`} />
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const TH =
  'text-text border-border-strong bg-table-head border-b px-4 py-3 text-left text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase'
