import { PlusIcon, TrashIcon } from '../../../../components/ui/icons.tsx'
import { SelectField } from '../../../../components/ui/SelectField.tsx'
import type { ProductVariant } from '../../../../lib/api/endpoints.ts'
import type { StockLocationChoice } from '../../hooks/useProductStockLocations.ts'
import {
  blankStockRow,
  type DraftErrors,
  type StockRowDraft,
} from '../../utils/editDraft.ts'
import { FIELD_INPUT, TEXT_BUTTON } from './fields.tsx'

/** The location / quantity grid (the quantity column is narrower on phones), as in Add product. */
const STOCK_GRID =
  'grid grid-cols-[minmax(0,1fr)_7rem_2rem] gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_2rem]'

/**
 * With the store's figures beside it (the Inventory card of a variant): Location · Unavailable ·
 * Committed · Available · On hand · remove. The three read-only figures are hidden on phones.
 */
const LEVEL_GRID =
  'grid grid-cols-[minmax(0,1fr)_6rem_2rem] gap-3 sm:grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_6.5rem_4.5rem_2rem]'

type Levels = ProductVariant['inventory_levels']

const FIGURE = 'hidden text-right text-[0.85rem] tabular-nums sm:block'
const count = (value: number) => value.toLocaleString('en-GB')

/**
 * What the store says about one location, plus what "On hand" becomes with the quantity typed:
 * on hand = available + committed + unavailable, and unavailable is what is left of the store's
 * own on-hand figure after the available and committed units.
 */
function figures(row: StockRowDraft, levels: Levels) {
  const level =
    row.originalLocationId === ''
      ? undefined
      : levels.find((item) => String(item.location_shopify_id) === row.originalLocationId)
  const committed = level?.committed ?? 0
  const unavailable =
    level && level.on_hand != null && level.available != null
      ? Math.max(0, level.on_hand - level.available - committed)
      : 0
  const typed = row.available.trim() === '' ? null : Number(row.available)
  const available = typed !== null && Number.isInteger(typed) ? typed : null
  const onHand =
    available !== null ? available + committed + unavailable : (level?.on_hand ?? null)
  return { committed, unavailable, onHand }
}

/**
 * A variant's stock as a Location / Quantity table, drawn like the Inventory card of Add product:
 * each row is a dropdown of the store's locations and a quantity. Rows can be added for more
 * locations; a row added here can be removed again. With no known location the dropdown is the
 * plain Shopify location number box, so stock can still be set.
 *
 * Given `levels` (the variant's stock as the store reports it) it also shows, for every location,
 * the Unavailable, Committed and On hand figures beside the Available quantity that is edited —
 * like the store admin's Inventory card.
 */
export function StockFields({
  rows,
  onChange,
  locations,
  errors,
  prefix,
  label,
  levels,
}: {
  rows: StockRowDraft[]
  onChange: (rows: StockRowDraft[]) => void
  locations: StockLocationChoice[]
  errors: DraftErrors
  /** The error keys' start: `<prefix>.<row>.location` / `.quantity`. */
  prefix: string
  /** What the table is about, for assistive technology ("Stock of Medium"). */
  label: string
  /** The store's own figures for this variant: switches the extra read-only columns on. */
  levels?: Levels
}) {
  const patch = (index: number, change: Partial<StockRowDraft>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...change } : row)))
  const grid = levels ? LEVEL_GRID : STOCK_GRID

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="border-border overflow-hidden rounded-xl border">
        <div
          className={`${grid} bg-surface text-text-muted items-center px-3 py-2 text-[0.76rem] font-semibold`}
        >
          <span>{levels ? 'Locations' : 'Location'}</span>
          {levels && <span className="hidden text-right sm:block">Unavailable</span>}
          {levels && <span className="hidden text-right sm:block">Committed</span>}
          <span className="text-right">{levels ? 'Available' : 'Quantity'}</span>
          {levels && <span className="hidden text-right sm:block">On hand</span>}
          <span />
        </div>
        {rows.length === 0 ? (
          <p className="text-text-muted p-3 text-[0.82rem]">
            No stock is recorded for {label}. Add a location to set a quantity.
          </p>
        ) : (
          <ul aria-label={label}>
            {rows.map((row, index) => {
              const location = errors[`${prefix}.${index}.location`]
              const quantity = errors[`${prefix}.${index}.quantity`]
              const added = row.originalLocationId === ''
              const shown = levels ? figures(row, levels) : null
              return (
                <li
                  key={row.key}
                  className={`${grid} border-border items-start border-t p-3 first:border-t-0`}
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    {locations.length > 0 ? (
                      <SelectField
                        hideLabel
                        id={`${prefix}-${row.key}-location`}
                        label={`Stock location ${index + 1}`}
                        value={row.locationId}
                        options={[
                          { value: '', label: 'Choose a location' },
                          ...locations.map((choice) => ({
                            value: choice.id,
                            label: choice.name,
                          })),
                        ]}
                        onChange={(locationId) => patch(index, { locationId })}
                      />
                    ) : (
                      <>
                        <label
                          htmlFor={`${prefix}-${row.key}-location`}
                          className="sr-only"
                        >
                          {`Stock location ${index + 1}`}
                        </label>
                        <input
                          id={`${prefix}-${row.key}-location`}
                          inputMode="numeric"
                          autoComplete="off"
                          value={row.locationId}
                          placeholder="Shopify location ID, e.g. 72843812"
                          aria-invalid={location ? true : undefined}
                          onChange={(event) =>
                            patch(index, {
                              locationId: event.target.value.replace(/\D/g, ''),
                            })
                          }
                          className={FIELD_INPUT}
                        />
                      </>
                    )}
                    {location && (
                      <p role="alert" className="text-danger text-[0.76rem]">
                        {location}
                      </p>
                    )}
                  </div>
                  {shown && (
                    <span className={`${FIGURE} pt-2.5`}>{count(shown.unavailable)}</span>
                  )}
                  {shown && (
                    <span className={`${FIGURE} pt-2.5`}>{count(shown.committed)}</span>
                  )}
                  <div className="flex min-w-0 flex-col gap-1">
                    <label htmlFor={`${prefix}-${row.key}-quantity`} className="sr-only">
                      {`Stock quantity ${index + 1}`}
                    </label>
                    <input
                      id={`${prefix}-${row.key}-quantity`}
                      inputMode="numeric"
                      autoComplete="off"
                      value={row.available}
                      placeholder="0"
                      aria-invalid={quantity ? true : undefined}
                      onChange={(event) =>
                        patch(index, { available: event.target.value })
                      }
                      className={`${FIELD_INPUT} text-right`}
                    />
                    {quantity && (
                      <p role="alert" className="text-danger text-right text-[0.76rem]">
                        {quantity}
                      </p>
                    )}
                  </div>
                  {shown && (
                    <span className={`${FIGURE} pt-2.5`}>
                      {shown.onHand === null ? '—' : count(shown.onHand)}
                    </span>
                  )}
                  {added ? (
                    <button
                      type="button"
                      aria-label={`Remove stock row ${index + 1}`}
                      onClick={() => onChange(rows.filter((_, i) => i !== index))}
                      className="text-text-muted hover:text-danger inline-flex h-10 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent transition-colors"
                    >
                      <TrashIcon width={16} height={16} />
                    </button>
                  ) : (
                    <span />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div>
        <button
          type="button"
          onClick={() => onChange([...rows, blankStockRow()])}
          className={TEXT_BUTTON}
        >
          <PlusIcon width={14} height={14} />
          Add location
        </button>
      </div>
    </div>
  )
}
