import { describe, expect, it } from 'vitest'
import { ApiError } from '../lib/api/ApiError.ts'
import { shouldRetry } from './queryClient.ts'

describe('shouldRetry', () => {
  it('never retries a client error — asking again gets the same answer', () => {
    for (const status of [400, 401, 403, 404, 422, 429]) {
      expect(shouldRetry(0, new ApiError('no', { status }))).toBe(false)
    }
  })

  it('retries a server error or a dropped connection once', () => {
    expect(shouldRetry(0, new ApiError('down', { status: 503 }))).toBe(true)
    expect(shouldRetry(0, new ApiError('offline', { code: 'ERR_NETWORK' }))).toBe(true)
    expect(shouldRetry(1, new ApiError('down', { status: 503 }))).toBe(false)
  })

  it('retries an unexpected (non-API) error once', () => {
    expect(shouldRetry(0, new Error('boom'))).toBe(true)
    expect(shouldRetry(1, new Error('boom'))).toBe(false)
  })
})
