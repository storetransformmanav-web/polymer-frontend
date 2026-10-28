import { describe, expect, it } from 'vitest'
import {
  localMediaAdded,
  localMediaLeft,
  localMediaStatus,
  localMediaUploaded,
  productsReducer,
  type LocalMediaItem,
} from './productsSlice.ts'
import { sessionCleared } from './authSlice.ts'

const item = (key: string): LocalMediaItem => ({
  key,
  name: `${key}.png`,
  mediaType: 'IMAGE',
  previewUrl: `blob:${key}`,
  status: 'uploading',
})

const start = () =>
  productsReducer(
    undefined,
    localMediaAdded({ id: 'p1', baseline: 3, items: [item('a'), item('b')] }),
  )

describe('files chosen from the computer (localMedia)', () => {
  it('lists them at once, uploading, counted after the product’s current images', () => {
    const entry = start().localMedia.p1

    expect(entry.baseline).toBe(3)
    expect(entry.items.map((i) => [i.key, i.status])).toEqual([
      ['a', 'uploading'],
      ['b', 'uploading'],
    ])
  })

  it('keeps the older baseline when more are added while some still wait', () => {
    const state = productsReducer(
      start(),
      localMediaAdded({ id: 'p1', baseline: 9, items: [item('c')] }),
    )

    expect(state.localMedia.p1.baseline).toBe(3)
    expect(state.localMedia.p1.items).toHaveLength(3)
  })

  it('records where the store keeps an uploaded file, and moves files between states', () => {
    let state = productsReducer(
      start(),
      localMediaUploaded({
        id: 'p1',
        key: 'a',
        resourceUrl: 'https://u.example.com/a.png',
      }),
    )
    state = productsReducer(
      state,
      localMediaStatus({ id: 'p1', keys: ['a'], status: 'sent' }),
    )
    state = productsReducer(
      state,
      localMediaStatus({ id: 'p1', keys: ['b'], status: 'failed', error: 'Too big' }),
    )

    const [a, b] = state.localMedia.p1.items
    expect(a).toMatchObject({
      status: 'sent',
      resourceUrl: 'https://u.example.com/a.png',
    })
    expect(b).toMatchObject({ status: 'failed', error: 'Too big' })

    // Trying again clears the reason.
    state = productsReducer(
      state,
      localMediaStatus({ id: 'p1', keys: ['b'], status: 'uploading' }),
    )
    expect(state.localMedia.p1.items[1].error).toBeUndefined()
  })

  it('moves the baseline on when files arrive, and forgets the product when none is left', () => {
    let state = productsReducer(
      start(),
      localMediaLeft({ id: 'p1', keys: ['a'], arrived: true }),
    )
    expect(state.localMedia.p1.baseline).toBe(4)
    expect(state.localMedia.p1.items.map((i) => i.key)).toEqual(['b'])

    // Taken away by the user: not an arrival, the baseline stays.
    state = productsReducer(state, localMediaLeft({ id: 'p1', keys: ['b'] }))
    expect(state.localMedia.p1).toBeUndefined()
  })

  it('is dropped when the session ends', () => {
    expect(productsReducer(start(), sessionCleared()).localMedia).toEqual({})
  })
})
