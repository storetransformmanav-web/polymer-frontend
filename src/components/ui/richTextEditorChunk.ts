/**
 * The rich-text editor is a large library, so it is a separate chunk that only
 * downloads when an editor is shown. Calling this early (e.g. when the pointer
 * reaches the pencil that opens an editor) starts the download, so by the click
 * it is usually there and the editor appears with no loading state.
 */
export const loadRichTextEditor = () => import('./RichTextEditorView.tsx')

export function preloadRichTextEditor() {
  void loadRichTextEditor()
}
