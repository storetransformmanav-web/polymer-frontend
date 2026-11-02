import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ChevronDownIcon, InfoIcon } from '../../../../components/ui/icons.tsx'
import { SelectField } from '../../../../components/ui/SelectField.tsx'
import {
  DIMENSION_UNITS,
  WEIGHT_UNITS,
  type DimensionUnit,
  type WeightUnit,
} from '../../../../lib/api/endpoints.ts'
import { countryName, countryOptions } from '../../utils/countries.ts'
import type { ShippingDetailsDraft, ShippingProblems } from '../../utils/shipping.ts'
import { Chip } from '../create/CreateCard.tsx'
import { EditField, FIELD_INPUT } from './fields.tsx'

const WEIGHT_UNIT_LABELS: Record<WeightUnit, string> = {
  GRAMS: 'g',
  KILOGRAMS: 'kg',
  OUNCES: 'oz',
  POUNDS: 'lb',
}
const WEIGHT_UNIT_OPTIONS = WEIGHT_UNITS.map((unit) => ({
  value: unit,
  label: WEIGHT_UNIT_LABELS[unit],
}))

const DIMENSION_UNIT_LABELS: Record<DimensionUnit, string> = {
  CENTIMETERS: 'cm',
  INCHES: 'in',
}
const DIMENSION_UNIT_OPTIONS = DIMENSION_UNITS.map((unit) => ({
  value: unit,
  label: DIMENSION_UNIT_LABELS[unit],
}))

/** Not offered by the API yet, so it is shown but cannot be changed. */
const PACKAGE_OPTIONS = [{ value: 'default', label: 'Store default' }]

/** A row of the Shipping card: its name on the left, its controls on the right. */
const ROW =
  'grid grid-cols-1 items-start gap-x-4 gap-y-1.5 sm:grid-cols-[11rem_minmax(0,1fr)]'
const ROW_LABEL = 'text-text text-[0.86rem] font-medium sm:pt-2.5'

function Row({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className={ROW}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={ROW_LABEL}>
          {label}
        </label>
      ) : (
        <span className={ROW_LABEL}>{label}</span>
      )}
      <div className="flex min-w-0 flex-col gap-1.5">{children}</div>
    </div>
  )
}

/** One of the three size boxes, with its letter in front ("L 22"). */
function SizeBox({
  id,
  letter,
  label,
  value,
  invalid,
  onChange,
}: {
  id: string
  letter: string
  label: string
  value: string
  invalid: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="relative min-w-0">
      <span
        aria-hidden="true"
        className="text-text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[0.82rem] font-medium"
      >
        {letter}
      </span>
      <input
        id={id}
        aria-label={label}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder="0.0"
        aria-invalid={invalid ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`${FIELD_INPUT} pl-8`}
      />
    </div>
  )
}

/** A small ⓘ after a label; hovering it (or focusing it) explains the field. */
function InfoHint({ children }: { children: string }) {
  return (
    <span
      title={children}
      className="text-text-muted ml-1.5 inline-flex cursor-help align-middle"
    >
      <InfoIcon width={14} height={14} />
    </span>
  )
}

/**
 * The country dropdown. It has about 250 options, so it is kept from redrawing on every key typed
 * in another field: it only redraws when its own value changes (`onPick` is stable).
 */
const CountrySelect = memo(function CountrySelect({
  id,
  value,
  onPick,
}: {
  id: string
  value: string
  onPick: (code: string) => void
}) {
  const options = useMemo(() => {
    const all = countryOptions()
    // A code the list doesn't have (kept from the store) is still shown rather than lost.
    return value && !all.some((option) => option.value === value)
      ? [...all, { value, label: countryName(value) }]
      : all
  }, [value])
  return (
    <SelectField
      id={id}
      label={
        <>
          Country/Region of origin
          <InfoHint>
            Where the product was made or produced. Customs use it to work out duties and
            taxes.
          </InfoHint>
        </>
      }
      value={value}
      options={options}
      onChange={onPick}
    />
  )
})

function Problem({ children }: { children?: string | null }) {
  return children ? (
    <p role="alert" className="text-danger text-[0.78rem]">
      {children}
    </p>
  ) : null
}

/**
 * The fields of a **Shipping** card, laid out like the store admin's: the package it ships in
 * (the store's default — the API has no way to change it), the packed size (L × W × H and its
 * unit), the weight and its unit, then a **More details** section with the country of origin and
 * the HS (customs) code. Used by Add product and by a variant's Shipping card, which own the
 * "Physical product" switch and the state; this draws and reports what is typed.
 */
export function ShippingFields({
  idPrefix,
  shipping,
  onShipping,
  problems,
  weight,
  weightNote,
  weightUnit,
  onWeightUnit,
}: {
  /** Prefix for the field ids, so two cards on a page don't share them. */
  idPrefix: string
  shipping: ShippingDetailsDraft
  onShipping: (patch: Partial<ShippingDetailsDraft>) => void
  problems: ShippingProblems
  /** The weight box; null when the weights are elsewhere (a table of variants), with `weightNote`. */
  weight: {
    value: string
    onChange: (value: string) => void
    error?: string | null
  } | null
  weightNote?: string
  weightUnit: WeightUnit
  onWeightUnit: (unit: WeightUnit) => void
}) {
  // More details starts closed (its pills say what is inside); a problem in it opens it.
  const [detailsOpen, setDetailsOpen] = useState(false)
  const open = detailsOpen || Boolean(problems.countryCode || problems.hsCode)
  // The latest `onShipping`, so the memoised country dropdown never reports to an old render.
  const reportShipping = useRef(onShipping)
  useEffect(() => {
    reportShipping.current = onShipping
  })
  const pickCountry = useCallback(
    (countryCode: string) => reportShipping.current({ countryCode }),
    [],
  )
  const dimensionsInvalid = Boolean(problems.dimensions)

  return (
    <>
      <div className="flex flex-col gap-4">
        <Row label="Package when shipped alone">
          <SelectField
            id={`${idPrefix}-package`}
            label="Package when shipped alone"
            hideLabel
            value="default"
            options={PACKAGE_OPTIONS}
            onChange={() => {}}
            disabled
          />
          <p className="text-text-muted text-[0.76rem]">
            The store&apos;s default package. It is set in Shopify and can&apos;t be
            changed here.
          </p>
        </Row>

        <Row label="Packed product size">
          <div
            role="group"
            aria-label="Packed product size"
            className="grid grid-cols-3 gap-2 min-[520px]:grid-cols-[repeat(3,minmax(0,1fr))_5.5rem]"
          >
            <SizeBox
              id={`${idPrefix}-length`}
              letter="L"
              label="Length"
              value={shipping.length}
              invalid={dimensionsInvalid}
              onChange={(length) => onShipping({ length })}
            />
            <SizeBox
              id={`${idPrefix}-width`}
              letter="W"
              label="Width"
              value={shipping.width}
              invalid={dimensionsInvalid}
              onChange={(width) => onShipping({ width })}
            />
            <SizeBox
              id={`${idPrefix}-height`}
              letter="H"
              label="Height"
              value={shipping.height}
              invalid={dimensionsInvalid}
              onChange={(height) => onShipping({ height })}
            />
            <div className="col-span-3 min-[520px]:col-span-1">
              <SelectField
                id={`${idPrefix}-size-unit`}
                label="Size unit"
                hideLabel
                value={shipping.dimensionUnit}
                options={DIMENSION_UNIT_OPTIONS}
                onChange={(unit) => onShipping({ dimensionUnit: unit as DimensionUnit })}
              />
            </div>
          </div>
          <Problem>{problems.dimensions}</Problem>
        </Row>

        <Row label="Weight" htmlFor={weight ? `${idPrefix}-weight` : undefined}>
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
            {weight ? (
              <input
                id={`${idPrefix}-weight`}
                inputMode="decimal"
                autoComplete="off"
                value={weight.value}
                placeholder="0.0"
                aria-invalid={weight.error ? true : undefined}
                onChange={(event) => weight.onChange(event.target.value)}
                className={FIELD_INPUT}
              />
            ) : (
              <p className="text-text-muted self-center text-[0.85rem]">{weightNote}</p>
            )}
            <SelectField
              id={`${idPrefix}-weight-unit`}
              label="Weight unit"
              hideLabel
              value={weightUnit}
              options={WEIGHT_UNIT_OPTIONS}
              onChange={(unit) => onWeightUnit(unit as WeightUnit)}
            />
          </div>
          <Problem>{weight?.error}</Problem>
        </Row>
      </div>

      {/* The foot of the card, edge to edge: pills while closed, a "More details" header open. */}
      <div className="border-border -mx-4 -mb-4 border-t sm:-mx-5 sm:-mb-5">
        {open ? (
          <button
            type="button"
            aria-expanded="true"
            onClick={() => setDetailsOpen(false)}
            className="hover:bg-accent-tint/40 flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent px-4 py-3.5 text-left text-[0.88rem] font-semibold transition-colors sm:px-5"
          >
            More details
            <ChevronDownIcon
              width={16}
              height={16}
              className="text-text-muted shrink-0 rotate-180"
            />
          </button>
        ) : (
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              {/* The same pills as the Price card's: a value shows in a small tag once set. */}
              <Chip
                value={
                  shipping.countryCode ? countryName(shipping.countryCode) : undefined
                }
                onClick={() => setDetailsOpen(true)}
              >
                Country of origin
              </Chip>
              <Chip
                value={shipping.hsCode || undefined}
                onClick={() => setDetailsOpen(true)}
              >
                HS Code
              </Chip>
            </div>
            <button
              type="button"
              aria-label="More details"
              aria-expanded="false"
              onClick={() => setDetailsOpen(true)}
              className="text-text-muted hover:text-text inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent"
            >
              <ChevronDownIcon width={16} height={16} />
            </button>
          </div>
        )}
        {open && (
          <div className="flex flex-col gap-4 px-4 pb-5 sm:px-5">
            <div className="flex flex-col gap-1.5">
              <CountrySelect
                id={`${idPrefix}-country`}
                value={shipping.countryCode}
                onPick={pickCountry}
              />
              <Problem>{problems.countryCode}</Problem>
            </div>
            <EditField
              id={`${idPrefix}-hs-code`}
              label={
                <>
                  Harmonized System (HS) code
                  <InfoHint>
                    The code customs use to classify the product, 6 to 13 digits.
                  </InfoHint>
                </>
              }
              hint="6 to 13 digits, for example 392310."
              error={problems.hsCode}
            >
              <input
                id={`${idPrefix}-hs-code`}
                inputMode="numeric"
                autoComplete="off"
                value={shipping.hsCode}
                placeholder="Enter a 6-digit code"
                aria-invalid={problems.hsCode ? true : undefined}
                onChange={(event) => onShipping({ hsCode: event.target.value })}
                className={FIELD_INPUT}
              />
            </EditField>
          </div>
        )}
      </div>
    </>
  )
}
