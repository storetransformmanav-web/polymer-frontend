import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, type UploadTarget } from '../../../lib/api/endpoints.ts'
import { sendFileToTarget } from '../../../lib/api/upload.ts'
import type { PickedFile } from '../utils/mediaFiles.ts'
import { useFileUpload } from './useFileUpload.ts'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: { products: { uploadTarget: vi.fn() } },
}))
vi.mock('../../../lib/api/upload.ts', () => ({ sendFileToTarget: vi.fn() }))

const uploadTarget = vi.mocked(api.products.uploadTarget)
const send = vi.mocked(sendFileToTarget)

const picked = (name: string): PickedFile => ({
  key: name,
  file: new File(['pixels'], name, { type: 'image/png' }),
  type: 'IMAGE',
  previewUrl: '',
})

const targetFor = (name: string): UploadTarget => ({
  uploadUrl: 'https://storage.example.com/',
  resourceUrl: `https://storage.example.com/tmp/${name}`,
  method: 'POST',
  parameters: [],
})

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const flush = () => act(async () => void (await Promise.resolve()))

describe('useFileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    send.mockResolvedValue(undefined)
  })

  it('sends a few files at the same time, not one after the other', async () => {
    const gates = new Map<string, ReturnType<typeof deferred<UploadTarget>>>()
    uploadTarget.mockImplementation((_id, file) => {
      const gate = deferred<UploadTarget>()
      gates.set(file.filename, gate)
      return gate.promise
    })
    const names = ['a.png', 'b.png', 'c.png', 'd.png', 'e.png']
    const { result } = renderHook(() => useFileUpload())

    let outcome: Promise<unknown> = Promise.resolve()
    act(() => {
      outcome = result.current.upload('p1', 'polymer-uk', names.map(picked))
    })
    await flush()

    // Only the first few have asked for an upload address; the rest wait their turn.
    expect(uploadTarget).toHaveBeenCalledTimes(3)
    expect(gates.size).toBe(3)

    // When one finishes, the next waiting file starts straight away.
    await act(async () => {
      gates.get('a.png')?.resolve(targetFor('a.png'))
      await Promise.resolve()
    })
    await flush()
    expect(uploadTarget).toHaveBeenCalledTimes(4)

    for (const name of names) {
      await act(async () => {
        gates.get(name)?.resolve(targetFor(name))
        await Promise.resolve()
      })
      await flush()
    }
    await act(async () => void (await outcome))
    expect(uploadTarget).toHaveBeenCalledTimes(names.length)
  })

  it('returns the uploaded files in the order they were chosen, whichever finished first', async () => {
    const gates = new Map<string, ReturnType<typeof deferred<UploadTarget>>>()
    uploadTarget.mockImplementation((_id, file) => {
      const gate = deferred<UploadTarget>()
      gates.set(file.filename, gate)
      return gate.promise
    })
    const { result } = renderHook(() => useFileUpload())

    let outcome!: Promise<{ items: { url: string }[]; failed: number }>
    act(() => {
      outcome = result.current.upload('p1', 'polymer-uk', [
        picked('first.png'),
        picked('second.png'),
      ]) as typeof outcome
    })
    await flush()

    // The second file is ready before the first.
    await act(async () => {
      gates.get('second.png')?.resolve(targetFor('second.png'))
      await Promise.resolve()
    })
    await act(async () => {
      gates.get('first.png')?.resolve(targetFor('first.png'))
      await Promise.resolve()
    })
    const { items, failed } = await outcome

    expect(failed).toBe(0)
    expect(items.map((item) => item.url)).toEqual([
      'https://storage.example.com/tmp/first.png',
      'https://storage.example.com/tmp/second.png',
    ])
  })

  it('lets the other files finish when one fails, and only redoes the failed one next time', async () => {
    uploadTarget.mockImplementation(async (_id, file) => {
      if (file.filename === 'bad.png') throw new Error('nope')
      return targetFor(file.filename)
    })
    const files = [picked('good1.png'), picked('bad.png'), picked('good2.png')]
    const { result } = renderHook(() => useFileUpload())

    let first!: { items: { url: string }[]; failed: number }
    await act(async () => {
      first = (await result.current.upload('p1', 'polymer-uk', files)) as typeof first
    })
    expect(first.failed).toBe(1)
    expect(first.items).toHaveLength(2)
    expect(result.current.states['bad.png'].status).toBe('failed')
    expect(result.current.states['good1.png'].status).toBe('done')

    uploadTarget.mockClear()
    uploadTarget.mockImplementation(async (_id, file) => targetFor(file.filename))
    let second!: { items: { url: string }[]; failed: number }
    await act(async () => {
      second = (await result.current.upload('p1', 'polymer-uk', files)) as typeof second
    })

    // Only the file that failed is sent again; the two that went up are not.
    expect(uploadTarget).toHaveBeenCalledTimes(1)
    expect(uploadTarget.mock.calls[0][1].filename).toBe('bad.png')
    expect(second.failed).toBe(0)
    expect(second.items.map((item) => item.url)).toEqual([
      'https://storage.example.com/tmp/good1.png',
      'https://storage.example.com/tmp/bad.png',
      'https://storage.example.com/tmp/good2.png',
    ])
  })
})
