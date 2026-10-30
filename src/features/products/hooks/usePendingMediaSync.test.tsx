import { act, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mediaQueued } from '../../../app/store/productsSlice.ts'
import {
  api,
  type ProductDetail,
  type ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { usePendingMediaSync } from './usePendingMedia.ts'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    products: {
      update: vi.fn(),
      details: vi.fn(),
      list: vi.fn(),
      syncHistory: vi.fn(),
    },
  },
}))

const update = vi.mocked(api.products.update)
const details = vi.mocked(api.products.details)

const WRITE_OK: ProductWriteResult = {
  product_id: 'p1',
  sync_status: 'pending',
  push_id: 'push-1',
  changes: null,
  message: 'ok',
}

function product(ids: string[]): ProductDetail {
  return {
    id: 'p1',
    title: 'Sushi Tray',
    shop: { key: 'polymer-uk', name: 'Polymer UK', domain: 'uk.myshopify.com' },
    featured_image_url: ids.length ? `https://cdn.example.com/${ids[0]}.jpg` : null,
    images: ids.map((id, index) => ({
      id,
      url: `https://cdn.example.com/${id}.jpg`,
      alt_text: null,
      position: index + 1,
      media_type: 'IMAGE',
    })),
    tags: [],
    variants: [],
    collections: [],
    metafields: [],
  } as unknown as ProductDetail
}

const WAITING = [
  { url: 'https://storage.example.com/c.png', media_type: 'IMAGE' as const },
]

/** What the open product's page mounts, whichever tab is showing. */
function Probe({ item }: { item: ProductDetail }) {
  usePendingMediaSync(item)
  return null
}

describe('files the store is still processing, after a page refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    update.mockResolvedValue(WRITE_OK)
    details.mockResolvedValue(product(['a']))
    vi.mocked(api.products.syncHistory).mockResolvedValue([])
    vi.mocked(api.products.list).mockResolvedValue({
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
      total_pages: 1,
      has_next: false,
    } as unknown as Awaited<ReturnType<typeof api.products.list>>)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('looks for them from wherever the product is open, not only the Media tab', async () => {
    const view = renderWithProviders(<Probe item={product(['a'])} />)
    // What a refresh brings back: the files were handed to the store, none is listed yet.
    view.store.dispatch(
      mediaQueued({ id: 'p1', items: WAITING, baseline: 1, startedAt: Date.now() }),
    )

    await act(() => vi.advanceTimersByTimeAsync(2100))
    expect(details).toHaveBeenCalled()
    expect(details.mock.calls[0][0]).toBe('p1')
  })

  it('stops waiting once the product lists the file, and re-reads nothing more', async () => {
    const view = renderWithProviders(<Probe item={product(['a'])} />)
    view.store.dispatch(
      mediaQueued({ id: 'p1', items: WAITING, baseline: 1, startedAt: Date.now() }),
    )

    view.rerender(<Probe item={product(['a', 'c'])} />)

    await waitFor(() =>
      expect(view.store.getState().products.pendingMedia.p1).toBeUndefined(),
    )
    expect(update).not.toHaveBeenCalled()
  })

  it('still puts a file chosen on the Add product form in front of the older picture', async () => {
    const view = renderWithProviders(<Probe item={product(['a'])} />)
    view.store.dispatch(
      mediaQueued({
        id: 'p1',
        items: WAITING,
        baseline: 1,
        startedAt: Date.now(),
        leading: true,
      }),
    )

    view.rerender(<Probe item={product(['a', 'c'])} />)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'p1',
        { media_order: ['c', 'a'] },
        'polymer-uk',
      ),
    )
    expect(update).toHaveBeenCalledTimes(1)
  })
  it('points a variant at the picture that arrived for its web address', async () => {
    const view = renderWithProviders(<Probe item={product(['a'])} />)
    view.store.dispatch(
      mediaQueued({
        id: 'p1',
        items: WAITING,
        baseline: 1,
        startedAt: Date.now(),
        variantLinks: [{ variantId: 'variant-1', url: WAITING[0].url }],
      }),
    )

    // Nothing is sent while the file has not arrived.
    expect(update).not.toHaveBeenCalled()
    view.rerender(<Probe item={product(['a', 'c'])} />)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'p1',
        { variants: [{ id: 'variant-1', image_attachment_id: 'c' }] },
        'polymer-uk',
      ),
    )
    expect(update).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(view.store.getState().products.pendingMedia.p1).toBeUndefined(),
    )
  })
})
