import { describe, expect, it } from 'vitest'
import { countryName, countryOptions } from './countries.ts'
import {
  blankShippingDetails,
  packedSizeLabel,
  shippingChanges,
  shippingCreateFields,
  shippingDetailsFromVariant,
  validateShippingDetails,
  type ShippingDetailsDraft,
} from './shipping.ts'

const draft = (patch: Partial<ShippingDetailsDraft> = {}): ShippingDetailsDraft => ({
  ...blankShippingDetails(),
  ...patch,
})

describe('reading the details of a variant', () => {
  it('shows the boxes empty when no packed size is set (null)', () => {
    expect(
      shippingDetailsFromVariant({
        packed_dimensions: null,
        country_code_of_origin: null,
        harmonized_system_code: null,
      }),
    ).toEqual(blankShippingDetails())
    // A zero size is "not set" too.
    expect(
      shippingDetailsFromVariant({
        packed_dimensions: { length: 0, width: '0.0', height: 0, unit: 'INCHES' },
      }).length,
    ).toBe('')
  })

  it('reads the size (numbers or strings), its unit, the country and the code', () => {
    expect(
      shippingDetailsFromVariant({
        packed_dimensions: { length: 22, width: '13.7', height: 4.2, unit: 'INCHES' },
        country_code_of_origin: 'gb',
        harmonized_system_code: ' 392310 ',
      }),
    ).toEqual({
      length: '22',
      width: '13.7',
      height: '4.2',
      dimensionUnit: 'INCHES',
      countryCode: 'GB',
      hsCode: '392310',
    })
  })

  it('falls back to centimetres for a unit it does not know', () => {
    expect(
      shippingDetailsFromVariant({ packed_dimensions: { length: 1, unit: 'FURLONGS' } })
        .dimensionUnit,
    ).toBe('CENTIMETERS')
  })

  it('writes a size as one line', () => {
    expect(
      packedSizeLabel({ length: 22, width: 13.7, height: 4.2, unit: 'CENTIMETERS' }),
    ).toBe('22 × 13.7 × 4.2 cm')
    expect(packedSizeLabel({ length: 1, width: 2, height: 3, unit: 'INCHES' })).toBe(
      '1 × 2 × 3 in',
    )
    expect(packedSizeLabel(null)).toBe('')
  })
})

describe('checking the details', () => {
  it('accepts nothing, or a whole size, a country and a code', () => {
    expect(validateShippingDetails(draft())).toEqual({})
    expect(
      validateShippingDetails(
        draft({
          length: '22',
          width: '13.7',
          height: '4.2',
          countryCode: 'GB',
          hsCode: '392310',
        }),
      ),
    ).toEqual({})
  })

  it('wants all three sizes or none', () => {
    expect(validateShippingDetails(draft({ length: '22' })).dimensions).toMatch(
      /all three sizes/,
    )
    expect(
      validateShippingDetails(draft({ length: '22', width: '0', height: '4' }))
        .dimensions,
    ).toMatch(/all three sizes/)
    expect(
      validateShippingDetails(draft({ length: '0', width: '0', height: '0' })),
    ).toEqual({})
  })

  it('wants numbers for the sizes', () => {
    expect(
      validateShippingDetails(draft({ length: 'big', width: '1', height: '1' }))
        .dimensions,
    ).toMatch(/numbers/)
  })

  it('wants a two-letter country and a 6 to 13 digit code', () => {
    expect(validateShippingDetails(draft({ countryCode: 'GBR' })).countryCode).toMatch(
      /two-letter/,
    )
    expect(validateShippingDetails(draft({ hsCode: '12345' })).hsCode).toMatch(/6 to 13/)
    expect(validateShippingDetails(draft({ hsCode: '12345678901234' })).hsCode).toMatch(
      /6 to 13/,
    )
    expect(validateShippingDetails(draft({ hsCode: '39.23.10' })).hsCode).toMatch(
      /6 to 13/,
    )
    expect(validateShippingDetails(draft({ hsCode: '3923101000123' }))).toEqual({})
  })
})

describe('what a new product sends', () => {
  it('sends only what was filled in, the size as numbers', () => {
    expect(shippingCreateFields(draft())).toEqual({})
    expect(
      shippingCreateFields(
        draft({
          length: '22',
          width: '13.7',
          height: '4.2',
          dimensionUnit: 'INCHES',
          countryCode: 'gb',
          hsCode: '392310',
        }),
      ),
    ).toEqual({
      packed_dimensions: { length: 22, width: 13.7, height: 4.2, unit: 'INCHES' },
      country_code_of_origin: 'GB',
      harmonized_system_code: '392310',
    })
  })

  it('leaves a half-filled size out (it is refused before it gets here)', () => {
    expect(shippingCreateFields(draft({ length: '22' }))).toEqual({})
  })
})

describe('what an update sends', () => {
  const had = draft({
    length: '22',
    width: '13.7',
    height: '4.2',
    countryCode: 'GB',
    hsCode: '392310',
  })

  it('sends nothing when nothing changed', () => {
    expect(shippingChanges({ ...had }, had)).toEqual({})
    // "22.0" is the same size as "22".
    expect(shippingChanges({ ...had, length: '22.0' }, had)).toEqual({})
    // A unit picked while there is no size is no change.
    expect(shippingChanges(draft({ dimensionUnit: 'INCHES' }), draft())).toEqual({})
  })

  it('sends the whole new size when one side changed', () => {
    expect(shippingChanges({ ...had, height: '5' }, had)).toEqual({
      packed_dimensions: { length: 22, width: 13.7, height: 5, unit: 'CENTIMETERS' },
    })
  })

  it('sends the size and its unit when only the unit changed', () => {
    expect(shippingChanges({ ...had, dimensionUnit: 'INCHES' }, had)).toEqual({
      packed_dimensions: { length: 22, width: 13.7, height: 4.2, unit: 'INCHES' },
    })
  })

  it('clears an emptied size with 0 × 0 × 0', () => {
    expect(
      shippingChanges({ ...had, length: '', width: '', height: '' }, had)
        .packed_dimensions,
    ).toEqual({ length: 0, width: 0, height: 0, unit: 'CENTIMETERS' })
  })

  it('sets a first size', () => {
    expect(
      shippingChanges(draft({ length: '1', width: '2', height: '3' }), draft()),
    ).toEqual({
      packed_dimensions: { length: 1, width: 2, height: 3, unit: 'CENTIMETERS' },
    })
  })

  it('sends a changed country and code, and null when they are cleared', () => {
    expect(shippingChanges({ ...had, countryCode: 'FR', hsCode: '482110' }, had)).toEqual(
      {
        country_code_of_origin: 'FR',
        harmonized_system_code: '482110',
      },
    )
    expect(shippingChanges({ ...had, countryCode: '', hsCode: '' }, had)).toEqual({
      country_code_of_origin: null,
      harmonized_system_code: null,
    })
  })
})

describe('the countries', () => {
  it('lists them by name with an empty choice first, and names a code', () => {
    const options = countryOptions()
    expect(options[0]).toEqual({ value: '', label: 'Select' })
    expect(options.find((option) => option.value === 'GB')?.label).toBe('United Kingdom')
    expect(options.length).toBeGreaterThan(240)
    expect(countryName('GB')).toBe('United Kingdom')
  })
})
