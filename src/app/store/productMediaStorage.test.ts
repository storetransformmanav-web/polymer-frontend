import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  loadProductMedia,
  PRODUCT_MEDIA_STORAGE_KEY,
  saveProductMedia,
  type StoredProductMedia,
} from './productMediaStorage.ts'
import { SESSION_STORAGE_KEY } from './authSlice.ts'

const NOW = 2_000_000_000_000
const DATA: StoredProductMedia = {
  pendingMedia: {
    p1: {
      items: [{ url: 'https://cdn.example.com/a.jpg', alt: 'A', media_type: 'IMAGE' }],
      baseline: 0,
      startedAt: NOW - 60_000,
    },
  },
  removedMedia: {
    p1: [{ id: 'img-1', url: 'https://cdn.shopify.com/1.jpg', at: NOW - 30_000 }],
  },
  previewImages: { p1: { url: 'https://cdn.example.com/a.jpg', at: NOW - 60_000 } },
}

afterEach(() => {
  window.sessionStorage.clear()
  window.localStorage.clear()
  vi.resetModules()
})

describe('productMediaStorage', () => {
  it('gives back what was saved', () => {
    saveProductMedia(DATA)

    expect(loadProductMedia(NOW)).toEqual(DATA)
  })

  it('removes the entry when nothing is left to remember', () => {
    saveProductMedia(DATA)
    saveProductMedia({ pendingMedia: {}, removedMedia: {}, previewImages: {} })

    expect(window.sessionStorage.getItem(PRODUCT_MEDIA_STORAGE_KEY)).toBeNull()
    expect(loadProductMedia(NOW)).toBeNull()
  })

  it('drops anything older than a day', () => {
    saveProductMedia(DATA)

    expect(loadProductMedia(NOW + 25 * 60 * 60 * 1000)).toBeNull()
  })

  it('ignores damaged or tampered data, and any address that is not https', () => {
    window.sessionStorage.setItem(PRODUCT_MEDIA_STORAGE_KEY, '{not json')
    expect(loadProductMedia(NOW)).toBeNull()

    window.sessionStorage.setItem(
      PRODUCT_MEDIA_STORAGE_KEY,
      JSON.stringify({
        pendingMedia: {
          p1: {
            items: [{ url: 'javascript:alert(1)' }],
            baseline: 0,
            startedAt: NOW,
          },
        },
      }),
    )
    expect(loadProductMedia(NOW)).toBeNull()

    window.sessionStorage.setItem(
      PRODUCT_MEDIA_STORAGE_KEY,
      JSON.stringify({
        previewImages: { p1: { url: 'http://insecure.example.com/a.jpg', at: NOW } },
      }),
    )
    expect(loadProductMedia(NOW)).toBeNull()
  })
})

describe('the products store across a page refresh', () => {
  const session = {
    accessToken: 'token',
    expiresAt: '2099-01-01T00:00:00Z',
    user: { id: 'u1', email: 'a@b.co', full_name: 'A', role: 'admin' },
  }

  async function freshStore() {
    vi.resetModules()
    const storeModule = await import('./store.ts')
    const slice = await import('./productsSlice.ts')
    const auth = await import('./authSlice.ts')
    return { createAppStore: storeModule.createAppStore, slice, auth }
  }

  it('brings back the files still being processed, the previews and the deleted images', async () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
    window.sessionStorage.setItem(PRODUCT_MEDIA_STORAGE_KEY, JSON.stringify(DATA))
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    const { createAppStore } = await freshStore()

    const state = createAppStore().getState().products

    expect(state.pendingMedia.p1.items[0].url).toBe('https://cdn.example.com/a.jpg')
    expect(state.removedMedia.p1[0].id).toBe('img-1')
    expect(state.previewImages.p1.url).toBe('https://cdn.example.com/a.jpg')
    vi.useRealTimers()
  })

  it('saves changes as they happen, and forgets everything when the user signs out', async () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
    const { createAppStore, slice, auth } = await freshStore()
    const store = createAppStore()

    store.dispatch(
      slice.mediaQueued({
        id: 'p9',
        items: [{ url: 'https://cdn.example.com/n.jpg', media_type: 'IMAGE' }],
        baseline: 0,
        startedAt: Date.now(),
      }),
    )
    const saved = JSON.parse(
      window.sessionStorage.getItem(PRODUCT_MEDIA_STORAGE_KEY) ?? 'null',
    )
    expect(saved.pendingMedia.p9.items[0].url).toBe('https://cdn.example.com/n.jpg')

    store.dispatch(auth.sessionCleared())
    expect(window.sessionStorage.getItem(PRODUCT_MEDIA_STORAGE_KEY)).toBeNull()
  })

  it('does not restore anything for someone who is signed out', async () => {
    window.sessionStorage.setItem(PRODUCT_MEDIA_STORAGE_KEY, JSON.stringify(DATA))
    const { createAppStore } = await freshStore()

    expect(createAppStore().getState().products.pendingMedia).toEqual({})
  })
})
