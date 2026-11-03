import { Fragment } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { XIcon } from '../../../components/ui/icons.tsx'
import { Modal } from '../../../components/ui/Modal.tsx'
import { SafeHtml } from '../../../components/ui/SafeHtml.tsx'
import {
  readableMetafield,
  readableSections,
  type ReadableValue,
} from '../utils/metafields.ts'

/** A colour as a swatch with its code beside it. A see-through colour shows over a chequerboard. */
function ColorSwatch({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden="true"
        title={color}
        style={{
          backgroundImage: `linear-gradient(${color}, ${color}), repeating-conic-gradient(#cfcfcf 0% 25%, #ffffff 0% 50%)`,
          backgroundSize: 'auto, 10px 10px',
        }}
        className="border-border-strong h-6 w-6 shrink-0 rounded-md border"
      />
      <span className="font-mono text-[0.82rem]">{color}</span>
    </span>
  )
}

/**
 * A value as people read it: names and values, lists as lists, colours as swatches, formatted text
 * as formatted text. A top-level group is drawn like the product list's table — bordered rows with
 * a tinted hover; a group inside something else is a plain, compact list of names and values.
 */
function ReadableValueView({
  value,
  nested = false,
}: {
  value: ReadableValue
  nested?: boolean
}) {
  switch (value.kind) {
    case 'empty':
      return <span className="text-text-muted">Nothing set</span>
    case 'text':
      return (
        <p className="m-0 text-[0.85rem] break-words whitespace-pre-wrap">{value.text}</p>
      )
    case 'color':
      return <ColorSwatch color={value.color} />
    case 'html':
      return <SafeHtml html={value.html} className="text-[0.85rem] leading-relaxed" />
    case 'list': {
      // A list of short words reads best as chips; a list of anything bigger, as boxes.
      if (value.items.every((item) => item.kind === 'text')) {
        return (
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {value.items.map((item, index) => (
              <li
                key={index}
                className="border-border-strong bg-bg rounded-full border px-2.5 py-0.5 text-[0.82rem] font-medium"
              >
                {item.kind === 'text' ? item.text : ''}
              </li>
            ))}
          </ul>
        )
      }
      return (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {value.items.map((item, index) => (
            <li key={index} className="border-border-strong bg-surface border p-3">
              <ReadableValueView value={item} nested />
            </li>
          ))}
        </ul>
      )
    }
    case 'group':
      if (nested) {
        return (
          <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[minmax(6rem,10rem)_minmax(0,1fr)]">
            {value.entries.map((entry, index) => (
              <Fragment key={`${entry.label}-${index}`}>
                <dt className="text-text-muted text-[0.8rem] font-semibold">
                  {entry.label}
                </dt>
                <dd className="m-0 min-w-0">
                  <ReadableValueView value={entry.value} nested />
                </dd>
              </Fragment>
            ))}
          </dl>
        )
      }
      return (
        <dl className="border-border-strong m-0 border">
          {value.entries.map((entry, index) => (
            <div
              key={`${entry.label}-${index}`}
              className="border-border even:bg-surface hover:bg-accent-tint/60 grid grid-cols-1 gap-x-4 border-b px-3.5 py-2.5 transition-colors last:border-b-0 sm:grid-cols-[minmax(8rem,14rem)_minmax(0,1fr)] sm:items-center"
            >
              <dt className="text-text-muted text-[0.7rem] font-bold tracking-wide uppercase">
                {entry.label}
              </dt>
              <dd className="m-0 min-w-0">
                <ReadableValueView value={entry.value} nested />
              </dd>
            </div>
          ))}
        </dl>
      )
  }
}

/** A small heading above a block of the window, like the product list's column headings. */
const BLOCK_HEADING = 'text-text-muted text-[0.7rem] font-bold tracking-wide uppercase'

/**
 * The full value of a metafield, in a window styled like the product list: a sage header band, bordered
 * rows that tint under the pointer and a tinted footer. For structured data it shows the **original value
 * read out for people** — never JSON — and for the description-sections detail each section with its title
 * and its text as it will read, then the description app's other settings by name (colours as swatches).
 */
export function MetafieldDetailsModal({
  title,
  appliesTo,
  kind,
  name,
  type,
  value,
  onClose,
}: {
  /** The detail's plain name ("Description sections"). */
  title: string
  appliesTo: string
  /** Its plain kind ("Structured data"). */
  kind: string
  /** The technical name, `namespace.key`, for anyone who needs it. */
  name: string
  type: string | null | undefined
  value: string | null | undefined
  onClose: () => void
}) {
  const sections = readableSections(value)

  return (
    <Modal label={`${title}: details`} onClose={onClose}>
      <div className="bg-table-head border-border-strong flex items-start justify-between gap-4 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-text text-[1.05rem] font-semibold">{title}</h2>
          <p className="text-text-muted text-[0.8rem]">
            {appliesTo} · {kind}
          </p>
          <p className="text-text-muted font-mono text-[0.72rem]">{name}</p>
        </div>
        <button
          type="button"
          aria-label="Close window"
          onClick={onClose}
          className="text-text-muted hover:text-text hover:bg-bg/60 inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent"
        >
          <XIcon width={16} height={16} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
        {sections ? (
          <>
            <section className="flex flex-col gap-3">
              <h3 className={BLOCK_HEADING}>Sections ({sections.sections.length})</h3>
              {sections.sections.map((section, index) => (
                <article
                  key={`${section.title}-${index}`}
                  className="border-border-strong border"
                >
                  <h4 className="bg-table-head border-border-strong text-text border-b px-4 py-2.5 text-[0.7rem] font-bold tracking-wide uppercase">
                    {section.title}
                  </h4>
                  <div className="px-4 py-3.5">
                    {section.html.trim() ? (
                      <SafeHtml
                        html={section.html}
                        className="text-[0.85rem] leading-relaxed"
                      />
                    ) : (
                      <span className="text-text-muted">Nothing written</span>
                    )}
                  </div>
                </article>
              ))}
            </section>
            {sections.settings.kind !== 'empty' && (
              <section className="flex flex-col gap-3">
                <h3 className={BLOCK_HEADING}>Settings of the description app</h3>
                <ReadableValueView value={sections.settings} />
              </section>
            )}
          </>
        ) : (
          <ReadableValueView value={readableMetafield(type, value)} />
        )}
      </div>

      <div className="bg-accent-tint/40 border-border flex justify-end border-t px-5 py-3">
        <Button type="button" variant="secondary" data-autofocus onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  )
}
