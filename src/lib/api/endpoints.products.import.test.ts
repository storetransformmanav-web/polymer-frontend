import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './ApiError.ts'
import { apiClient } from './client.ts'
import { api } from './endpoints.ts'

vi.mock('./client.ts', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const FILE = new File(
  ['Handle,Title,Variant Price\nmop,Mop,9.99\n'],
  'products_export_all-stores.csv',
  { type: 'text/csv' },
)

describe('api.products.import (POST /products/import)', () => {
  const post = vi.mocked(apiClient.post)

  beforeEach(() => {
    post.mockReset()
  })

  it('sends the documented multipart form: the file, the store and the three choices', async () => {
    post.mockResolvedValue({ code: 200, message: 'Checked', import_id: 'imp-1' })

    await api.products.import(FILE, {
      shop: 'polymer-uk',
      dryRun: true,
      createNew: true,
      updateExisting: false,
    })

    expect(post).toHaveBeenCalledTimes(1)
    const [path, body, config] = post.mock.calls[0]
    expect(path).toBe('/products/import')
    expect(body).toBeInstanceOf(FormData)
    const form = body as FormData
    expect((form.get('file') as File).name).toBe('products_export_all-stores.csv')
    expect(form.get('shop')).toBe('polymer-uk')
    expect(form.get('dry_run')).toBe('true')
    expect(form.get('create_new')).toBe('true')
    expect(form.get('update_existing')).toBe('false')
    // Reading and planning a whole file takes longer than the usual 15 s.
    expect(config?.timeout).toBeGreaterThan(15_000)
  })

  it('sends dry_run=false when the import itself is started', async () => {
    post.mockResolvedValue({ import_id: 'imp-2' })

    await api.products.import(FILE, {
      shop: 'polymer-uk',
      dryRun: false,
      createNew: true,
      updateExisting: true,
    })

    const form = post.mock.calls[0][1] as FormData
    expect(form.get('dry_run')).toBe('false')
    expect(form.get('update_existing')).toBe('true')
  })

  it('returns the plan read from the answer — the id to follow it with, figures and skipped rows', async () => {
    post.mockResolvedValue({
      code: 202,
      status: 'Accepted',
      message: 'Import started',
      result: {
        import_id: 'imp-3',
        total_rows: 6,
        to_create: 1,
        to_update: 1,
        errors: [{ row: 4, handle: 'bad', message: 'No price' }],
      },
    })

    const plan = await api.products.import(FILE, {
      shop: 'polymer-uk',
      dryRun: false,
      createNew: true,
      updateExisting: true,
    })

    expect(plan).toEqual({
      importId: 'imp-3',
      message: 'Import started',
      counts: { total_rows: 6, to_create: 1, to_update: 1 },
      problems: [{ row: 4, handle: 'bad', message: 'No price' }],
    })
  })

  it('is never sent twice by itself, and passes a failure on with the backend’s message', async () => {
    post.mockRejectedValue(
      new ApiError('The file has no Handle column.', { status: 422 }),
    )

    await expect(
      api.products.import(FILE, {
        shop: 'polymer-uk',
        dryRun: true,
        createNew: true,
        updateExisting: true,
      }),
    ).rejects.toThrow('The file has no Handle column.')
    expect(post).toHaveBeenCalledTimes(1)
  })
})

describe('api.products.importStatus (GET /products/import/{import_id})', () => {
  const get = vi.mocked(apiClient.get)

  beforeEach(() => {
    get.mockReset()
  })

  it('asks for the import by its id and reads how far it is', async () => {
    get.mockResolvedValue({ status: 'running', processed: 3, total: 10 })

    const progress = await api.products.importStatus('imp-1')

    expect(get.mock.calls[0][0]).toBe('/products/import/imp-1')
    expect(progress).toMatchObject({ state: 'running', processed: 3, total: 10 })
  })

  it('writes an id that needs it safely into the address', async () => {
    get.mockResolvedValue({ status: 'completed' })

    await api.products.importStatus('a/b c')

    expect(get.mock.calls[0][0]).toBe('/products/import/a%2Fb%20c')
  })
})
