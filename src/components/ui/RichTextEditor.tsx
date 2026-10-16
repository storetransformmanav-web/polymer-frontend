import { lazy, Suspense } from 'react'
import { loadRichTextEditor } from './richTextEditorChunk.ts'
import type { RichTextEditorProps } from './RichTextEditorView.tsx'

const RichTextEditorView = lazy(loadRichTextEditor)

/** Same height as the editor, so nothing jumps while the chunk loads. */
function EditorPlaceholder() {
  return (
    <div
      role="status"
      aria-label="Loading editor"
      className="border-border bg-bg rounded-xl border"
    >
      <div className="border-border h-11 border-b" />
      <div className="min-h-44" />
    </div>
  )
}

/**
 * A rich-text (WYSIWYG) editor for HTML content, loaded on demand. See
 * `RichTextEditorView` for what it offers.
 */
export function RichTextEditor(props: RichTextEditorProps) {
  return (
    <Suspense fallback={<EditorPlaceholder />}>
      <RichTextEditorView {...props} />
    </Suspense>
  )
}
