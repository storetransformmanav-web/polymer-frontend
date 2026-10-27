import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
  type ProductDetail,
  type ProductListItem,
  type ProductListResponse,
  type ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { confirmUpdate } from '../../../test/confirmUpdate.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { ProductsPage } from './ProductsPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    products: {
      list: vi.fn(),
      details: vi.fn(),
      update: vi.fn(),
      addMedia: vi.fn(),
      uploadTarget: vi.fn(),
      removeMedia: vi.fn(),
      push: vi.fn(),
      syncHistory: vi.fn(),
    },
    auth: {},
  },
}))

const SHOP = {
  key: 'polymer-uk',
  name: 'Polymer UK',
  domain: 'polymer-uk-ltd.myshopify.com',
  currency: 'GBP',
}
const IMG_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const IMG_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const ROW = {
  shop: SHOP,
  id: 'id-1',
  shopify_id: 1,
  title: 'Hippo Bag',
  handle: 'hippo-bag',
  status: 'ACTIVE',
  vendor: 'Polymer',
  product_type: 'Bags',
  category_name: null,
  tags: [],
  image_url: null,
  price_min: '25.85',
  price_max: '25.85',
  currency: 'GBP',
  variants_count: 0,
  total_inventory: 5,
  shopify_created_at: null,
  shopify_updated_at: null,
  synced_at: '2026-01-01T00:00:00Z',
} satisfies ProductListItem

function product(images: { id: string; url: string; alt: string }[]) {
  return {
    shop: SHOP,
    id: 'id-1',
    shopify_id: 1,
    title: 'Hippo Bag',
    handle: 'hippo-bag',
    description_html: '',
    status: 'ACTIVE',
    vendor: 'Polymer',
    product_type: 'Bags',
    category: null,
    tags: [],
    template_suffix: '',
    seo: { title: null, description: null },
    currency: 'GBP',
    price_range: { min: '25.85', max: '25.85', currency: 'GBP' },
    compare_at_price_range: null,
    featured_image_url: null,
    total_inventory: 5,
    variants_count: 0,
    options: [],
    images: images.map((image, i) => ({
      id: image.id,
      url: image.url,
      alt_text: image.alt,
      position: i + 1,
      media_type: 'IMAGE',
    })),
    variants: [],
    collections: [],
    metafields: [],
  } as unknown as ProductDetail
}

const TWO_IMAGES = [
  { id: IMG_1, url: 'https://cdn.example.com/1.jpg', alt: 'One' },
  { id: IMG_2, url: 'https://cdn.example.com/2.jpg', alt: 'Two' },
]

const LIST: ProductListResponse = {
  items: [ROW],
  page: 1,
  page_size: 25,
  total: 1,
  total_pages: 1,
  has_next: false,
  sort: 'created_at',
  order: 'desc',
}

const WRITE_OK: ProductWriteResult = {
  product_id: 'id-1',
  sync_status: 'pending',
  push_id: 'push-1',
  changes: null,
  message: 'Media queued for Shopify',
}

const list = vi.mocked(api.products.list)
const details = vi.mocked(api.products.details)
const addMedia = vi.mocked(api.products.addMedia)
const removeMedia = vi.mocked(api.products.removeMedia)
const syncHistory = vi.mocked(api.products.syncHistory)
const never = () => new Promise<never>(() => undefined)

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/products/*" element={<ProductsPage />} />
    </Routes>,
    { route: '/products/id-1' },
  )
}

describe('adding and deleting media', () => {
  beforeEach(() => {
    list.mockResolvedValue(LIST)
    details.mockResolvedValue(product(TWO_IMAGES))
    addMedia.mockResolvedValue(WRITE_OK)
    removeMedia.mockResolvedValue({ ...WRITE_OK, message: 'Media removal queued' })
    syncHistory.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  async function openMediaTab() {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Hippo Bag' })
    await user.click(screen.getByRole('tab', { name: /^Media/ }))
    return user
  }

  it('shows how many images there are, with the pencil and Add media together in one row', async () => {
    await openMediaTab()

    expect(await screen.findByText('2 images')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit media' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add media' })).toBeInTheDocument()
  })

  describe('Add media', () => {
    async function openDialog() {
      const user = await openMediaTab()
      await user.click(await screen.findByRole('button', { name: 'Add media' }))
      return { user, dialog: await screen.findByRole('dialog', { name: 'Add media' }) }
    }

    it('warns, without blocking, that a placehold.co address without an extension gives an SVG', async () => {
      const { user, dialog } = await openDialog()
      await user.type(
        within(dialog).getByLabelText('Web address'),
        'https://placehold.co/600x600?text=Small+Carrier+Bag',
      )

      expect(
        await within(dialog).findByText(/gives an SVG/, undefined, { timeout: 3000 }),
      ).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Add to product' })).toBeEnabled()
    })

    it('opens a form with the cursor in the first address, and sends nothing yet', async () => {
      const { dialog } = await openDialog()

      expect(within(dialog).getByLabelText('Web address')).toHaveFocus()
      expect(addMedia).not.toHaveBeenCalled()
    })

    it('sends the files to POST /media for the product’s store, then shows them as processing', async () => {
      const { user, dialog } = await openDialog()
      await user.type(
        within(dialog).getByLabelText('Web address'),
        'https://cdn.example.com/new.jpg',
      )
      await user.type(within(dialog).getByLabelText(/^Alt text/), 'Fresh')
      await user.click(within(dialog).getByRole('button', { name: 'Add to product' }))

      await waitFor(() =>
        expect(addMedia).toHaveBeenCalledWith(
          'id-1',
          [{ url: 'https://cdn.example.com/new.jpg', alt: 'Fresh', media_type: 'IMAGE' }],
          'polymer-uk',
        ),
      )
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      // Not in the product yet (the store is still downloading it): a processing tile stands in.
      expect(await screen.findByLabelText('Processing')).toBeInTheDocument()
      expect(screen.getByText('Processing…')).toBeInTheDocument()
      expect(await screen.findByText(/Media queued for Shopify/)).toBeInTheDocument()
    })

    it('adds several files at once', async () => {
      const { user, dialog } = await openDialog()
      await user.type(
        within(dialog).getByLabelText('Web address'),
        'https://cdn.example.com/a.jpg',
      )
      await user.click(within(dialog).getByRole('button', { name: 'Add another file' }))
      const addresses = within(dialog).getAllByLabelText('Web address')
      await user.type(addresses[1], 'https://cdn.example.com/b.jpg')
      await user.click(within(dialog).getByRole('button', { name: 'Add to product' }))

      await waitFor(() => expect(addMedia).toHaveBeenCalledTimes(1))
      expect(addMedia.mock.calls[0][1]).toHaveLength(2)
    })

    it('checks the addresses first: https only, and at least one', async () => {
      const { user, dialog } = await openDialog()
      await user.click(within(dialog).getByRole('button', { name: 'Add to product' }))
      expect(await within(dialog).findByText(/at least one file/)).toBeInTheDocument()

      await user.type(
        within(dialog).getByLabelText('Web address'),
        'http://insecure.example.com/a.jpg',
      )
      await user.click(within(dialog).getByRole('button', { name: 'Add to product' }))
      expect(
        await within(dialog).findByText('Use a public https:// address'),
      ).toBeInTheDocument()
      expect(addMedia).not.toHaveBeenCalled()
    })

    it('keeps the form open with the backend’s message when it fails', async () => {
      addMedia.mockRejectedValue(
        new ApiError('Shopify cannot reach that address.', { status: 422 }),
      )
      const { user, dialog } = await openDialog()
      await user.type(
        within(dialog).getByLabelText('Web address'),
        'https://cdn.example.com/a.jpg',
      )
      await user.click(within(dialog).getByRole('button', { name: 'Add to product' }))

      expect(
        await within(dialog).findByText('Shopify cannot reach that address.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('dialog', { name: 'Add media' })).toBeInTheDocument()
      expect(within(dialog).getByLabelText('Web address')).toHaveValue(
        'https://cdn.example.com/a.jpg',
      )
      expect(screen.queryByLabelText('Processing')).not.toBeInTheDocument()
    })

    it('locks the form while it is sending, so it cannot go twice', async () => {
      addMedia.mockImplementation(never)
      const { user, dialog } = await openDialog()
      await user.type(
        within(dialog).getByLabelText('Web address'),
        'https://cdn.example.com/a.jpg',
      )
      await user.click(within(dialog).getByRole('button', { name: 'Add to product' }))

      await waitFor(() =>
        expect(
          within(dialog).getByRole('button', { name: 'Add to product' }),
        ).toBeDisabled(),
      )
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
      expect(addMedia).toHaveBeenCalledTimes(1)
    })

    describe('upload from your computer', () => {
      const uploadTarget = vi.mocked(api.products.uploadTarget)
      const TARGET = {
        uploadUrl: 'https://shopify-staged-uploads.storage.googleapis.com/',
        resourceUrl:
          'https://shopify-staged-uploads.storage.googleapis.com/tmp/1/photo.png',
        method: 'POST' as const,
        parameters: [{ name: 'key', value: 'tmp/1/photo.png' }],
      }
      const fetchMock = vi.fn()

      beforeEach(() => {
        uploadTarget.mockResolvedValue(TARGET)
        fetchMock.mockResolvedValue({ ok: true, status: 204 })
        vi.stubGlobal('fetch', fetchMock)
      })
      afterEach(() => {
        vi.unstubAllGlobals()
        fetchMock.mockReset()
      })

      const choose = (dialog: HTMLElement) =>
        within(dialog).getByLabelText('Choose files from your computer')
      const PHOTO = () => new File(['pixels'], 'photo.png', { type: 'image/png' })

      it('lists a chosen file with its type and size, and sends nothing until Add to product', async () => {
        const { user, dialog } = await openDialog()

        await user.upload(choose(dialog), PHOTO())

        const list = within(dialog).getByRole('list', { name: 'Files to upload' })
        expect(within(list).getByText('photo.png')).toBeInTheDocument()
        expect(within(list).getByText(/Image · 1 KB/)).toBeInTheDocument()
        expect(uploadTarget).not.toHaveBeenCalled()
        expect(fetchMock).not.toHaveBeenCalled()
        expect(addMedia).not.toHaveBeenCalled()
      })

      it('uploads the file, then attaches the store’s resource address as a new image', async () => {
        const { user, dialog } = await openDialog()
        await user.upload(choose(dialog), PHOTO())
        await user.click(within(dialog).getByRole('button', { name: 'Add to product' }))

        await waitFor(() => expect(addMedia).toHaveBeenCalledTimes(1))
        expect(uploadTarget).toHaveBeenCalledWith(
          'id-1',
          {
            filename: 'photo.png',
            mime_type: 'image/png',
            file_size: 6,
            media_type: 'IMAGE',
          },
          'polymer-uk',
        )
        // The file went to the storage address, as a form with the target's fields first.
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe(TARGET.uploadUrl)
        expect([...(init.body as FormData).keys()]).toEqual(['key', 'file'])
        // And it is attached by its resource address — the empty address row adds nothing.
        expect(addMedia).toHaveBeenCalledWith(
          'id-1',
          [{ url: TARGET.resourceUrl, media_type: 'IMAGE' }],
          'polymer-uk',
        )
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(await screen.findByLabelText('Processing')).toBeInTheDocument()
      })

      it('adds uploaded files together with typed addresses, in one request', async () => {
        const { user, dialog } = await openDialog()
        await user.upload(choose(dialog), PHOTO())
        await user.type(
          within(dialog).getByLabelText('Web address'),
          'https://cdn.example.com/a.jpg',
        )
        await user.click(within(dialog).getByRole('button', { name: 'Add to product' }))

        await waitFor(() => expect(addMedia).toHaveBeenCalledTimes(1))
        expect(addMedia).toHaveBeenCalledWith(
          'id-1',
          [
            { url: 'https://cdn.example.com/a.jpg', media_type: 'IMAGE' },
            { url: TARGET.resourceUrl, media_type: 'IMAGE' },
          ],
          'polymer-uk',
        )
      })

      it('refuses a file over its limit, by the file’s name, and keeps the good ones', async () => {
        const { user, dialog } = await openDialog()
        await user.upload(choose(dialog), PHOTO())

        const big = new File(['x'], 'big.png', { type: 'image/png' })
        Object.defineProperty(big, 'size', { value: 25 * 1024 * 1024 })
        await user.upload(choose(dialog), big)

        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
          'big.png — This image is 25.0 MB; the most is 20.0 MB.',
        )
        const list = within(dialog).getByRole('list', { name: 'Files to upload' })
        expect(within(list).getByText('photo.png')).toBeInTheDocument()
        expect(within(list).queryByText('big.png')).not.toBeInTheDocument()
      })

      it('uploads a .jfif picture as a .jpg (it is a JPEG)', async () => {
        const { user, dialog } = await openDialog()
        await user.upload(
          choose(dialog),
          new File(['pixels'], 'download (1).jfif', { type: 'image/jpeg' }),
        )
        expect(within(dialog).getByText('download (1).jfif')).toBeInTheDocument()
        await user.click(within(dialog).getByRole('button', { name: 'Add to product' }))

        await waitFor(() => expect(addMedia).toHaveBeenCalledTimes(1))
        expect(uploadTarget).toHaveBeenCalledWith(
          'id-1',
          {
            filename: 'download (1).jpg',
            mime_type: 'image/jpeg',
            file_size: 6,
            media_type: 'IMAGE',
          },
          'polymer-uk',
        )
        const form = fetchMock.mock.calls[0][1].body as FormData
        expect((form.get('file') as File).name).toBe('download (1).jpg')
      })

      it('removes a chosen file before sending', async () => {
        const { user, dialog } = await openDialog()
        await user.upload(choose(dialog), PHOTO())

        await user.click(within(dialog).getByRole('button', { name: 'Remove photo.png' }))

        expect(within(dialog).queryByText('photo.png')).not.toBeInTheDocument()
      })

      it('adds nothing when a file fails to upload, says which, and does not send the others twice on retry', async () => {
        uploadTarget
          .mockResolvedValueOnce(TARGET)
          .mockRejectedValueOnce(new ApiError('Storage is full.', { status: 500 }))
        const { user, dialog } = await openDialog()
        await user.upload(choose(dialog), [
          PHOTO(),
          new File(['more'], 'second.jpg', { type: 'image/jpeg' }),
        ])
        await user.click(within(dialog).getByRole('button', { name: 'Add to product' }))

        expect(await within(dialog).findByText('Storage is full.')).toBeInTheDocument()
        expect(
          within(dialog).getByText(/1 file could not be uploaded/),
        ).toBeInTheDocument()
        expect(addMedia).not.toHaveBeenCalled()
        expect(screen.getByRole('dialog', { name: 'Add media' })).toBeInTheDocument()

        // Trying again only redoes the failed file.
        uploadTarget.mockResolvedValueOnce({
          ...TARGET,
          resourceUrl:
            'https://shopify-staged-uploads.storage.googleapis.com/tmp/2/second.jpg',
        })
        await user.click(within(dialog).getByRole('button', { name: 'Add to product' }))

        await waitFor(() => expect(addMedia).toHaveBeenCalledTimes(1))
        expect(uploadTarget).toHaveBeenCalledTimes(3)
        expect(addMedia.mock.calls[0][1]).toEqual([
          { url: TARGET.resourceUrl, media_type: 'IMAGE' },
          {
            url: 'https://shopify-staged-uploads.storage.googleapis.com/tmp/2/second.jpg',
            media_type: 'IMAGE',
          },
        ])
      })

      it('shows the storage’s refusal as the file’s own error', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 403 })
        const { user, dialog } = await openDialog()
        await user.upload(choose(dialog), PHOTO())
        await user.click(within(dialog).getByRole('button', { name: 'Add to product' }))

        expect(
          await within(dialog).findByText(/The store refused the file \(error 403\)/),
        ).toBeInTheDocument()
        expect(addMedia).not.toHaveBeenCalled()
      })
    })

    it('closes on Cancel without sending anything', async () => {
      const { user, dialog } = await openDialog()
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(addMedia).not.toHaveBeenCalled()
    })
  })

  describe('Delete', () => {
    async function askToDelete(position = 2) {
      const user = await openMediaTab()
      await user.click(
        await screen.findByRole('button', { name: `Delete image ${position}` }),
      )
      return {
        user,
        dialog: await screen.findByRole('alertdialog', {
          name: `Delete image ${position}?`,
        }),
      }
    }

    it('gives every image a Delete button, which asks first and sends nothing yet', async () => {
      const { dialog } = await askToDelete()

      expect(screen.getByRole('button', { name: 'Delete image 1' })).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
      expect(removeMedia).not.toHaveBeenCalled()
    })

    it('removes that image through DELETE /media/{id} and it disappears at once', async () => {
      const { user, dialog } = await askToDelete(2)
      // The refetch hasn't answered: what shows is the instant update.
      details.mockImplementation(never)
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

      await waitFor(() =>
        expect(removeMedia).toHaveBeenCalledWith('id-1', IMG_2, 'polymer-uk'),
      )
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(await screen.findByText('1 image')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Delete image 2' }),
      ).not.toBeInTheDocument()
      expect(await screen.findByText(/Media removal queued/)).toBeInTheDocument()
    })

    it('stays deleted when the backend still lists the image right after (the delete is only queued)', async () => {
      const { user, dialog } = await askToDelete(2)
      // The store hasn't processed the delete: the re-read still returns both images.
      details.mockResolvedValue(product(TWO_IMAGES))
      details.mockClear()
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

      await waitFor(() => expect(details).toHaveBeenCalled())
      await waitFor(() => expect(syncHistory).toHaveBeenCalled())
      expect(await screen.findByText('1 image')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Delete image 2' }),
      ).not.toBeInTheDocument()
    })

    it('keeps it gone when the tab is left and reopened while the store is still busy', async () => {
      const { user, dialog } = await askToDelete(2)
      details.mockResolvedValue(product(TWO_IMAGES))
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
      expect(await screen.findByText('1 image')).toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: /^Overview/ }))
      await user.click(screen.getByRole('tab', { name: /^Media/ }))

      expect(await screen.findByText('1 image')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Delete image 2' }),
      ).not.toBeInTheDocument()
    })

    it('does nothing on Cancel or Escape', async () => {
      const { user, dialog } = await askToDelete()
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Delete image 1' }))
      await screen.findByRole('alertdialog')
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(removeMedia).not.toHaveBeenCalled()
      expect(screen.getByText('2 images')).toBeInTheDocument()
    })

    it('keeps the dialog open and shows the backend’s message when it fails', async () => {
      removeMedia.mockRejectedValue(new ApiError('Image not found.', { status: 404 }))
      const { user, dialog } = await askToDelete()
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

      expect(await within(dialog).findByText('Image not found.')).toBeInTheDocument()
      expect(screen.getByText('2 images')).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeEnabled()
    })
  })

  describe('when image ids change in the store', () => {
    // The store re-syncs a product after a change and can give its images new ids.
    const NEW_2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    const RENAMED = [TWO_IMAGES[0], { ...TWO_IMAGES[1], id: NEW_2 }]
    const unknown = (attachment: string) =>
      new ApiError(`Image ${attachment} is not an image of this product.`, {
        status: 422,
      })

    async function askToDelete() {
      const user = await openMediaTab()
      await user.click(await screen.findByRole('button', { name: 'Delete image 2' }))
      return {
        user,
        dialog: await screen.findByRole('alertdialog', { name: 'Delete image 2?' }),
      }
    }

    it('reads the current ids as the dialog opens and deletes by the new one', async () => {
      removeMedia.mockImplementation(async (_id, attachment) => {
        if (attachment !== NEW_2) throw unknown(attachment)
        return { ...WRITE_OK, message: 'Media removal queued' }
      })
      const { user, dialog } = await askToDelete()
      // The cached copy still has the old id; the refresh that opens the dialog brings the new one.
      details.mockResolvedValue(product(RENAMED))
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      await user.click(screen.getByRole('button', { name: 'Delete image 2' }))
      const reopened = await screen.findByRole('alertdialog', { name: 'Delete image 2?' })
      await waitFor(() => expect(details.mock.calls.length).toBeGreaterThanOrEqual(3))
      await user.click(within(reopened).getByRole('button', { name: 'Delete' }))

      await waitFor(() =>
        expect(removeMedia).toHaveBeenLastCalledWith('id-1', NEW_2, 'polymer-uk'),
      )
      expect(await screen.findByText(/Media removal queued/)).toBeInTheDocument()
    })

    it('retries once with the current id when the backend does not know the old one', async () => {
      removeMedia.mockImplementation(async (_id, attachment) => {
        if (attachment !== NEW_2) throw unknown(attachment)
        return { ...WRITE_OK, message: 'Media removal queued' }
      })
      // Opening the page and the dialog still show the old id; the re-read after the rejection shows the new one.
      let reads = 0
      details.mockImplementation(async () => product(++reads <= 2 ? TWO_IMAGES : RENAMED))
      const { user, dialog } = await askToDelete()
      await waitFor(() => expect(details).toHaveBeenCalledTimes(2))
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

      await waitFor(() => expect(removeMedia).toHaveBeenCalledTimes(2))
      expect(removeMedia).toHaveBeenNthCalledWith(1, 'id-1', IMG_2, 'polymer-uk')
      expect(removeMedia).toHaveBeenNthCalledWith(2, 'id-1', NEW_2, 'polymer-uk')
      expect(await screen.findByText(/Media removal queued/)).toBeInTheDocument()
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('says so when the image is no longer on the product, without retrying', async () => {
      removeMedia.mockRejectedValue(unknown(IMG_2))
      let reads = 0
      details.mockImplementation(async () =>
        product(++reads <= 2 ? TWO_IMAGES : [TWO_IMAGES[0]]),
      )
      const { user, dialog } = await askToDelete()
      await waitFor(() => expect(details).toHaveBeenCalledTimes(2))
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

      expect(
        await within(dialog).findByText(/no longer on this product/),
      ).toBeInTheDocument()
      expect(removeMedia).toHaveBeenCalledTimes(1)
    })

    it('does not retry for any other failure', async () => {
      removeMedia.mockRejectedValue(
        new ApiError('The server ran into a problem.', { status: 500 }),
      )
      const { user, dialog } = await askToDelete()
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

      expect(
        await within(dialog).findByText('The server ran into a problem.'),
      ).toBeInTheDocument()
      expect(removeMedia).toHaveBeenCalledTimes(1)
    })
  })

  describe('which images belong to the product and which also to variants', () => {
    it('marks an image that is a variant’s picture, and the rest as product images', async () => {
      const withVariants = product(TWO_IMAGES)
      withVariants.variants = [
        {
          id: 'v1',
          shopify_id: 1,
          title: 'Small',
          price: '5.00',
          // Matches image 2 by file, ignoring the cache-busting query.
          image_url: 'https://cdn.example.com/2.jpg?v=5',
          inventory_levels: [],
          metafields: [],
        },
      ] as unknown as typeof withVariants.variants
      details.mockResolvedValue(withVariants)
      await openMediaTab()

      expect(await screen.findByText('Variant: Small')).toBeInTheDocument()
      expect(screen.getAllByText('Product image')).toHaveLength(1)
    })
  })

  describe('editing the media in place', () => {
    it('saves an alt-text edit as media_update only — the API field, nothing else', async () => {
      const updateMock = vi.mocked(api.products.update)
      updateMock.mockResolvedValue(WRITE_OK)
      const user = await openMediaTab()
      await user.click(await screen.findByRole('button', { name: 'Edit media' }))

      const alt = screen.getByLabelText('Alt text', {
        selector: `#edit-image-alt-${IMG_1}`,
      })
      await user.clear(alt)
      await user.type(alt, 'A red bag')
      await user.click(screen.getByRole('button', { name: 'Save media' }))
      await confirmUpdate(user)

      await waitFor(() =>
        expect(updateMock).toHaveBeenCalledWith(
          'id-1',
          { media_update: [{ attachment_id: IMG_1, alt: 'A red bag' }] },
          'polymer-uk',
        ),
      )
    })

    it('sends no order or file fields for an alt-text edit, and nothing when alt is unchanged', async () => {
      const updateMock = vi.mocked(api.products.update)
      updateMock.mockResolvedValue(WRITE_OK)
      const user = await openMediaTab()
      await user.click(await screen.findByRole('button', { name: 'Edit media' }))
      const alt = screen.getByLabelText('Alt text', {
        selector: `#edit-image-alt-${IMG_2}`,
      })
      await user.type(alt, '!')
      await user.click(screen.getByRole('button', { name: 'Save media' }))
      await confirmUpdate(user)

      await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
      const body = updateMock.mock.calls[0][1]
      expect(Object.keys(body)).toEqual(['media_update'])
    })

    it('is only for alt text and order now — no add or remove inside it', async () => {
      const user = await openMediaTab()
      await user.click(await screen.findByRole('button', { name: 'Edit media' }))

      expect(
        screen.getByRole('button', { name: 'Move image 1 down' }),
      ).toBeInTheDocument()
      expect(
        screen.getByLabelText('Alt text', { selector: `#edit-image-alt-${IMG_1}` }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /^Remove image/ }),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Add media' })).not.toBeInTheDocument()
    })
  })
})

describe('files the store has not finished downloading', () => {
  const NEW_URL = 'https://cdn.example.com/new.jpg'

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    list.mockResolvedValue(LIST)
    details.mockResolvedValue(product([]))
    addMedia.mockResolvedValue(WRITE_OK)
    syncHistory.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  async function addOne() {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Hippo Bag' })
    await user.click(screen.getByRole('tab', { name: /^Media/ }))
    await user.click(await screen.findByRole('button', { name: 'Add media' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add media' })
    await user.type(within(dialog).getByLabelText('Web address'), NEW_URL)
    await user.click(within(dialog).getByRole('button', { name: 'Add to product' }))
    await screen.findByLabelText('Processing')
    return user
  }

  it('counts them in the header instead of saying "No images"', async () => {
    await addOne()

    expect(screen.getByText('1 processing')).toBeInTheDocument()
    expect(screen.queryByText('No images')).not.toBeInTheDocument()
  })

  it('stay on screen when the tab is left and come back, and are not dropped when the store is slow', async () => {
    const user = await addOne()

    await user.click(screen.getByRole('tab', { name: /^Overview/ }))
    await user.click(screen.getByRole('tab', { name: /^Media/ }))
    expect(await screen.findByLabelText('Processing')).toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(65_000))
    expect(screen.getByLabelText('Processing')).toBeInTheDocument()
    expect(await screen.findByText(/taking longer than usual/)).toBeInTheDocument()
    expect(screen.getByText('Still waiting for the store')).toBeInTheDocument()
  })

  it('look for the image less often once the store is slow', async () => {
    await addOne()
    await act(() => vi.advanceTimersByTimeAsync(61_000))
    details.mockClear()

    await act(() => vi.advanceTimersByTimeAsync(32_000))

    // Every 16 s rather than every 4 s.
    expect(details.mock.calls.length).toBeLessThanOrEqual(3)
    expect(details.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('are replaced by the image once it arrives, and the notice goes', async () => {
    await addOne()
    await act(() => vi.advanceTimersByTimeAsync(65_000))
    expect(await screen.findByText(/taking longer than usual/)).toBeInTheDocument()

    details.mockResolvedValue(
      product([{ id: 'img-new', url: 'https://cdn.shopify.com/new.jpg', alt: 'New' }]),
    )
    await act(() => vi.advanceTimersByTimeAsync(17_000))

    await waitFor(() =>
      expect(screen.queryByLabelText('Processing')).not.toBeInTheDocument(),
    )
    expect(screen.queryByText(/taking longer than usual/)).not.toBeInTheDocument()
    expect(screen.getByText('1 image')).toBeInTheDocument()
  })

  it('look for the image every couple of seconds at first, so it shows as soon as it is ready', async () => {
    await addOne()

    details.mockResolvedValue(
      product([{ id: 'img-new', url: 'https://cdn.shopify.com/new.jpg', alt: 'New' }]),
    )
    await act(() => vi.advanceTimersByTimeAsync(2200))

    await waitFor(() =>
      expect(screen.queryByLabelText('Processing')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('1 image')).toBeInTheDocument()
  })

  it('read the products list again when the image arrives, so its row gets the image too', async () => {
    await addOne()
    list.mockClear()

    details.mockResolvedValue(
      product([{ id: 'img-new', url: 'https://cdn.shopify.com/new.jpg', alt: 'New' }]),
    )
    await act(() => vi.advanceTimersByTimeAsync(4100))

    await waitFor(() =>
      expect(screen.queryByLabelText('Processing')).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(list).toHaveBeenCalled())
  })

  it('can be dismissed', async () => {
    const user = await addOne()
    await act(() => vi.advanceTimersByTimeAsync(65_000))

    await user.click(await screen.findByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByLabelText('Processing')).not.toBeInTheDocument()
    expect(screen.getByText('No images')).toBeInTheDocument()
  })
})
