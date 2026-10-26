import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  api,
  type ProductDetail,
  type ProductMediaInput,
  type ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { useProductMedia } from './useProductMedia.ts'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    products: {
      addMedia: vi.fn(),
      removeMedia: vi.fn(),
      details: vi.fn(),
      list: vi.fn(),
      syncHistory: vi.fn(),
    },
    auth: {},
  },
}))

const PRODUCT = {
  id: 'id-1',
  title: 'Hippo Bag',
  shop: { key: 'polymer-uk', name: 'Polymer UK', domain: 'x.myshopify.com' },
  images: [],
} as unknown as ProductDetail

const ITEMS: ProductMediaInput[] = [
  { url: 'https://cdn.example.com/new.jpg', media_type: 'IMAGE' },
]

const OK: ProductWriteResult = {
  product_id: 'id-1',
  sync_status: 'pending',
  push_id: 'push-1',
  changes: null,
  message: 'Media queued for Shopify',
}

const addMedia = vi.mocked(api.products.addMedia)

/** Calls `add` twice in the very same moment, like a double click or Enter pressed twice. */
function Twice() {
  const media = useProductMedia(PRODUCT)
  return (
    <button
      type="button"
      onClick={() => {
        void media.add(ITEMS)
        void media.add(ITEMS)
      }}
    >
      go
    </button>
  )
}

describe('useProductMedia', () => {
  beforeEach(() => {
    vi.mocked(api.products.details).mockImplementation(() => new Promise(() => undefined))
    vi.mocked(api.products.list).mockImplementation(() => new Promise(() => undefined))
    vi.mocked(api.products.syncHistory).mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sends the files once, however fast the button is pressed again', async () => {
    addMedia.mockResolvedValue(OK)
    renderWithProviders(<Twice />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'go' }))

    await waitFor(() => expect(addMedia).toHaveBeenCalledTimes(1))
    expect(addMedia).toHaveBeenCalledWith('id-1', ITEMS, 'polymer-uk')
  })

  it('can send again once the first request has finished', async () => {
    addMedia.mockResolvedValue(OK)
    renderWithProviders(<Twice />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'go' }))
    await waitFor(() => expect(addMedia).toHaveBeenCalledTimes(1))
    // Let the first request settle, then press again.
    await new Promise((resolve) => setTimeout(resolve, 20))
    await user.click(screen.getByRole('button', { name: 'go' }))

    await waitFor(() => expect(addMedia).toHaveBeenCalledTimes(2))
  })
})
