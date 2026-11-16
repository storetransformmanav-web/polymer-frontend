import { describe, expect, it } from 'vitest'
import { isSmart, typeLabel } from './collectionDraft.ts'

describe('typeLabel — the collection type as the API names it', () => {
  it('writes the API’s own value for people, with no mapping of its own', () => {
    expect(typeLabel('smart')).toBe('Smart')
    expect(typeLabel('custom')).toBe('Custom')
  })

  it('ignores the letter case and the separators the API might use', () => {
    expect(typeLabel('SMART')).toBe('Smart')
    expect(typeLabel('Custom')).toBe('Custom')
    expect(typeLabel('dynamic_rules')).toBe('Dynamic rules')
    expect(typeLabel('some-new-type')).toBe('Some new type')
  })

  it('shows any type the backend adds later, as it sends it', () => {
    expect(typeLabel('bundle')).toBe('Bundle')
  })

  it('never invents "Manual" or "Automated"', () => {
    for (const type of ['smart', 'custom', 'other', '', null, undefined]) {
      expect(typeLabel(type)).not.toMatch(/manual|automated/i)
    }
  })

  it('shows a dash when the API sends no type', () => {
    expect(typeLabel(null)).toBe('—')
    expect(typeLabel(undefined)).toBe('—')
    expect(typeLabel('  ')).toBe('—')
  })

  it('still tells a smart collection apart for the rules around it', () => {
    expect(isSmart('smart')).toBe(true)
    expect(isSmart('SMART')).toBe(true)
    expect(isSmart('custom')).toBe(false)
    expect(isSmart(null)).toBe(false)
  })
})
