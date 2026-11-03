import { Fragment, type ReactNode } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { SafeHtml } from '../../../components/ui/SafeHtml.tsx'
import { SidePanel } from '../../../components/ui/SidePanel.tsx'
import {
  readableMetafield,
  readableSections,
  type ReadableValue,
} from '../utils/metafields.ts'

/** A colour as a swatch with its code beside it. A see-through colour shows over a chequerboard. */
function ColorSwatch({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        title={color}
        style={{
          backgroundImage: `linear-gradient(${color}, ${color}), repeating-conic-gradient(#cfcfcf 0% 25%, #ffffff 0% 50%)`,
          backgroundSize: 'auto, 10px 10px',
        }}
        className="border-border-strong h-5 w-5 shrink-0 rounded-md border"
      />
      <span className="font-mono text-[0.82rem]">{color}</span>
    </span>
  )
}

/** A value short enough to sit at the right of its row, as in the quick view's rows. */
function isInline(value: ReadableValue): boolean {
  if (value.kind === 'text') return value.text.length <= 40 && !value.text.includes('\n')
  return value.kind === 'empty' || value.kind === 'color'
}

/**
 * One name and its value, drawn like a row of the products quick view: the name muted on the left,
 * a short value on the right; a longer value (formatted text, a list, a group) goes under its name.
 */
function Row({ label, value }: { label: string; value: ReadableValue }) {
  if (isInline(value)) {
    return (
      <div className="border-border flex items-baseline justify-between gap-4 border-b py-2.5 text-[0.88rem] last:border-b-0">
        <dt className="text-text-muted shrink-0">{label}</dt>
        <dd className="m-0 min-w-0 text-right font-medium break-words">
          <ReadableValueView value={value} />
        </dd>
      </div>
    )
  }
  return (
    <div className="border-border flex flex-col gap-1.5 border-b py-2.5 text-[0.88rem] last:border-b-0">
      <dt className="text-text-muted">{label}</dt>
      <dd className="m-0 min-w-0 font-medium">
        <ReadableValueView value={value} />
      </dd>
    </div>
  )
}

/** A bordered box of rows, like the quick view's facts. */
function RowsCard({ children }: { children: ReactNode }) {
  return <dl className="border-border m-0 rounded-xl border px-4">{children}</dl>
}

/**
 * A value as people read it: names and values, lists as chips or boxes, colours as swatches,
 * formatted text as formatted text.
 */
function ReadableValueView({ value }: { value: ReadableValue }) {
  switch (value.kind) {
    case 'empty':
      return <span className="text-text-muted font-normal">Nothing set</span>
    case 'text':
      return <span className="break-words whitespace-pre-wrap">{value.text}</span>
    case 'color':
      return <ColorSwatch color={value.color} />
    case 'html':
      return (
        <SafeHtml
          html={value.html}
          className="text-[0.85rem] leading-relaxed font-normal"
        />
      )
    case 'list': {
      // A list of short words reads best as chips (like the quick view's tags); anything bigger, as boxes.
      if (value.items.every((item) => item.kind === 'text')) {
        return (
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {value.items.map((item, index) => (
              <li
                key={index}
                className="bg-accent-tint text-accent rounded-full px-2.5 py-0.5 text-xs font-semibold"
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
            <li key={index}>
              {item.kind === 'group' ? (
                <ReadableValueView value={item} />
              ) : (
                <div className="border-border rounded-xl border px-4 py-2.5">
                  <ReadableValueView value={item} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )
    }
    case 'group':
      return (
        <RowsCard>
          {value.entries.map((entry, index) => (
            <Fragment key={`${entry.label}-${index}`}>
              <Row label={entry.label} value={entry.value} />
            </Fragment>
          ))}
        </RowsCard>
      )
  }
}

/** A small heading above a block of the panel, like the panel's own header. */
const BLOCK_HEADING = 'text-text-muted text-xs font-bold tracking-wider uppercase'

/**
 * The full value of a metafield, in a right-hand panel laid out like the products quick view (the panel
 * a row's picture opens): a "Metafield details" header bar with ✕, the detail's name and what it is, then
 * its value **read out for people** — never JSON — in bordered rows and chips, and a full-width button at
 * the foot. For the description-sections detail it shows only the description app's settings by name
 * (colours as swatches) — the sections themselves are read on the Overview tab. Closes on Escape,
 * the backdrop, the ✕ or the button.
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
  const readable = sections ? null : readableMetafield(type, value)

  return (
    <SidePanel
      title="Metafield details"
      label={`${title}: details`}
      onClose={onClose}
      footer={
        <Button type="button" variant="secondary" className="w-full" onClick={onClose}>
          Close details
        </Button>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg leading-snug font-semibold">{title}</h3>
          <p className="text-text-muted m-0 text-[0.85rem]">
            {appliesTo} · {kind}
          </p>
          <span className="text-text-muted flex items-center gap-1 font-mono text-[0.8rem] break-all">
            {name}
            <CopyButton value={name} label={`Copy ${name}`} />
          </span>
        </div>

        {/* The sections' own text is not repeated here — the Overview's accordion shows it. */}
        {sections ? (
          sections.settings.kind !== 'empty' && (
            <section className="flex flex-col gap-3">
              <h4 className={BLOCK_HEADING}>Settings of the description app</h4>
              <ReadableValueView value={sections.settings} />
            </section>
          )
        ) : readable && readable.kind !== 'group' ? (
          <RowsCard>
            <Row label="Value" value={readable} />
          </RowsCard>
        ) : (
          readable && <ReadableValueView value={readable} />
        )}
      </div>
    </SidePanel>
  )
}
