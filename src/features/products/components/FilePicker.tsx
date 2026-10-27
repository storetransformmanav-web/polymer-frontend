import { useEffect, useRef, useState, type DragEvent } from 'react'
import {
  BoxesIcon,
  CheckCircleIcon,
  ImageIcon,
  SpinnerIcon,
  TrashIcon,
  UploadIcon,
  VideoIcon,
} from '../../../components/ui/icons.tsx'
import type { FileUploadState } from '../hooks/useFileUpload.ts'
import {
  FILE_ACCEPT,
  FILE_HINT,
  formatBytes,
  pickFiles,
  releasePreview,
  type FileProblem,
  type PickedFile,
} from '../utils/mediaFiles.ts'

interface FilePickerProps {
  files: PickedFile[]
  onChange: (files: PickedFile[]) => void
  /** The most files that can be listed (the others are refused with a message). */
  max: number
  /** Progress of each file's upload, by its key. */
  states?: Record<string, FileUploadState>
  /** Nothing can be added or removed (an upload is running). */
  disabled?: boolean
  idPrefix: string
}

/** The picture, video or 3D-model tile of one chosen file. */
function Thumb({ picked }: { picked: PickedFile }) {
  const [broken, setBroken] = useState(false)
  const box =
    'border-border bg-surface text-text-muted flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border'
  if (picked.type === 'IMAGE' && !broken && picked.previewUrl) {
    return (
      <div className={box}>
        <img
          src={picked.previewUrl}
          alt={`Preview of ${picked.file.name}`}
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      </div>
    )
  }
  if (picked.type === 'VIDEO' && picked.previewUrl) {
    return (
      <div className={box}>
        <video
          src={picked.previewUrl}
          aria-label={`Preview of ${picked.file.name}`}
          muted
          playsInline
          preload="metadata"
          controls
          className="h-full w-full object-cover"
        />
      </div>
    )
  }
  return (
    <div className={box} title={broken ? 'No preview in this browser' : undefined}>
      {picked.type === 'MODEL_3D' ? (
        <BoxesIcon width={22} height={22} />
      ) : (
        <ImageIcon width={22} height={22} />
      )}
    </div>
  )
}

const TYPE_LABEL = { IMAGE: 'Image', VIDEO: 'Video', MODEL_3D: '3D model' } as const

/**
 * "Upload from your computer": a button (and a drop area) that opens the file chooser, and
 * the chosen files listed with a preview, their size and, once an upload runs, its progress.
 * Files are checked here — type, size limit, no repeats (`pickFiles`) — and a problem is
 * said by the file's name; nothing is sent from this component, the owner uploads `files`.
 */
export function FilePicker({
  files,
  onChange,
  max,
  states = {},
  disabled = false,
  idPrefix,
}: FilePickerProps) {
  const input = useRef<HTMLInputElement>(null)
  const [problems, setProblems] = useState<FileProblem[]>([])
  const [dragging, setDragging] = useState(false)

  // The previews are temporary addresses of the files in memory: let them go with the picker.
  const latest = useRef(files)
  useEffect(() => {
    latest.current = files
  })
  useEffect(
    () => () => {
      for (const picked of latest.current) releasePreview(picked.previewUrl)
    },
    [],
  )

  function take(chosen: FileList | File[] | null) {
    if (!chosen || disabled) return
    const { picked, problems: found } = pickFiles(
      Array.from(chosen),
      files,
      Math.max(0, max - files.length),
    )
    setProblems(found)
    if (picked.length > 0) onChange([...files, ...picked])
  }

  function remove(picked: PickedFile) {
    releasePreview(picked.previewUrl)
    onChange(files.filter((item) => item.key !== picked.key))
    setProblems([])
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    take(event.dataTransfer.files)
  }

  const full = files.length >= max
  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-4 text-center transition-colors ${
          dragging
            ? 'border-accent bg-accent-tint/60'
            : 'border-border-strong bg-surface/30'
        }`}
      >
        <input
          ref={input}
          id={`${idPrefix}-files`}
          type="file"
          multiple
          accept={FILE_ACCEPT}
          disabled={disabled || full}
          aria-label="Choose files from your computer"
          className="sr-only"
          onChange={(event) => {
            take(event.target.files)
            // The same file can then be chosen again after being removed.
            event.target.value = ''
          }}
        />
        <button
          type="button"
          disabled={disabled || full}
          onClick={() => input.current?.click()}
          className="border-border bg-bg text-text hover:border-accent inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
        >
          <UploadIcon width={14} height={14} />
          Upload from your computer
        </button>
        <p className="text-text-muted text-[0.76rem]">or drop files here</p>
        <p className="text-text-muted max-w-[44rem] text-[0.72rem]">{FILE_HINT}</p>
      </div>

      {problems.length > 0 && (
        <ul role="alert" className="text-danger flex flex-col gap-0.5 text-[0.78rem]">
          {problems.map((problem, index) => (
            <li key={`${problem.name}-${index}`}>
              <strong>{problem.name}</strong> — {problem.message}
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul aria-label="Files to upload" className="flex flex-col gap-2">
          {files.map((picked) => {
            const state = states[picked.key]
            return (
              <li
                key={picked.key}
                className="border-border flex items-center gap-3 rounded-xl border p-2.5"
              >
                <Thumb picked={picked} />
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[0.85rem] font-semibold"
                    title={picked.file.name}
                  >
                    {picked.file.name}
                  </p>
                  <p className="text-text-muted text-[0.76rem]">
                    {TYPE_LABEL[picked.type as keyof typeof TYPE_LABEL] ?? picked.type} ·{' '}
                    {formatBytes(picked.file.size)}
                  </p>
                  {state?.status === 'failed' && (
                    <p role="alert" className="text-danger text-[0.78rem]">
                      {state.error}
                    </p>
                  )}
                </div>
                {state?.status === 'uploading' && (
                  <span className="text-text-muted inline-flex items-center gap-1.5 text-[0.78rem]">
                    <SpinnerIcon width={14} height={14} className="animate-spin" />
                    Uploading…
                  </span>
                )}
                {state?.status === 'done' && (
                  <span className="text-accent inline-flex items-center gap-1.5 text-[0.78rem]">
                    <CheckCircleIcon width={14} height={14} />
                    Uploaded
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${picked.file.name}`}
                  disabled={disabled}
                  onClick={() => remove(picked)}
                  className="text-text-muted hover:text-danger cursor-pointer border-none bg-transparent p-1 transition-colors disabled:pointer-events-none disabled:opacity-50"
                >
                  <TrashIcon width={16} height={16} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {files.length > 0 && files.some((picked) => picked.type === 'VIDEO') && (
        <p className="text-text-muted flex items-center gap-1.5 text-[0.74rem]">
          <VideoIcon width={13} height={13} />
          Videos can take a few minutes for the store to process after they are uploaded.
        </p>
      )}
    </div>
  )
}
