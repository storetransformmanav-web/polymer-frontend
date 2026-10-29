import { PlusIcon, TrashIcon } from '../../../../components/ui/icons.tsx'
import { SelectField } from '../../../../components/ui/SelectField.tsx'
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
 * A variant's stock as a Location / Quantity table, drawn like the Inventory card of Add product:
 * each row is a dropdown of the store's locations and a quantity. Rows can be added for more
 * locations; a row added here can be removed again. With no known location the dropdown is the
 * plain Shopify location number box, so stock can still be set.
 */
export function StockFields({
  rows,
  onChange,
  locations,
  errors,
  prefix,
  label,
}: {
  rows: StockRowDraft[]
  onChange: (rows: StockRowDraft[]) => void
  locations: StockLocationChoice[]
  errors: DraftErrors
  /** The error keys' start: `<prefix>.<row>.location` / `.quantity`. */
  prefix: string
  /** What the table is about, for assistive technology ("Stock of Medium"). */
  label: string
}) {
  const patch = (index: number, change: Partial<StockRowDraft>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...change } : row)))

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="border-border overflow-hidden rounded-xl border">
        <div
          className={`${STOCK_GRID} bg-surface text-text-muted px-3 py-2 text-[0.76rem] font-semibold`}
        >
          <span>Location</span>
          <span className="text-right">Quantity</span>
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
              return (
                <li
                  key={row.key}
                  className={`${STOCK_GRID} border-border items-start border-t p-3 first:border-t-0`}
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
