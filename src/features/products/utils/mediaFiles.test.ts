import { describe, expect, it } from 'vitest'
import { FILE_ACCEPT, checkFile, formatBytes, mimeOf, pickFiles } from './mediaFiles.ts'

const MB = 1024 * 1024
/** A File that reports a size without holding that many bytes. */
function sized(name: string, size: number): File {
  const made = new File(['x'], name)
  Object.defineProperty(made, 'size', { value: size })
  return made
}

describe('checkFile', () => {
  it('takes every image, video and 3D type the store lists, in any case', () => {
    const images = [
      'a.jpg',
      'a.JPEG',
      'a.png',
      'a.webp',
      'a.gif',
      'a.svg',
      'a.heic',
      'a.tif',
      'a.TIFF',
      'a.bmp',
    ]
    for (const name of images)
      expect(checkFile(sized(name, 10))).toEqual({ type: 'IMAGE' })
    for (const name of ['a.mp4', 'a.mov', 'a.webm']) {
      expect(checkFile(sized(name, 10))).toEqual({ type: 'VIDEO' })
    }
    for (const name of ['a.glb', 'a.usdz']) {
      expect(checkFile(sized(name, 10))).toEqual({ type: 'MODEL_3D' })
    }
  })

  it('refuses other types, files without a type, and empty files', () => {
    expect(checkFile(sized('notes.pdf', 10))).toEqual({
      problem: ".pdf files can't be added. Use an image, video or 3D model.",
    })
    expect(checkFile(sized('README', 10))).toHaveProperty('problem')
    expect(checkFile(sized('a.png', 0))).toEqual({ problem: 'The file is empty.' })
  })

  it('holds each kind to its size limit: 20 MB, 1 GB and 500 MB', () => {
    expect(checkFile(sized('a.png', 20 * MB))).toEqual({ type: 'IMAGE' })
    expect(checkFile(sized('a.png', 25 * MB))).toEqual({
      problem: 'This image is 25.0 MB; the most is 20.0 MB.',
    })
    expect(checkFile(sized('a.png', 20 * MB + 1))).toHaveProperty('problem')
    expect(checkFile(sized('a.mp4', 1024 * MB))).toEqual({ type: 'VIDEO' })
    expect(checkFile(sized('a.mp4', 1024 * MB + 1))).toHaveProperty('problem')
    expect(checkFile(sized('a.glb', 500 * MB))).toEqual({ type: 'MODEL_3D' })
    expect(checkFile(sized('a.glb', 500 * MB + 1))).toHaveProperty('problem')
  })
})

describe('pickFiles', () => {
  const preview = () => 'blob:preview'

  it('keeps the good files, with their type, and says what is wrong with the others', () => {
    const { picked, problems } = pickFiles(
      [sized('a.png', 10), sized('b.exe', 10), sized('c.mp4', 10)],
      [],
      20,
      preview,
    )

    expect(picked.map((item) => [item.file.name, item.type])).toEqual([
      ['a.png', 'IMAGE'],
      ['c.mp4', 'VIDEO'],
    ])
    expect(problems.map((problem) => problem.name)).toEqual(['b.exe'])
    expect(new Set(picked.map((item) => item.key)).size).toBe(2)
  })

  it('does not list the same file twice, and stops at the room left', () => {
    const first = pickFiles([sized('a.png', 10)], [], 20, preview).picked
    const again = pickFiles(
      [sized('a.png', 10), sized('b.png', 10), sized('c.png', 10)],
      first,
      1,
      preview,
    )

    expect(again.picked.map((item) => item.file.name)).toEqual(['b.png'])
    expect(again.problems.map((problem) => problem.message)).toEqual([
      'This file is already in the list.',
      'Only 1 more file can be added at a time.',
    ])
  })
})

describe('helpers', () => {
  it('writes sizes for people', () => {
    expect(formatBytes(900)).toBe('1 KB')
    expect(formatBytes(1.5 * MB)).toBe('1.5 MB')
    expect(formatBytes(2 * 1024 * MB)).toBe('2.0 GB')
  })

  it('knows the type of files the browser cannot name', () => {
    expect(mimeOf({ name: 'a.glb', type: '' })).toBe('model/gltf-binary')
    expect(mimeOf({ name: 'a.png', type: 'image/png' })).toBe('image/png')
    expect(mimeOf({ name: 'a.xyz', type: '' })).toBe('application/octet-stream')
  })

  it('offers every extension to the file chooser', () => {
    expect(FILE_ACCEPT.split(',')).toContain('.heic')
    expect(FILE_ACCEPT.split(',')).toContain('.usdz')
  })
})
