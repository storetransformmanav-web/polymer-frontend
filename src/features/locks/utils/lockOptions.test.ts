import { describe, expect, it } from 'vitest'
import type { AccessLock } from '../../../lib/api/endpoints.ts'
import { buildOptionsBody, flagWord, withOptionChange } from './lockOptions.ts'

const lock = (patch: Partial<AccessLock> = {}) =>
  ({
    product_id: 'p-1',
    title: 'Bulk Storage Container',
    handle: 'bulk-storage-container',
    tags: ['b2b'],
    enabled: true,
    hide_from_lists: false,
    hide_from_nav: false,
    noindex: false,
    hide_from_sitemap: false,
    manual_locking: false,
    product_tags: [],
    ...patch,
  }) as AccessLock

describe('buildOptionsBody', () => {
  it('names the shop, the product and the lock’s own keys, and only the option that changes', () => {
    expect(buildOptionsBody(lock(), 'polymer-uk', { enabled: false })).toEqual({
      shop: 'polymer-uk',
      products: ['bulk-storage-container'],
      tags: ['b2b'],
      enabled: false,
    })
  })

  it('sends no tags for a lock without keys (it stays login-only), and the id without a handle', () => {
    expect(
      buildOptionsBody(lock({ tags: [], handle: null }), 'polymer-uk', { noindex: true }),
    ).toEqual({ shop: 'polymer-uk', products: ['p-1'], noindex: true })
  })
})

describe('withOptionChange / flagWord', () => {
  it('puts the change into the lock without touching the rest', () => {
    expect(withOptionChange(lock(), { noindex: true })).toMatchObject({
      noindex: true,
      enabled: true,
      tags: ['b2b'],
    })
  })

  it('says Enabled / Disabled for the status and Yes / No for the other settings', () => {
    expect(flagWord('enabled', true)).toBe('Enabled')
    expect(flagWord('enabled', false)).toBe('Disabled')
    expect(flagWord('hide_from_lists', true)).toBe('Yes')
    expect(flagWord('manual_locking', false)).toBe('No')
  })
})
