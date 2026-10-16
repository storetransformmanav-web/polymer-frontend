import type { ComponentType, KeyboardEvent, ReactNode } from 'react'
import { DetailSection } from '../../../../components/ui/DetailSection.tsx'
import { FormMessage } from '../../../../components/ui/FormMessage.tsx'
import { IconAction } from '../../../../components/ui/IconAction.tsx'
import {
  CheckIcon,
  PencilIcon,
  XIcon,
  type IconProps,
} from '../../../../components/ui/icons.tsx'
import type { ProductDetail } from '../../../../lib/api/endpoints.ts'
import {
  useSectionEdit,
  type SavedHandler,
  type SectionEdit,
} from '../../hooks/useSectionEdit.ts'
import type { SectionProps } from './fields.tsx'

/**
 * Pencil → (✓ Save, ✕ Discard): the controls of an in-place section edit.
 * Icon-only; each names itself in a tooltip on hover or keyboard focus.
 */
export function SectionEditControls({
  edit,
  what,
  onStart,
  onIntent,
}: {
  edit: SectionEdit
  what: string
  /** The pointer reached the pencil (or it got focus): warm up whatever editing will need. */
  onIntent?: () => void
  /** Runs just before editing begins — for a tab that remembers how editing was started. */
  onStart?: () => void
}) {
  if (!edit.editing) {
    return (
      <IconAction
        label="Edit"
        accessibleLabel={`Edit ${what}`}
        icon={PencilIcon}
        onIntent={onIntent}
        onClick={() => {
          onStart?.()
          edit.start()
        }}
      />
    )
  }

  return (
    <>
      <IconAction
        label="Save"
        accessibleLabel={`Save ${what}`}
        icon={CheckIcon}
        tone="primary"
        disabled={!edit.dirty}
        busy={edit.isSaving}
        onClick={() => void edit.commit()}
      />
      <IconAction
        label="Discard"
        accessibleLabel={`Discard ${what} changes`}
        icon={XIcon}
        tone="danger"
        disabled={edit.isSaving}
        onClick={edit.discard}
      />
    </>
  )
}

/** What went wrong with a save attempt, under the fields being edited. */
function SectionEditFeedback({ edit }: { edit: SectionEdit }) {
  if (edit.error) return <FormMessage tone="error">{edit.error}</FormMessage>
  if (edit.showErrors && edit.hasProblems) {
    return <FormMessage tone="error">Fix the highlighted fields to save.</FormMessage>
  }
  return null
}

interface SharedProps {
  product: ProductDetail
  /** What is being edited, for the buttons' names — "specifications". */
  what: string
  /** Which validation problems belong to this section (a stable, module-level array). */
  errorPrefixes: readonly string[]
  onSaved?: SavedHandler
  /** The section as it is normally shown. */
  view: ReactNode
  /** The editable fields, shown in place of `view` while editing. */
  editor: (props: SectionProps) => ReactNode
  /**
   * Replaces the default toolbar (just the pencil, on its own row) with the tab's
   * own header row, so the edit controls sit beside its summary and filter.
   */
  header?: (edit: SectionEdit) => ReactNode
}

/** Escape discards the section being edited. */
function discardOnEscape(edit: SectionEdit) {
  return (event: KeyboardEvent) => {
    if (event.key === 'Escape' && edit.editing) {
      event.stopPropagation()
      edit.discard()
    }
  }
}

function renderBody(edit: SectionEdit, editor: SharedProps['editor']) {
  if (!edit.editing || !edit.baseline || !edit.draft) return null
  return (
    <div className="flex flex-col gap-4">
      {editor({
        product: edit.baseline,
        draft: edit.draft,
        errors: edit.errors,
        onChange: edit.change,
      })}
      <SectionEditFeedback edit={edit} />
    </div>
  )
}

interface EditableCardProps extends SharedProps {
  /** Called when the pointer reaches the pencil, so a heavy editor can be fetched before the click. */
  onEditIntent?: () => void
  title: string
  count?: number
  icon: ComponentType<IconProps>
  defaultOpen?: boolean
}

/**
 * A collapsible card whose header has a pencil. Clicking it makes the card's
 * own fields editable right there (opening the card if it was collapsed) —
 * no dialog — with ✓ Save and ✕ Discard in the header while editing.
 */
export function EditableCard({
  product,
  what,
  errorPrefixes,
  onSaved,
  view,
  editor,
  title,
  count,
  icon,
  defaultOpen,
  onEditIntent,
}: EditableCardProps) {
  const edit = useSectionEdit(product, { errorPrefixes, onSaved })

  return (
    <DetailSection
      title={title}
      count={count}
      icon={icon}
      defaultOpen={defaultOpen}
      forceOpen={edit.editing}
      actions={<SectionEditControls edit={edit} what={what} onIntent={onEditIntent} />}
    >
      {/* Only listens for Escape; every control inside stays an ordinary focusable element. */}
      <div onKeyDown={discardOnEscape(edit)}>
        {edit.editing ? renderBody(edit, editor) : view}
      </div>
    </DetailSection>
  )
}

/**
 * The same, for a whole tab (Variants, Collections, Media): a slim toolbar with
 * the pencil above the tab's content, which turns into the editor in place.
 */
export function EditableTab({
  product,
  what,
  errorPrefixes,
  onSaved,
  view,
  editor,
  header,
}: SharedProps) {
  const edit = useSectionEdit(product, { errorPrefixes, onSaved })

  return (
    <div className="flex flex-col gap-4" onKeyDown={discardOnEscape(edit)}>
      {header ? (
        header(edit)
      ) : (
        <div className="flex min-h-8 items-center justify-end gap-1.5">
          {edit.editing && (
            <p className="text-text-muted mr-auto text-[0.82rem] font-medium">
              Editing {what}
            </p>
          )}
          <SectionEditControls edit={edit} what={what} />
        </div>
      )}
      {edit.editing ? renderBody(edit, editor) : view}
    </div>
  )
}
