import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client.ts'
import { api } from './endpoints.ts'

vi.mock('./client.ts', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const get = vi.mocked(apiClient.get)
const post = vi.mocked(apiClient.post)

beforeEach(() => {
  get.mockReset()
  post.mockReset()
})

describe('GET /customers/export (api.customers.export)', () => {
  it('asks for a CSV with the given query and returns its text', async () => {
    get.mockResolvedValue('Email\na@example.com\n')

    await expect(api.customers.export({ role: 'all', shop: 'polymer-uk' })).resolves.toBe(
      'Email\na@example.com\n',
    )

    expect(get).toHaveBeenCalledWith(
      '/customers/export',
      expect.objectContaining({
        params: { role: 'all', shop: 'polymer-uk' },
        headers: { Accept: 'text/csv, application/json;q=0.5' },
      }),
    )
  })

  it('refuses an answer that is not a file, with the backend’s message', async () => {
    get.mockResolvedValue({ message: 'No customers.' })
    await expect(api.customers.export({})).rejects.toThrow('No customers.')

    get.mockResolvedValue('  ')
    await expect(api.customers.export({})).rejects.toThrow(
      'The server did not send a file.',
    )
  })
})

describe('POST /customers/import (api.customers.import)', () => {
  it('sends the file and the choices as a form, and reads the plan', async () => {
    post.mockResolvedValue({
      message: 'Checked.',
      result: {
        import_id: 'imp-1',
        to_create: 2,
        errors: [{ row: 3, email: 'bad@example.com', message: 'Invalid phone' }],
      },
    })
    const file = new File(['Email\n'], 'customers.csv', { type: 'text/csv' })

    const plan = await api.customers.import(file, {
      shop: 'polymer-uk',
      dryRun: true,
      createNew: true,
      updateExisting: false,
    })

    const [path, form] = post.mock.calls[0]
    expect(path).toBe('/customers/import')
    const sent = form as FormData
    expect((sent.get('file') as File).name).toBe('customers.csv')
    expect(sent.get('shop')).toBe('polymer-uk')
    expect(sent.get('dry_run')).toBe('true')
    expect(sent.get('create_new')).toBe('true')
    expect(sent.get('update_existing')).toBe('false')

    expect(plan.importId).toBe('imp-1')
    expect(plan.counts).toEqual({ to_create: 2 })
    expect(plan.problems).toEqual([
      { row: 3, handle: 'bad@example.com', message: 'Invalid phone' },
    ])
  })

  it('follows a started import by its id', async () => {
    get.mockResolvedValue({ status: 'completed', processed: 2, total: 2 })

    const progress = await api.customers.importStatus('imp/1')

    expect(get).toHaveBeenCalledWith('/customers/import/imp%2F1')
    expect(progress.state).toBe('done')
  })
})
