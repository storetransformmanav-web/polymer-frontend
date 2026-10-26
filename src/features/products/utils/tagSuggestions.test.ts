import { describe, expect, it } from 'vitest'
import { matchSuggestions } from './tagSuggestions.ts'

const KNOWN = [
  'Material_Plastic',
  'Material_Foil',
  'Category_Food Packaging',
  'Category_Cold Food Packaging',
  'Specification_Recyclable',
]

describe('matchSuggestions', () => {
  it('lists every value that contains what was typed, in any case', () => {
    expect(matchSuggestions(KNOWN, 'FOOD', [])).toEqual([
      'Category_Cold Food Packaging',
      'Category_Food Packaging',
    ])
    expect(matchSuggestions(KNOWN, 'mat', [])).toEqual([
      'Material_Foil',
      'Material_Plastic',
    ])
  })

  it('puts the ones that start with it first', () => {
    expect(matchSuggestions(['A_foil', 'foil_roll', 'Foil'], 'foil', [])).toEqual([
      'Foil',
      'foil_roll',
      'A_foil',
    ])
  })

  it('leaves out what is already a tag, and offers nothing for blank or unmatched text', () => {
    expect(matchSuggestions(KNOWN, 'material', ['material_plastic'])).toEqual([
      'Material_Foil',
    ])
    expect(matchSuggestions(KNOWN, '   ', [])).toEqual([])
    expect(matchSuggestions(KNOWN, 'zzz', [])).toEqual([])
  })
})
