import type { MediaType } from '../../../lib/api/endpoints.ts'

const MB = 1024 * 1024

/** What the store accepts, by file extension (browsers don't know HEIC, GLB or USDZ by type). */
const KINDS: {
  type: MediaType
  label: string
  extensions: string[]
  maxBytes: number
}[] = [
  {
    type: 'IMAGE',
    label: 'image',
    extensions: [
      'jpg',
      'jpeg',
      'jfif',
      'jpe',
      'png',
      'webp',
      'gif',
      'svg',
      'heic',
      'tif',
      'tiff',
      'bmp',
    ],
    maxBytes: 20 * MB,
  },
  {
    type: 'VIDEO',
    label: 'video',
    extensions: ['mp4', 'mov', 'webm'],
    maxBytes: 1024 * MB,
  },
  {
    type: 'MODEL_3D',
    label: '3D model',
    extensions: ['glb', 'usdz'],
    maxBytes: 500 * MB,
  },
]

/** The `accept` list of the file chooser. */
export const FILE_ACCEPT = KINDS.flatMap((kind) =>
  kind.extensions.map((extension) => `.${extension}`),
).join(',')

/** The types in words, for the hint under the chooser. */
export const FILE_HINT =
  'Images (JPG/JPEG/JFIF, PNG, WebP, GIF, SVG, HEIC, TIFF, BMP) up to 20 MB · videos (MP4, MOV, WebM) up to 1 GB · 3D models (GLB, USDZ) up to 500 MB'

/** A file the user chose from their computer, checked and ready to upload. */
export interface PickedFile {
  /** Distinguishes two files with the same name. */
  key: string
  file: File
  type: MediaType
  /** A temporary address of the file itself, for the preview (`URL.revokeObjectURL` it). */
  previewUrl: string
}

export interface FileProblem {
  name: string
  message: string
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/** "1.4 MB", "820 KB" — for sizes in messages and the list. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * MB) return `${(bytes / (1024 * MB)).toFixed(1)} GB`
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** The type of a file (by its extension), or why the store can't take it. */
export function checkFile(
  file: Pick<File, 'name' | 'size'>,
): { type: MediaType } | { problem: string } {
  const extension = extensionOf(file.name)
  const kind = KINDS.find((candidate) => candidate.extensions.includes(extension))
  if (!kind) {
    return {
      problem: extension
        ? `.${extension} files can't be added. Use an image, video or 3D model.`
        : 'This file has no type (extension). Use an image, video or 3D model.',
    }
  }
  if (file.size === 0) return { problem: 'The file is empty.' }
  if (file.size > kind.maxBytes) {
    return {
      problem: `This ${kind.label} is ${formatBytes(file.size)}; the most is ${formatBytes(kind.maxBytes)}.`,
    }
  }
  return { type: kind.type }
}

let counter = 0

/** A temporary address of the file for the preview ('' where the browser can't make one). */
export function previewOf(file: File): string {
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : ''
}

/** Lets a preview address go. */
export function releasePreview(url: string) {
  if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
}

/**
 * Turns what the chooser (or a drop) gave into files to list: the ones the store accepts
 * (without repeating a file already listed, same name and size) and a problem for each other.
 * At most `room` files are taken; the rest are reported.
 */
export function pickFiles(
  chosen: readonly File[],
  existing: readonly PickedFile[],
  room: number,
  makePreview: (file: File) => string = previewOf,
): { picked: PickedFile[]; problems: FileProblem[] } {
  const picked: PickedFile[] = []
  const problems: FileProblem[] = []
  for (const file of chosen) {
    const same = [...existing, ...picked].some(
      (item) => item.file.name === file.name && item.file.size === file.size,
    )
    if (same) {
      problems.push({ name: file.name, message: 'This file is already in the list.' })
      continue
    }
    const checked = checkFile(file)
    if ('problem' in checked) {
      problems.push({ name: file.name, message: checked.problem })
      continue
    }
    if (picked.length >= room) {
      problems.push({
        name: file.name,
        message:
          room === 0
            ? 'No more files can be added at a time.'
            : `Only ${room} more ${room === 1 ? 'file' : 'files'} can be added at a time.`,
      })
      continue
    }
    counter += 1
    picked.push({
      key: `file-${counter}`,
      file,
      type: checked.type,
      previewUrl: makePreview(file),
    })
  }
  return { picked, problems }
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  jpe: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  bmp: 'image/bmp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  glb: 'model/gltf-binary',
  usdz: 'model/vnd.usdz+zip',
}

/** The file's type as the browser reports it, or the usual one for its extension. */
export function mimeOf(file: Pick<File, 'name' | 'type'>): string {
  return (
    file.type || MIME_BY_EXTENSION[extensionOf(file.name)] || 'application/octet-stream'
  )
}

/** Extensions that are really another one's file (a JFIF or JPE picture is a JPEG). */
const RENAMED: Record<string, string> = { jfif: 'jpg', jpe: 'jpg' }

/**
 * The file as it is sent to the store: a `.jfif` / `.jpe` picture is a plain JPEG, but the
 * store goes by the name and type it is given, so it gets the usual `.jpg` name and
 * `image/jpeg` type. Any other file is returned as it is.
 */
export function forUpload(file: File): File {
  const extension = extensionOf(file.name)
  const renamed = RENAMED[extension]
  if (!renamed) return file
  const stem = file.name.slice(0, file.name.length - extension.length - 1)
  return new File([file], `${stem}.${renamed}`, {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  })
}
