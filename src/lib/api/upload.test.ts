import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './ApiError.ts'
import { readUploadTarget, type UploadTarget } from './endpoints.ts'
import { sendFileToTarget } from './upload.ts'

const FILE = new File(['hello'], 'photo.png', { type: 'image/png' })

const POST_TARGET: UploadTarget = {
  uploadUrl: 'https://shopify-staged-uploads.storage.googleapis.com/',
  resourceUrl: 'https://shopify-staged-uploads.storage.googleapis.com/tmp/1/photo.png',
  method: 'POST',
  parameters: [
    { name: 'key', value: 'tmp/1/photo.png' },
    { name: 'Content-Type', value: 'image/png' },
  ],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sendFileToTarget', () => {
  it('posts a multipart form: the target’s fields first, the file last, with no credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    vi.stubGlobal('fetch', fetchMock)

    await sendFileToTarget(POST_TARGET, FILE)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(POST_TARGET.uploadUrl)
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('omit')
    expect(init.referrerPolicy).toBe('no-referrer')
    // No session token is ever sent to the storage.
    expect(init.headers).toBeUndefined()
    const names = [...(init.body as FormData).keys()]
    expect(names).toEqual(['key', 'Content-Type', 'file'])
    expect((init.body as FormData).get('file')).toBeInstanceOf(File)
  })

  it('puts the file itself with its type when the target has no form fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    await sendFileToTarget({ ...POST_TARGET, method: 'PUT', parameters: [] }, FILE)

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('PUT')
    expect(init.body).toBe(FILE)
    expect(init.headers).toEqual({ 'Content-Type': 'image/png' })
    expect(init.credentials).toBe('omit')
  })

  it('says so when the storage refuses the file, or cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))
    await expect(sendFileToTarget(POST_TARGET, FILE)).rejects.toThrow(
      /refused the file \(error 403\)/,
    )

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const failure = await sendFileToTarget(POST_TARGET, FILE).catch((error) => error)
    expect(failure).toBeInstanceOf(ApiError)
    expect(failure.message).toMatch(/could not be sent/)
  })
})

describe('readUploadTarget', () => {
  it('reads a Shopify-style answer: url, resource_url and a list of parameters', () => {
    expect(
      readUploadTarget({
        url: 'https://up.example.com/',
        resource_url: 'https://up.example.com/tmp/a.png',
        parameters: [{ name: 'key', value: 'tmp/a.png' }],
      }),
    ).toEqual({
      uploadUrl: 'https://up.example.com/',
      resourceUrl: 'https://up.example.com/tmp/a.png',
      method: 'POST',
      parameters: [{ name: 'key', value: 'tmp/a.png' }],
    })
  })

  it('finds it under result / target, and reads fields given as an object and a PUT method', () => {
    expect(
      readUploadTarget({
        code: 200,
        result: {
          upload_url: 'https://up.example.com/put',
          resource_url: 'https://up.example.com/r.png',
          method: 'put',
          fields: { a: 'b', n: 2 },
        },
      }),
    ).toEqual({
      uploadUrl: 'https://up.example.com/put',
      resourceUrl: 'https://up.example.com/r.png',
      method: 'PUT',
      parameters: [
        { name: 'a', value: 'b' },
        { name: 'n', value: '2' },
      ],
    })
  })

  it('refuses an answer without an upload address and a resource address', () => {
    expect(() => readUploadTarget({ message: 'ok' })).toThrow(/did not give an address/)
    expect(() => readUploadTarget({ url: 'https://a.example.com/' })).toThrow()
  })
})
