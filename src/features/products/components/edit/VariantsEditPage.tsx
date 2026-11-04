import { useState } from 'react'
import { ConfirmCancelDialog } from '../../../../components/ui/ConfirmCancelDialog.tsx'
import { FormMessage } from '../../../../components/ui/FormMessage.tsx'
import { ArrowLeftIcon, PencilIcon, TagIcon } from '../../../../components/ui/icons.tsx'
import { OpenTabsBar } from '../../../../components/ui/OpenTabsBar.tsx'
import type { SectionEdit } from '../../hooks/useSectionEdit.ts'
import { ConfirmUpdateDialog } from '../ConfirmUpdateDialog.tsx'
import { AddVariantButton } from './AddVariantButton.tsx'
import { VariantsSection } from './VariantsSection.tsx'

const BUTTON_SM =
  'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-4 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const BUTTON =
  'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-5 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const GHOST = `${BUTTON} border-border bg-bg text-text hover:border-accent`
const BACK = `${BUTTON_SM} border-accent/40 bg-bg text-accent hover:bg-accent-tint`
const SOLID = `${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`

/**
 * **Edit Variants** — the whole Variants tab as a page of its own, in place of the tab (laid out
 * like the Edit Customer demo): a strip with an "Editing variants" tab, a header (title, a one-line
 * note, the editor's own **Add variant** — a new option — and **Back**), the **Variant Options**
 * card with its add-value strip, the **Current variants** and **New variants** cards and a
 * sticky foot with **Cancel** and **Save Changes**. The edit is held by the Variants tab (it is
 * already running when this page shows); Save Changes checks the fields, asks "Are you sure?" and
 * sends only what changed. Cancel, Back, the tab's ✕ and Escape leave, asking first when
 * something was changed.
 */
export function VariantsEditPage({
  edit,
  productTitle,
}: {
  edit: SectionEdit
  productTitle: string
}) {
  const [cancelling, setCancelling] = useState(false)
  const { baseline, draft } = edit
  if (!edit.editing || !baseline || !draft) return null

  const busy = edit.confirming || cancelling

  function close() {
    if (edit.dirty) setCancelling(true)
    else edit.discard()
  }

  return (
    <>
      <div
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !event.defaultPrevented && !busy) {
            event.stopPropagation()
            close()
          }
        }}
        className="flex flex-col gap-4"
      >
        <OpenTabsBar
          tabs={[
            {
              id: 'variants',
              label: 'Variants',
              title: `Editing the variants of ${productTitle}`,
            },
          ]}
          activeId="variants"
          navLabel="Editing the variants"
          listLabel="All variants"
          kind="Editing"
          historyLabel="Variants being edited"
          icon={PencilIcon}
          onShowList={close}
          onSelect={() => undefined}
          onClose={close}
          onClear={close}
        />

        <section
          aria-label="Edit variants"
          className="border-border bg-bg flex flex-col rounded-2xl border"
        >
          <div className="border-border flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="bg-accent-tint text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <TagIcon width={20} height={20} />
              </span>
              <div className="min-w-0">
                <h2 className="m-0 text-[1rem] leading-tight font-bold">Edit Variants</h2>
                <p className="text-text-muted m-0 mt-0.5 text-[0.8rem]">
                  Manage product variants and options
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AddVariantButton draft={draft} onChange={edit.change} />
              <button
                type="button"
                onClick={close}
                disabled={edit.isSaving}
                aria-label="Back to variants"
                className={BACK}
              >
                <ArrowLeftIcon width={15} height={15} />
                Back
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <VariantsSection
              product={baseline}
              draft={draft}
              errors={edit.errors}
              onChange={edit.change}
            />
            {edit.error && <FormMessage tone="error">{edit.error}</FormMessage>}
            {!edit.error && edit.showErrors && edit.hasProblems && (
              <FormMessage tone="error">Fix the highlighted fields to save.</FormMessage>
            )}
          </div>

          <div className="border-border bg-bg sticky bottom-0 z-[2] flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t px-5 py-3">
            <button
              type="button"
              onClick={close}
              disabled={edit.isSaving}
              className={GHOST}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={edit.commit}
              disabled={!edit.dirty || edit.isSaving}
              className={SOLID}
            >
              {edit.isSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </section>
      </div>

      {edit.confirming && (
        <ConfirmUpdateDialog
          title={`Update “${productTitle}”?`}
          onConfirm={() => void edit.confirmSave()}
          onCancel={edit.cancelConfirm}
        />
      )}
      {cancelling && (
        <ConfirmCancelDialog
          lose="your changes to the variants"
          onConfirm={() => {
            setCancelling(false)
            edit.discard()
          }}
          onKeep={() => setCancelling(false)}
        />
      )}
    </>
  )
}
