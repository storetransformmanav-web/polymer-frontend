import { Color, TextStyle } from '@tiptap/extension-text-style'
import { Image } from '@tiptap/extension-image'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { TextAlign } from '@tiptap/extension-text-align'
import { Youtube, isValidYoutubeUrl } from '@tiptap/extension-youtube'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { useState, type ComponentType, type FormEvent, type ReactNode } from 'react'
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  BulletListIcon,
  ClearFormattingIcon,
  CodeIcon,
  ImageIcon,
  IndentIcon,
  ItalicIcon,
  LinkIcon,
  OrderedListIcon,
  OutdentIcon,
  TableIcon,
  TextColorIcon,
  UnderlineIcon,
  VideoIcon,
  type IconProps,
} from './icons.tsx'
import { PopoverButton } from './PopoverButton.tsx'

export interface RichTextEditorProps {
  /** Id of the editable area. */
  id: string
  /** What the editor is called, for assistive technology ("Description"). */
  label: string
  /** The content as HTML. */
  value: string
  /** Called with the new HTML each time the content is changed by the user ('' when empty). */
  onChange: (html: string) => void
}

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const

const ALIGNMENTS: { value: string; label: string; icon: ComponentType<IconProps> }[] = [
  { value: 'left', label: 'Align left', icon: AlignLeftIcon },
  { value: 'center', label: 'Align center', icon: AlignCenterIcon },
  { value: 'right', label: 'Align right', icon: AlignRightIcon },
  { value: 'justify', label: 'Justify', icon: AlignJustifyIcon },
]

/** Text colours offered in the picker (content colours, not interface colours). */
const SWATCHES = [
  { name: 'Black', value: '#000000' },
  { name: 'Dark grey', value: '#434343' },
  { name: 'Grey', value: '#808080' },
  { name: 'Red', value: '#d93025' },
  { name: 'Orange', value: '#e8710a' },
  { name: 'Yellow', value: '#f9ab00' },
  { name: 'Green', value: '#188038' },
  { name: 'Blue', value: '#1a73e8' },
  { name: 'Purple', value: '#9334e6' },
  { name: 'Pink', value: '#e91e63' },
]

/** Links may only point to the web, an email address or a phone number. */
const LINK_TARGET = /^(https?:\/\/|mailto:|tel:)\S+$/i
const HTTPS_URL = /^https:\/\/\S+$/i

/** How the content looks inside the editor (Tailwind's reset removes list/heading/table styling). */
const CONTENT =
  '[&_.ProseMirror]:min-h-44 [&_.ProseMirror]:px-4 [&_.ProseMirror]:py-3 [&_.ProseMirror]:text-[0.92rem] [&_.ProseMirror]:leading-relaxed [&_.ProseMirror]:outline-none [&_.ProseMirror_p]:my-2 [&_.ProseMirror_h1]:my-3 [&_.ProseMirror_h1]:text-[1.6rem] [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h2]:my-3 [&_.ProseMirror_h2]:text-[1.35rem] [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h3]:my-2 [&_.ProseMirror_h3]:text-[1.15rem] [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h4]:my-2 [&_.ProseMirror_h4]:font-semibold [&_.ProseMirror_h5]:my-2 [&_.ProseMirror_h5]:text-[0.85rem] [&_.ProseMirror_h5]:font-semibold [&_.ProseMirror_h6]:my-2 [&_.ProseMirror_h6]:text-[0.8rem] [&_.ProseMirror_h6]:font-semibold [&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ol]:my-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_blockquote]:my-2 [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-border [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_a]:text-accent [&_.ProseMirror_a]:underline [&_.ProseMirror_img]:my-2 [&_.ProseMirror_img]:h-auto [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img.ProseMirror-selectednode]:outline-2 [&_.ProseMirror_img.ProseMirror-selectednode]:outline-accent [&_.ProseMirror_iframe]:aspect-video [&_.ProseMirror_iframe]:w-full [&_.ProseMirror_iframe]:max-w-xl [&_.ProseMirror_iframe]:rounded-lg [&_.ProseMirror_table]:my-2 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:table-fixed [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border [&_.ProseMirror_td]:px-2 [&_.ProseMirror_td]:py-1.5 [&_.ProseMirror_td]:align-top [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border [&_.ProseMirror_th]:bg-surface [&_.ProseMirror_th]:px-2 [&_.ProseMirror_th]:py-1.5 [&_.ProseMirror_th]:text-left [&_.ProseMirror_th]:align-top [&_.ProseMirror_.selectedCell]:bg-accent-tint'

/** Keeps the text selection where it is when a toolbar control is pressed. */
const keepSelection = (event: { preventDefault: () => void }) => event.preventDefault()

function ToolButton({
  label,
  icon: Icon,
  onClick,
  pressed,
  disabled = false,
}: {
  label: string
  icon: ComponentType<IconProps>
  onClick: () => void
  /** Set for on/off controls (bold, lists…); leave out for one-shot actions. */
  pressed?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseDown={keepSelection}
      onClick={onClick}
      className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-none transition-colors disabled:pointer-events-none disabled:opacity-40 ${
        pressed
          ? 'bg-accent-tint text-accent'
          : 'text-text-muted hover:bg-surface hover:text-text bg-transparent'
      }`}
    >
      <Icon width={16} height={16} />
    </button>
  )
}

function MenuItem({
  label,
  icon: Icon,
  onClick,
  selected = false,
  disabled = false,
  danger = false,
}: {
  label: string
  icon?: ComponentType<IconProps>
  onClick: () => void
  selected?: boolean
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onMouseDown={keepSelection}
      onClick={onClick}
      className={`hover:bg-surface flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-none bg-transparent px-2.5 py-2 text-left text-[0.85rem] transition-colors disabled:pointer-events-none disabled:opacity-40 ${
        selected ? 'text-accent font-semibold' : danger ? 'text-danger' : 'text-text'
      }`}
    >
      {Icon && <Icon width={16} height={16} />}
      {label}
    </button>
  )
}

const Divider = () => (
  <span aria-hidden="true" className="bg-border mx-1 h-5 w-px shrink-0" />
)

const POPOVER_INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint h-9 w-full min-w-0 rounded-lg border px-2.5 text-[0.85rem] outline-none focus:outline-2'
const POPOVER_SUBMIT =
  'bg-accent text-accent-contrast hover:bg-accent-hover h-9 cursor-pointer rounded-lg border-none px-3 text-[0.82rem] font-semibold'
const POPOVER_SECONDARY =
  'border-border bg-bg text-text hover:border-accent h-9 cursor-pointer rounded-lg border px-3 text-[0.82rem] font-semibold'

/** A small form inside a toolbar popover (link, image, video). */
function PopoverForm({
  children,
  error,
  onSubmit,
}: {
  children: ReactNode
  error: string | null
  onSubmit: () => void
}) {
  return (
    <form
      className="flex w-72 flex-col gap-2 p-1.5"
      onSubmit={(event: FormEvent) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      {children}
      {error && (
        <p role="alert" className="text-danger text-[0.78rem]">
          {error}
        </p>
      )}
    </form>
  )
}

function LinkControl({
  editor,
  active,
  href,
}: {
  editor: Editor
  active: boolean
  href: string
}) {
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState(href)

  function apply(close: () => void) {
    const target = url.trim()
    if (!LINK_TARGET.test(target)) {
      setError('Use a web address (https://…), mailto: or tel:')
      return
    }
    if (!editor.state.selection.empty || editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: target }).run()
    } else {
      // Nothing is selected: the address itself becomes the link text.
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: target,
          marks: [{ type: 'link', attrs: { href: target } }],
        })
        .run()
    }
    close()
  }

  return (
    <PopoverButton
      label="Insert link"
      chevron={false}
      icon={LinkIcon}
      variant="toolbar"
      active={active}
      onOpen={() => {
        setUrl(href)
        setError(null)
      }}
    >
      {(close) => (
        <PopoverForm error={error} onSubmit={() => apply(close)}>
          <label className="text-text text-[0.8rem] font-semibold" htmlFor="rte-link-url">
            Link address
          </label>
          <input
            id="rte-link-url"
            value={url}
            placeholder="https://…"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setUrl(event.target.value)
              setError(null)
            }}
            className={POPOVER_INPUT}
          />
          <div className="flex gap-2">
            <button type="submit" className={POPOVER_SUBMIT}>
              Apply
            </button>
            {active && (
              <button
                type="button"
                className={POPOVER_SECONDARY}
                onClick={() => {
                  editor.chain().focus().extendMarkRange('link').unsetLink().run()
                  close()
                }}
              >
                Remove link
              </button>
            )}
          </div>
        </PopoverForm>
      )}
    </PopoverButton>
  )
}

function ImageControl({ editor }: { editor: Editor }) {
  const [url, setUrl] = useState('')
  const [alt, setAlt] = useState('')
  const [error, setError] = useState<string | null>(null)

  function insert(close: () => void) {
    const src = url.trim()
    if (!HTTPS_URL.test(src)) {
      setError('Use a public https:// image address')
      return
    }
    editor.chain().focus().setImage({ src, alt: alt.trim() }).run()
    close()
  }

  return (
    <PopoverButton
      label="Insert image"
      chevron={false}
      icon={ImageIcon}
      variant="toolbar"
      onOpen={() => {
        setUrl('')
        setAlt('')
        setError(null)
      }}
    >
      {(close) => (
        <PopoverForm error={error} onSubmit={() => insert(close)}>
          <label
            className="text-text text-[0.8rem] font-semibold"
            htmlFor="rte-image-url"
          >
            Image address
          </label>
          <input
            id="rte-image-url"
            value={url}
            placeholder="https://…"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setUrl(event.target.value)
              setError(null)
            }}
            className={POPOVER_INPUT}
          />
          <label
            className="text-text text-[0.8rem] font-semibold"
            htmlFor="rte-image-alt"
          >
            Alt text
          </label>
          <input
            id="rte-image-alt"
            value={alt}
            autoComplete="off"
            onChange={(event) => setAlt(event.target.value)}
            className={POPOVER_INPUT}
          />
          <button type="submit" className={`${POPOVER_SUBMIT} self-start`}>
            Add image
          </button>
        </PopoverForm>
      )}
    </PopoverButton>
  )
}

function VideoControl({ editor }: { editor: Editor }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  function insert(close: () => void) {
    const src = url.trim()
    if (!isValidYoutubeUrl(src)) {
      setError('Enter a YouTube video address')
      return
    }
    editor.chain().focus().setYoutubeVideo({ src }).run()
    close()
  }

  return (
    <PopoverButton
      label="Insert video"
      chevron={false}
      icon={VideoIcon}
      variant="toolbar"
      onOpen={() => {
        setUrl('')
        setError(null)
      }}
    >
      {(close) => (
        <PopoverForm error={error} onSubmit={() => insert(close)}>
          <label
            className="text-text text-[0.8rem] font-semibold"
            htmlFor="rte-video-url"
          >
            YouTube address
          </label>
          <input
            id="rte-video-url"
            value={url}
            placeholder="https://www.youtube.com/watch?v=…"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setUrl(event.target.value)
              setError(null)
            }}
            className={POPOVER_INPUT}
          />
          <button type="submit" className={`${POPOVER_SUBMIT} self-start`}>
            Add video
          </button>
        </PopoverForm>
      )}
    </PopoverButton>
  )
}

/** The editor's current formatting, for the toolbar's pressed states. */
function useToolbarState(editor: Editor | null) {
  return useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) return null
      return {
        heading:
          HEADING_LEVELS.find((level) => current.isActive('heading', { level })) ?? 0,
        bold: current.isActive('bold'),
        italic: current.isActive('italic'),
        underline: current.isActive('underline'),
        color: (current.getAttributes('textStyle').color as string | undefined) ?? null,
        align:
          ALIGNMENTS.find((item) => current.isActive({ textAlign: item.value }))?.value ??
          'left',
        link: current.isActive('link'),
        href: (current.getAttributes('link').href as string | undefined) ?? '',
        bullet: current.isActive('bulletList'),
        ordered: current.isActive('orderedList'),
        canSink: current.can().sinkListItem('listItem'),
        canLift: current.can().liftListItem('listItem'),
        inTable: current.isActive('table'),
      }
    },
  })
}

/**
 * A rich-text editor in the style of the store admin's: block style, bold /
 * italic / underline, text colour, alignment, link, image, video, table, lists,
 * indent, clear formatting — and a switch to the raw HTML. The content is HTML
 * (what the store keeps); the editor only understands a safe set of elements, so
 * anything else pasted or typed in the HTML view is dropped when it is shown
 * visually. Loaded on demand (see `RichTextEditor`), as it is a large library.
 */
export default function RichTextEditorView({
  id,
  label,
  value,
  onChange,
}: RichTextEditorProps) {
  const [source, setSource] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [...HEADING_LEVELS] },
        // No empty paragraph forced in after a heading, table or image: it would end up in the saved HTML.
        trailingNode: false,
        // Clicking a link while editing puts the cursor there instead of following it.
        link: { openOnClick: false, autolink: true },
      }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ allowBase64: false }),
      Youtube.configure({ nocookie: true, controls: true }),
      Table,
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    editorProps: {
      attributes: {
        id,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.isEmpty ? '' : current.getHTML()),
  })
  const state = useToolbarState(editor)

  function toggleSource() {
    if (source && editor) {
      // Back to the visual editor: show what the HTML says (without counting that as an edit).
      editor.commands.setContent(value, { emitUpdate: false })
    }
    setSource(!source)
  }

  const blockLabel = state?.heading ? `Heading ${state.heading}` : 'Paragraph'

  return (
    <div className="border-border bg-bg focus-within:border-accent focus-within:outline-accent-tint rounded-xl border transition-colors focus-within:outline-2">
      <div
        role="toolbar"
        aria-label={`${label} formatting`}
        className="border-border flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5"
      >
        {editor && state && !source ? (
          <>
            <PopoverButton label={blockLabel} variant="toolbar" showLabel>
              {(close) => (
                <div role="menu" aria-label="Text style" className="flex flex-col">
                  <MenuItem
                    label="Paragraph"
                    selected={state.heading === 0}
                    onClick={() => {
                      editor.chain().focus().setParagraph().run()
                      close()
                    }}
                  />
                  {HEADING_LEVELS.map((level) => (
                    <MenuItem
                      key={level}
                      label={`Heading ${level}`}
                      selected={state.heading === level}
                      onClick={() => {
                        editor.chain().focus().setHeading({ level }).run()
                        close()
                      }}
                    />
                  ))}
                </div>
              )}
            </PopoverButton>
            <Divider />
            <ToolButton
              label="Bold"
              icon={BoldIcon}
              pressed={state.bold}
              onClick={() => editor.chain().focus().toggleBold().run()}
            />
            <ToolButton
              label="Italic"
              icon={ItalicIcon}
              pressed={state.italic}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            />
            <ToolButton
              label="Underline"
              icon={UnderlineIcon}
              pressed={state.underline}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            />
            <PopoverButton
              label="Text color"
              icon={TextColorIcon}
              variant="toolbar"
              active={state.color !== null}
            >
              {(close) => (
                <div className="flex w-52 flex-col gap-2 p-1.5">
                  <div className="grid grid-cols-5 gap-1.5">
                    {SWATCHES.map((swatch) => (
                      <button
                        key={swatch.value}
                        type="button"
                        title={swatch.name}
                        aria-label={`Text color ${swatch.name}`}
                        onMouseDown={keepSelection}
                        onClick={() => {
                          editor.chain().focus().setColor(swatch.value).run()
                          close()
                        }}
                        style={{ backgroundColor: swatch.value }}
                        className="border-border h-7 w-7 cursor-pointer rounded-md border"
                      />
                    ))}
                  </div>
                  <MenuItem
                    label="Default color"
                    onClick={() => {
                      editor.chain().focus().unsetColor().run()
                      close()
                    }}
                  />
                </div>
              )}
            </PopoverButton>
            <Divider />
            <PopoverButton
              label="Align"
              icon={
                ALIGNMENTS.find((item) => item.value === state.align)?.icon ??
                AlignLeftIcon
              }
              variant="toolbar"
            >
              {(close) => (
                <div role="menu" aria-label="Alignment" className="flex flex-col">
                  {ALIGNMENTS.map((item) => (
                    <MenuItem
                      key={item.value}
                      label={item.label}
                      icon={item.icon}
                      selected={state.align === item.value}
                      onClick={() => {
                        editor.chain().focus().setTextAlign(item.value).run()
                        close()
                      }}
                    />
                  ))}
                </div>
              )}
            </PopoverButton>
            <Divider />
            <LinkControl editor={editor} active={state.link} href={state.href} />
            <ImageControl editor={editor} />
            <VideoControl editor={editor} />
            <PopoverButton
              label="Table"
              icon={TableIcon}
              variant="toolbar"
              active={state.inTable}
            >
              {(close) => {
                const run = (command: () => boolean) => () => {
                  command()
                  close()
                }
                return (
                  <div role="menu" aria-label="Table" className="flex flex-col">
                    <MenuItem
                      label="Insert table"
                      onClick={run(() =>
                        editor
                          .chain()
                          .focus()
                          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                          .run(),
                      )}
                    />
                    <MenuItem
                      label="Add row below"
                      disabled={!state.inTable}
                      onClick={run(() => editor.chain().focus().addRowAfter().run())}
                    />
                    <MenuItem
                      label="Add column right"
                      disabled={!state.inTable}
                      onClick={run(() => editor.chain().focus().addColumnAfter().run())}
                    />
                    <MenuItem
                      label="Delete row"
                      disabled={!state.inTable}
                      onClick={run(() => editor.chain().focus().deleteRow().run())}
                    />
                    <MenuItem
                      label="Delete column"
                      disabled={!state.inTable}
                      onClick={run(() => editor.chain().focus().deleteColumn().run())}
                    />
                    <MenuItem
                      label="Delete table"
                      danger
                      disabled={!state.inTable}
                      onClick={run(() => editor.chain().focus().deleteTable().run())}
                    />
                  </div>
                )
              }}
            </PopoverButton>
            <Divider />
            <ToolButton
              label="Bulleted list"
              icon={BulletListIcon}
              pressed={state.bullet}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            />
            <ToolButton
              label="Numbered list"
              icon={OrderedListIcon}
              pressed={state.ordered}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            />
            <ToolButton
              label="Decrease indent"
              icon={OutdentIcon}
              disabled={!state.canLift}
              onClick={() => editor.chain().focus().liftListItem('listItem').run()}
            />
            <ToolButton
              label="Increase indent"
              icon={IndentIcon}
              disabled={!state.canSink}
              onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
            />
            <Divider />
            <ToolButton
              label="Clear formatting"
              icon={ClearFormattingIcon}
              onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
            />
          </>
        ) : null}
        <span className="ml-auto" />
        <ToolButton
          label="Edit HTML"
          icon={CodeIcon}
          pressed={source}
          disabled={!editor}
          onClick={toggleSource}
        />
      </div>

      {/* Both stay mounted, so the editor keeps its undo history while the HTML is viewed. */}
      <div className={`${CONTENT} ${source ? 'hidden' : ''}`}>
        <EditorContent editor={editor} />
      </div>
      {source && (
        <textarea
          aria-label={`${label} (HTML)`}
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="text-text block min-h-44 w-full resize-y border-none bg-transparent px-4 py-3 font-mono text-[0.82rem] leading-relaxed outline-none"
        />
      )}
    </div>
  )
}
