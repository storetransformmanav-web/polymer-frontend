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

/** A value as people read it: names and values, lists as lists, formatted text as formatted text. */
function ReadableValueView({ value }: { value: ReadableValue }) {
  switch (value.kind) {
    case 'empty':
      return <span className="text-text-muted">Nothing set</span>
    case 'text':
      return (
        <p className="m-0 text-[0.88rem] break-words whitespace-pre-wrap">{value.text}</p>
      )
    case 'html':
      return <SafeHtml html={value.html} className="text-[0.88rem] leading-relaxed" />
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
            <li key={index} className="border-border bg-surface rounded-lg border p-3">
              <ReadableValueView value={item} />
            </li>
          ))}
        </ul>
      )
    }
    case 'group':
      return (
        <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-[minmax(7rem,12rem)_minmax(0,1fr)]">
          {value.entries.map((entry, index) => (
            <Fragment key={`${entry.label}-${index}`}>
              <dt className="text-text-muted text-[0.8rem] font-semibold sm:pt-0.5">
                {entry.label}
              </dt>
              <dd className="m-0 min-w-0">
                <ReadableValueView value={entry.value} />
              </dd>
            </Fragment>
          ))}
        </dl>
      )
  }
}

/**
 * The full value of a metafield, in a window: for structured data the **original value read out
 * for people** — never JSON — and for the description-sections detail each section with its
 * title and its text as it will read, then the description app's other settings by name.
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
      <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[1.05rem] font-semibold">{title}</h2>
          <p className="text-text-muted text-[0.8rem]">
            {appliesTo} · {kind}
          </p>
          <p className="text-text-muted font-mono text-[0.72rem]">{name}</p>
        </div>
        <button
          type="button"
          aria-label="Close window"
          onClick={onClose}
          className="text-text-muted hover:text-text hover:bg-surface inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent"
        >
          <XIcon width={16} height={16} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
        {sections ? (
          <>
            <section className="flex flex-col gap-3">
              <h3 className="text-[0.8rem] font-bold tracking-wide uppercase">
                Sections ({sections.sections.length})
              </h3>
              {sections.sections.map((section, index) => (
                <article
                  key={`${section.title}-${index}`}
                  className="border-border rounded-xl border"
                >
                  <h4 className="border-border bg-surface border-b px-4 py-2.5 text-[0.9rem] font-semibold">
                    {section.title}
                  </h4>
                  <div className="px-4 py-3">
                    {section.html.trim() ? (
                      <SafeHtml
                        html={section.html}
                        className="text-[0.88rem] leading-relaxed"
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
                <h3 className="text-[0.8rem] font-bold tracking-wide uppercase">
                  Settings of the description app
                </h3>
                <ReadableValueView value={sections.settings} />
              </section>
            )}
          </>
        ) : (
          <ReadableValueView value={readableMetafield(type, value)} />
        )}
      </div>

      <div className="border-border flex justify-end border-t px-5 py-3">
        <Button type="button" variant="secondary" data-autofocus onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  )
}
