import { useMemo, useState } from 'react'
import type {
  ProductDetail,
  ProductUpdateBody,
  ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import {
  buildUpdateBody,
  draftFromProduct,
  hasChanges,
  validateDraft,
  type DraftErrors,
  type ProductDraft,
} from '../utils/editDraft.ts'
import { useSaveProduct } from './useSaveProduct.ts'

/** Told when a section's edit has been saved (the page shows the notice and tracks the push). */
export type SavedHandler = (
  result: ProductWriteResult,
  product: ProductDetail,
  body: ProductUpdateBody,
) => void

interface SectionEditOptions {
  /**
   * Which validation problems belong to this section (matched against the
   * start of each error key). The rest of the product isn't being edited, so
   * its problems must not block this save.
   */
  errorPrefixes: readonly string[]
  onSaved?: SavedHandler
}

/**
 * Edit one section of the details page in place: start, change fields, then
 * save or discard. Each section keeps its own working copy of the product,
 * taken when editing starts, and sends only what changed in it — so saving the
 * specifications never touches the variants, and a colleague's change to a
 * field you didn't edit is never reverted.
 */
export function useSectionEdit(product: ProductDetail, options: SectionEditOptions) {
  const { errorPrefixes, onSaved } = options
  // The product as it was when editing started, and the working copy being changed.
  const [session, setSession] = useState<{
    baseline: ProductDetail
    draft: ProductDraft
  } | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  // Save was pressed and the changes are valid: waiting for "Yes, update".
  const [confirming, setConfirming] = useState(false)
  const { save, isSaving, error, clearError } = useSaveProduct()

  const body = useMemo<ProductUpdateBody>(
    () => (session ? buildUpdateBody(session.baseline, session.draft) : {}),
    [session],
  )
  const scopedErrors = useMemo<DraftErrors>(() => {
    if (!session) return {}
    const all = validateDraft(session.baseline, session.draft)
    return Object.fromEntries(
      Object.entries(all).filter(([key]) =>
        errorPrefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}.`)),
      ),
    )
  }, [session, errorPrefixes])

  const hasProblems = Object.keys(scopedErrors).length > 0
  const dirty = hasChanges(body)

  function start() {
    clearError()
    setShowErrors(false)
    setSession({ baseline: product, draft: draftFromProduct(product) })
  }

  function discard() {
    if (isSaving) return
    clearError()
    setShowErrors(false)
    setConfirming(false)
    setSession(null)
  }

  function change(patch: Partial<ProductDraft>) {
    setSession((current) =>
      current ? { ...current, draft: { ...current.draft, ...patch } } : current,
    )
    if (error) clearError()
  }

  /** Save was pressed: check the fields, then ask before anything is sent. */
  function commit() {
    if (!session || !dirty || isSaving) return
    setShowErrors(true)
    if (hasProblems) return
    setConfirming(true)
  }

  function cancelConfirm() {
    setConfirming(false)
  }

  /** "Yes, update": save it (the product is then also updated in Shopify). */
  async function confirmSave() {
    setConfirming(false)
    if (!session || !dirty || isSaving) return

    const result = await save({
      id: session.baseline.id,
      body,
      shop: session.baseline.shop?.key,
    })
    if (result) {
      setSession(null)
      setShowErrors(false)
      onSaved?.(result, session.baseline, body)
    }
  }

  return {
    editing: session !== null,
    /** The product as it was when editing started (only while editing). */
    baseline: session?.baseline ?? null,
    draft: session?.draft ?? null,
    /** Problems to show — none until a save has been attempted. */
    errors: showErrors ? scopedErrors : {},
    hasProblems,
    showErrors,
    dirty,
    isSaving,
    /** The backend's message when the save failed. */
    error,
    /** Asking "are you sure?" before the save is sent. */
    confirming,
    start,
    discard,
    change,
    commit,
    cancelConfirm,
    confirmSave,
  }
}

export type SectionEdit = ReturnType<typeof useSectionEdit>
