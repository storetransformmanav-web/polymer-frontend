import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  findSensitiveParams,
  isSensitiveParam,
  scrubAddressBar,
  withoutSensitiveParams,
} from './urlSecurity.ts'

describe('isSensitiveParam', () => {
  it.each([
    'token',
    'access_token',
    'access-token',
    'accessToken',
    'ID_TOKEN',
    'refresh_token',
    'auth_token',
    'jwt',
    'bearer',
    'authorization',
    'api_key',
    'apiKey',
    'secret',
    'client_secret',
    'password',
    'otp',
    'session',
    'session_id',
    'sid',
  ])('treats %s as a credential', (name) => {
    expect(isSensitiveParam(name)).toBe(true)
  })

  it.each([
    'page',
    'page_size',
    'search',
    'status',
    'shop',
    'tag',
    'sort',
    'order',
    'from',
    'to',
    'vendor',
    'product_type',
    'collection_id',
    'include_raw',
    'tokens_used_up',
    'code',
    'key',
  ])('leaves %s alone', (name) => {
    expect(isSensitiveParam(name)).toBe(false)
  })
})

describe('withoutSensitiveParams', () => {
  const clean = (href: string) => withoutSensitiveParams(href)

  it('leaves a clean address exactly as it was', () => {
    const href = 'https://crm.example.com/products?page=2&search=bag#top'
    expect(clean(href)).toEqual({ href, removed: [] })
  })

  it('takes a credential out of the query and keeps everything else, in order', () => {
    const result = clean(
      'https://crm.example.com/orders/17516?shop=polymer-uk&token=abc&page=2',
    )

    expect(result.removed).toEqual(['token'])
    expect(result.href).toBe(
      'https://crm.example.com/orders/17516?shop=polymer-uk&page=2',
    )
  })

  it('takes out several, whatever their case, and a repeated one', () => {
    const result = clean(
      'https://x.test/login?Access_Token=a&id_token=b&token=c&token=d&tab=1',
    )

    expect(result.removed).toEqual(['Access_Token', 'id_token', 'token', 'token'])
    expect(result.href).toBe('https://x.test/login?tab=1')
  })

  it('drops the ? when nothing else is left', () => {
    expect(clean('https://x.test/login?token=abc').href).toBe('https://x.test/login')
  })

  it('takes a credential out of an OAuth-style fragment, keeping the rest of it', () => {
    const result = clean('https://x.test/cb#access_token=abc&state=xyz&token_type=bearer')

    expect(result.removed).toEqual(['access_token'])
    expect(result.href).toBe('https://x.test/cb#state=xyz&token_type=bearer')
  })

  it('drops the # when the fragment was only the credential', () => {
    expect(clean('https://x.test/cb#id_token=abc').href).toBe('https://x.test/cb')
  })

  it('cleans the parameters of a route kept in the fragment', () => {
    const result = clean('https://x.test/app#/orders?token=abc&page=2')

    expect(result.removed).toEqual(['token'])
    expect(result.href).toBe('https://x.test/app#/orders?page=2')
    expect(clean('https://x.test/app#/orders?token=abc').href).toBe(
      'https://x.test/app#/orders',
    )
  })

  it('leaves an ordinary fragment alone', () => {
    expect(clean('https://x.test/page#section-2')).toEqual({
      href: 'https://x.test/page#section-2',
      removed: [],
    })
  })

  it('handles both the query and the fragment at once', () => {
    const result = clean('https://x.test/p?token=a&keep=1#access_token=b')

    expect(result.removed).toEqual(['token', 'access_token'])
    expect(result.href).toBe('https://x.test/p?keep=1')
  })
})

describe('scrubAddressBar', () => {
  afterEach(() => {
    // The mocks go first: one of them makes `replaceState` throw.
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  it('removes a credential from the address bar, keeping the rest and the history state', () => {
    window.history.replaceState(
      { from: '/orders' },
      '',
      '/login?token=abc123&tab=1#id_token=zzz',
    )

    const removed = scrubAddressBar()

    expect(removed).toEqual(['token', 'id_token'])
    expect(window.location.pathname).toBe('/login')
    expect(window.location.search).toBe('?tab=1')
    expect(window.location.hash).toBe('')
    expect(window.location.href).not.toContain('abc123')
    expect(window.history.state).toEqual({ from: '/orders' })
  })

  it('replaces the history entry rather than adding one (Back does not bring the credential back)', () => {
    window.history.replaceState(null, '', '/login?token=abc123')
    const before = window.history.length

    scrubAddressBar()

    expect(window.history.length).toBe(before)
  })

  it('does nothing — not even a history call — when the address is clean', () => {
    window.history.replaceState(null, '', '/products?page=2')
    const replace = vi.spyOn(window.history, 'replaceState')

    expect(scrubAddressBar()).toEqual([])
    expect(replace).not.toHaveBeenCalled()
    expect(window.location.search).toBe('?page=2')
  })

  it('survives a history that refuses the change', () => {
    window.history.replaceState(null, '', '/login?token=abc123')
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {
      throw new DOMException('locked', 'SecurityError')
    })

    expect(() => scrubAddressBar()).not.toThrow()
  })
})

describe('findSensitiveParams', () => {
  it('finds a credential written into the path', () => {
    expect(findSensitiveParams('/x?page=1&token=abc')).toEqual(['token'])
    expect(findSensitiveParams('/x?api_key=1&access-token=2')).toEqual([
      'api_key',
      'access-token',
    ])
  })

  it('finds one in params, as an object or a URLSearchParams', () => {
    expect(findSensitiveParams('/x', { page: 1, jwt: 'a' })).toEqual(['jwt'])
    expect(
      findSensitiveParams('/x', new URLSearchParams({ Password: 'a', q: 'b' })),
    ).toEqual(['Password'])
  })

  it('finds nothing in an ordinary request', () => {
    expect(findSensitiveParams('/products')).toEqual([])
    expect(
      findSensitiveParams('/products?page=2#x', { search: 'bag', shop: 'polymer-uk' }),
    ).toEqual([])
    expect(findSensitiveParams('/x', undefined)).toEqual([])
    expect(findSensitiveParams('/x', null)).toEqual([])
    expect(findSensitiveParams('/x', 'not an object')).toEqual([])
  })

  it('ignores a credential name that is only in the fragment of the path text', () => {
    expect(findSensitiveParams('/x?page=1#token=abc')).toEqual([])
  })
})
