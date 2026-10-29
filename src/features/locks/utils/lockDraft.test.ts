import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OPTIONS,
  blankLockDraft,
  buildLockBody,
  isLockDraftDirty,
  parseTags,
  validateLockDraft,
  type LockDraft,
  type PickedItem,
} from './lockDraft.ts'

const item = (id: string): PickedItem => ({ id, label: id })

describe('parseTags', () => {
  it('splits on commas, trims, and drops blanks and repeats (any case)', () => {
    expect(parseTags(' b2b , B2B,, vans ,b2b-credit')).toEqual([
      'b2b',
      'vans',
      'b2b-credit',
    ])
  })

  it('leaves out tags already chosen', () => {
    expect(parseTags('b2b, vans', ['B2B'])).toEqual(['vans'])
  })

  it('cuts a tag at the 255 characters the backend allows', () => {
    expect(parseTags('x'.repeat(300))[0]).toHaveLength(255)
  })
})

describe('validateLockDraft', () => {
  it('needs a product or a customer', () => {
    expect(validateLockDraft(blankLockDraft()).form).toMatch(
      /at least one product or customer/,
    )
  })

  it('lets products go without tags (a login-only lock)', () => {
    expect(validateLockDraft({ ...blankLockDraft(), products: [item('p1')] })).toEqual({})
  })

  it('always needs tags for customers', () => {
    const draft: LockDraft = { ...blankLockDraft(), customers: [item('c1')] }
    expect(validateLockDraft(draft).tags).toMatch(/Customers need at least one tag/)
    expect(validateLockDraft({ ...draft, tags: ['b2b'] })).toEqual({})
  })

  it('refuses more than 250 products or customers and more than 20 tags', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => item(`i${i}`))
    const problems = validateLockDraft({
      ...blankLockDraft(),
      products: many(251),
      customers: many(251),
      tags: Array.from({ length: 21 }, (_, i) => `t${i}`),
    })
    expect(problems.products).toMatch(/250/)
    expect(problems.customers).toMatch(/250/)
    expect(problems.tags).toMatch(/20/)
  })
})

describe('buildLockBody', () => {
  it('sends the ids, tags and every option, and the message only when there is one', () => {
    const draft: LockDraft = {
      products: [item('p1'), item('p2')],
      customers: [item('c1')],
      tags: ['b2b'],
      options: { ...DEFAULT_OPTIONS, hideFromLists: true, message: '  Log in please  ' },
    }
    expect(buildLockBody(draft, 'polymer-uk')).toEqual({
      shop: 'polymer-uk',
      products: ['p1', 'p2'],
      customers: ['c1'],
      tags: ['b2b'],
      enabled: true,
      hide_from_lists: true,
      hide_from_nav: false,
      noindex: false,
      hide_from_sitemap: false,
      manual_locking: false,
      message: 'Log in please',
    })
  })

  it('leaves out empty lists and an empty message', () => {
    const body = buildLockBody(
      { ...blankLockDraft(), products: [item('p1')] },
      'polymer-uk',
    )
    expect(body).not.toHaveProperty('customers')
    expect(body).not.toHaveProperty('tags')
    expect(body).not.toHaveProperty('message')
  })
})

describe('isLockDraftDirty', () => {
  it('is false for a blank form and true once anything is entered or changed', () => {
    expect(isLockDraftDirty(blankLockDraft())).toBe(false)
    expect(isLockDraftDirty({ ...blankLockDraft(), tags: ['b2b'] })).toBe(true)
    expect(
      isLockDraftDirty({
        ...blankLockDraft(),
        options: { ...DEFAULT_OPTIONS, enabled: false },
      }),
    ).toBe(true)
  })
})
