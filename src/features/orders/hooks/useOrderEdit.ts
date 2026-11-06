import { useMemo, useState } from 'react'
import type { OrderDetail } from '../../../lib/api/endpoints.ts'
import {
  buildOrderUpdateBody,
  describeOrderChanges,
  draftFromOrder,
  validateOrderEdit,
  type OrderEditDraft,
} from '../utils/orderEdit.ts'
import { useUpdateOrder } from './useUpdateOrder.ts'

/** Told when the backend has accepted a change; `message` is its own, when it sent one. */
export type OrderSavedHandler = (message: string) => void

/**
 * One in-place edit of an order, as on a product's page: the pencil (`start`) or a double-clicked
 * value (`ask`) opens it, ✓ (`commit`) checks what changed and asks, and only "Yes, update"
 * (`confirmSave`) sends the one `PATCH`. The draft is frozen from the order when the edit opens,
 * so only this edit's changes go out. Nothing on screen is changed from what was typed:
 * `useUpdateOrder` reads the order again once the backend has confirmed.
 */
export function useOrderEdit(
  order: OrderDetail,
  reference: string,
  shop: string | null,
  onSaved: OrderSavedHandler,
) {
  const { update, isUpdating, error, clearError } = useUpdateOrder(reference, shop)
  const [initial, setInitial] = useState<OrderEditDraft | null>(null)
  const [draft, setDraft] = useState<OrderEditDraft | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [confirming, setConfirming] = useState(false)
  // A double-clicked value has no fields of its own to go back to when the question is cancelled.
  const [single, setSingle] = useState(false)
  const [staffNote, setStaffNote] = useState('')

  const problems = useMemo(
    () => (draft && initial ? validateOrderEdit(draft, initial) : {}),
    [draft, initial],
  )
  const body = useMemo(
    () => (draft && initial ? buildOrderUpdateBody(draft, initial) : {}),
    [draft, initial],
  )

  function reset() {
    setInitial(null)
    setDraft(null)
    setShowErrors(false)
    setConfirming(false)
    setSingle(false)
    setStaffNote('')
    clearError()
  }

  function start() {
    const from = draftFromOrder(order)
    setInitial(from)
    setDraft(from)
  }

  /** A value changed where it is shown: straight to the question. */
  function ask(patch: Partial<OrderEditDraft>) {
    const from = draftFromOrder(order)
    setInitial(from)
    setDraft({ ...from, ...patch })
    setSingle(true)
    setConfirming(true)
  }

  function change(patch: Partial<OrderEditDraft>) {
    clearError()
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }

  function commit() {
    setShowErrors(true)
    if (Object.keys(problems).length === 0) setConfirming(true)
  }

  function cancelConfirm() {
    if (single) reset()
    else {
      setConfirming(false)
      setStaffNote('')
      clearError()
    }
  }

  async function confirmSave() {
    const note = staffNote.trim()
    try {
      const result = await update({ ...body, ...(note ? { staff_note: note } : {}) })
      reset()
      onSaved(result.message)
    } catch {
      // The backend's message shows in the question, which stays open.
    }
  }

  return {
    editing: draft !== null && !single,
    draft,
    errors: showErrors ? problems : {},
    /** Something differs from when the edit opened. */
    dirty: Object.keys(body).length > 0,
    changes: describeOrderChanges(body, order),
    confirming,
    isUpdating,
    error,
    staffNote,
    setStaffNote,
    start,
    ask,
    change,
    commit,
    discard: reset,
    cancelConfirm,
    confirmSave,
  }
}

export type OrderEdit = ReturnType<typeof useOrderEdit>
