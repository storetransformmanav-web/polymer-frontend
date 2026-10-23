import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client.ts'
import { api } from './endpoints.ts'

vi.mock('./client.ts', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('api.users.remove', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends DELETE /users/{user_id} and passes on the answer’s message', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ code: 200, message: 'User deleted' })

    const result = await api.users.remove('6f1c2a52-2c4e-4d0a-9d1a-0a7a7f5d9b11')

    expect(apiClient.delete).toHaveBeenCalledWith(
      '/users/6f1c2a52-2c4e-4d0a-9d1a-0a7a7f5d9b11',
    )
    expect(result).toEqual({ message: 'User deleted' })
  })

  it('accepts any answer — the spec gives none', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
    expect(await api.users.remove('abc')).toEqual({ message: '' })

    vi.mocked(apiClient.delete).mockResolvedValue('')
    expect(await api.users.remove('abc')).toEqual({ message: '' })
  })

  it('encodes the id in the path', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({})
    await api.users.remove('a/b')
    expect(apiClient.delete).toHaveBeenCalledWith('/users/a%2Fb')
  })
})
