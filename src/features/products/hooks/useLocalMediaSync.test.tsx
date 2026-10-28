import { waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { localMediaAdded, type LocalMediaItem } from '../../../app/store/productsSlice.ts'
import {
  api,
  type ProductDetail,
  type ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { useLocalMediaSync } from './useLocalMedia.ts'

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

const WRITE_OK: ProductWriteResult = {
  product_id: 'p1',
  sync_status: 'pending',
  push_id: 'push-1',
  changes: null,
  message: 'ok',
}

/** A product holding these images, in this order (a variant's picture first, say). */
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

const file = (key: string): LocalMediaItem => ({
  key,
  name: `${key}.png`,
  mediaType: 'IMAGE',
  previewUrl: `blob:${key}`,
  status: 'sent',
  resourceUrl: `https://storage.example.com/${key}.png`,
})

function Probe({ item }: { item: ProductDetail }) {
  useLocalMediaSync(item)
  return null
}

describe('the pictures chosen on the Add product form lead the product’s images', () => {
  beforeEach(() => {
    update.mockResolvedValue(WRITE_OK)
    vi.mocked(api.products.details).mockResolvedValue(product(['a']))
    vi.mocked(api.products.syncHistory).mockResolvedValue([])
    // The list is re-read quietly after files arrive: an empty page will do.
    vi.mocked(api.products.list).mockResolvedValue({
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
      total_pages: 1,
      has_next: false,
    } as unknown as Awaited<ReturnType<typeof api.products.list>>)
  })
  afterEach(() => vi.clearAllMocks())

  it('moves an arrived file in front of the picture that went in with the product', async () => {
    const view = renderWithProviders(<Probe item={product(['a'])} />)
    view.store.dispatch(
      localMediaAdded({ id: 'p1', items: [file('c')], baseline: 1, leading: true }),
    )

    // The store has listed the uploaded picture after the variant's one.
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

  it('keeps several files in the order they were chosen, all ahead of the older picture', async () => {
    const view = renderWithProviders(<Probe item={product(['a'])} />)
    view.store.dispatch(
      localMediaAdded({
        id: 'p1',
        items: [file('c1'), file('c2')],
        baseline: 1,
        leading: true,
      }),
    )

    view.rerender(<Probe item={product(['a', 'c1'])} />)
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(
        'p1',
        { media_order: ['c1', 'a'] },
        'polymer-uk',
      ),
    )

    // The second arrives after the first was moved to the front.
    view.rerender(<Probe item={product(['c1', 'a', 'c2'])} />)
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(
        'p1',
        { media_order: ['c1', 'c2', 'a'] },
        'polymer-uk',
      ),
    )
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('leaves the order alone for files added later (they go after the existing images)', async () => {
    const view = renderWithProviders(<Probe item={product(['a'])} />)
    view.store.dispatch(localMediaAdded({ id: 'p1', items: [file('c')], baseline: 1 }))

    view.rerender(<Probe item={product(['a', 'c'])} />)

    await waitFor(() =>
      expect(view.store.getState().products.localMedia.p1).toBeUndefined(),
    )
    expect(update).not.toHaveBeenCalled()
  })

  it('does nothing when the product had no picture of its own to go in front of', async () => {
    const view = renderWithProviders(<Probe item={product([])} />)
    view.store.dispatch(
      localMediaAdded({ id: 'p1', items: [file('c')], baseline: 0, leading: true }),
    )

    view.rerender(<Probe item={product(['c'])} />)

    await waitFor(() =>
      expect(view.store.getState().products.localMedia.p1).toBeUndefined(),
    )
    expect(update).not.toHaveBeenCalled()
  })
})
