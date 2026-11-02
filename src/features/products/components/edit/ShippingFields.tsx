import { useMemo, useState, type ReactNode } from 'react'
import { SelectField } from '../../../../components/ui/SelectField.tsx'
import {
  DIMENSION_UNITS,
  WEIGHT_UNITS,
  type DimensionUnit,
  type WeightUnit,
} from '../../../../lib/api/endpoints.ts'
import { countryName, countryOptions } from '../../utils/countries.ts'
import type { ShippingDetailsDraft, ShippingProblems } from '../../utils/shipping.ts'
import { CardSection } from '../create/CreateCard.tsx'
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
  // More details starts open, and a problem in it keeps it open.
  const [detailsOpen, setDetailsOpen] = useState(true)
  const countries = useMemo(() => {
    const options = countryOptions()
    // A code the list doesn't have (kept from the store) is still shown rather than lost.
    return shipping.countryCode && !options.some((o) => o.value === shipping.countryCode)
      ? [
          ...options,
          { value: shipping.countryCode, label: countryName(shipping.countryCode) },
        ]
      : options
  }, [shipping.countryCode])
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

      <CardSection
        title="More details"
        open={detailsOpen || Boolean(problems.countryCode || problems.hsCode)}
        onToggle={() => setDetailsOpen((open) => !open)}
        last
      >
        <div className="flex flex-col gap-1.5">
          <SelectField
            id={`${idPrefix}-country`}
            label="Country/Region of origin"
            value={shipping.countryCode}
            options={countries}
            onChange={(countryCode) => onShipping({ countryCode })}
          />
          <Problem>{problems.countryCode}</Problem>
        </div>
        <EditField
          id={`${idPrefix}-hs-code`}
          label="Harmonized System (HS) code"
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
      </CardSection>
    </>
  )
}
