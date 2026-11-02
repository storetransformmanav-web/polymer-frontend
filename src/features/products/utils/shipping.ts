import {
  DIMENSION_UNITS,
  type DimensionUnit,
  type PackedDimensionsInput,
  type ProductVariant,
} from '../../../lib/api/endpoints.ts'

/**
 * A variant's shipping details beyond its weight: the packed size (length × width × height and
 * its unit), the country it comes from and its customs (HS) code. The API keys are
 * `packed_dimensions`, `country_code_of_origin` and `harmonized_system_code`.
 */
export interface ShippingDetailsDraft {
  length: string
  width: string
  height: string
  dimensionUnit: DimensionUnit
  /** Two letters ('' = none). */
  countryCode: string
  /** 6 to 13 digits ('' = none). */
  hsCode: string
}

export interface ShippingProblems {
  dimensions?: string
  countryCode?: string
  hsCode?: string
}

/** The fields of an update or create body that carry these details. */
export interface ShippingFields {
  packed_dimensions?: PackedDimensionsInput
  country_code_of_origin?: string | null
  harmonized_system_code?: string | null
}

const DECIMAL = /^\d+(\.\d+)?$/

export function blankShippingDetails(): ShippingDetailsDraft {
  return {
    length: '',
    width: '',
    height: '',
    dimensionUnit: 'CENTIMETERS',
    countryCode: '',
    hsCode: '',
  }
}

const asUnit = (value: string | null | undefined): DimensionUnit =>
  DIMENSION_UNITS.find((unit) => unit === (value ?? '').toUpperCase()) ?? 'CENTIMETERS'

/** A size as the box shows it: nothing for a missing or zero size, else the number. */
function sizeText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const number = Number(String(value).trim())
  return Number.isFinite(number) && number > 0 ? String(number) : ''
}

/**
 * The details as the product page has them. `packed_dimensions` is null when no size is set —
 * the boxes are then empty (they show the 0.0 hint).
 */
export function shippingDetailsFromVariant(
  variant: Pick<
    ProductVariant,
    'packed_dimensions' | 'country_code_of_origin' | 'harmonized_system_code'
  >,
): ShippingDetailsDraft {
  const size = variant.packed_dimensions
  return {
    length: sizeText(size?.length),
    width: sizeText(size?.width),
    height: sizeText(size?.height),
    dimensionUnit: asUnit(size?.unit),
    countryCode: (variant.country_code_of_origin ?? '').trim().toUpperCase(),
    hsCode: (variant.harmonized_system_code ?? '').trim(),
  }
}

const sizeNumber = (value: string) => (value.trim() === '' ? 0 : Number(value.trim()))
const sizes = (draft: ShippingDetailsDraft) =>
  [draft.length, draft.width, draft.height].map(sizeNumber)
const hasSize = (draft: ShippingDetailsDraft) => sizes(draft).some((size) => size > 0)
const country = (draft: ShippingDetailsDraft) => draft.countryCode.trim().toUpperCase()
const hsCode = (draft: ShippingDetailsDraft) => draft.hsCode.trim()

/** What is wrong with the details, by field — nothing when they are fine (or all empty). */
export function validateShippingDetails(draft: ShippingDetailsDraft): ShippingProblems {
  const problems: ShippingProblems = {}
  const parts = [draft.length, draft.width, draft.height].map((part) => part.trim())
  if (parts.some((part) => part !== '' && !DECIMAL.test(part))) {
    problems.dimensions = 'Enter the sizes as numbers, such as 22 or 13.7'
  } else if (hasSize(draft) && !sizes(draft).every((size) => size > 0)) {
    problems.dimensions = 'Enter all three sizes (L, W and H), or leave them all empty'
  }
  const code = draft.countryCode.trim()
  if (code !== '' && !/^[A-Za-z]{2}$/.test(code)) {
    problems.countryCode = 'Use a two-letter country code, such as GB'
  }
  if (hsCode(draft) !== '' && !/^\d{6,13}$/.test(hsCode(draft))) {
    problems.hsCode = 'Use 6 to 13 digits, such as 392310'
  }
  return problems
}

/** The packed size as the API takes it (numbers), or nothing when there is no full size. */
function packedSize(draft: ShippingDetailsDraft): PackedDimensionsInput | undefined {
  const [length, width, height] = sizes(draft)
  return length > 0 && width > 0 && height > 0
    ? { length, width, height, unit: draft.dimensionUnit }
    : undefined
}

/** What a new product or variant sends: only what was filled in. */
export function shippingCreateFields(draft: ShippingDetailsDraft): ShippingFields {
  const fields: ShippingFields = {}
  const size = packedSize(draft)
  if (size) fields.packed_dimensions = size
  if (country(draft)) fields.country_code_of_origin = country(draft)
  if (hsCode(draft)) fields.harmonized_system_code = hsCode(draft)
  return fields
}

/**
 * What an update sends, given what the variant had: only what changed. A size that was emptied is
 * sent as 0 × 0 × 0 (the API's way to clear it); a cleared country or code is sent as null.
 */
export function shippingChanges(
  draft: ShippingDetailsDraft,
  base: ShippingDetailsDraft,
): ShippingFields {
  const changes: ShippingFields = {}
  const now = sizes(draft)
  const before = sizes(base)
  const sizeChanged =
    now.some((size, index) => size !== before[index]) ||
    (draft.dimensionUnit !== base.dimensionUnit && (hasSize(draft) || hasSize(base)))
  if (sizeChanged) {
    changes.packed_dimensions = packedSize(draft) ?? {
      length: 0,
      width: 0,
      height: 0,
      unit: draft.dimensionUnit,
    }
  }
  if (country(draft) !== country(base)) {
    changes.country_code_of_origin = country(draft) === '' ? null : country(draft)
  }
  if (hsCode(draft) !== hsCode(base)) {
    changes.harmonized_system_code = hsCode(draft) === '' ? null : hsCode(draft)
  }
  return changes
}

/** A size as one line ("22 × 13.7 × 4.2 cm"), or '' when the variant has none. */
export function packedSizeLabel(
  size: ProductVariant['packed_dimensions'] | undefined,
): string {
  const draft = shippingDetailsFromVariant({ packed_dimensions: size })
  if (!draft.length || !draft.width || !draft.height) return ''
  const unit = draft.dimensionUnit === 'INCHES' ? 'in' : 'cm'
  return `${draft.length} × ${draft.width} × ${draft.height} ${unit}`
}
