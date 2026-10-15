import { useState } from 'react'
import { Badge } from '../../../../components/ui/Badge.tsx'
import { PlusIcon, XIcon } from '../../../../components/ui/icons.tsx'
import { FIELD_INPUT, TEXT_BUTTON, type SectionProps } from './fields.tsx'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Remove the product from a collection, or put it in one by its ID. The
 * backend has no "list collections" endpoint yet, so adding is by CRM
 * collection ID (a UUID) rather than from a picker.
 */
export function CollectionsSection({ product, draft, errors, onChange }: SectionProps) {
  const [input, setInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const removed = new Set(draft.removedCollectionIds)

  function toggleRemoved(id: string) {
    onChange({
      removedCollectionIds: removed.has(id)
        ? draft.removedCollectionIds.filter((value) => value !== id)
        : [...draft.removedCollectionIds, id],
    })
  }

  function add() {
    const id = input.trim().toLowerCase()
    if (!id) return
    if (!UUID.test(id)) return setInputError('That is not a valid collection ID')
    if (product.collections.some((collection) => collection.id === id)) {
      return setInputError('The product is already in that collection')
    }
    if (draft.addedCollectionIds.includes(id)) return setInputError('Already added')
    onChange({ addedCollectionIds: [...draft.addedCollectionIds, id] })
    setInput('')
    setInputError(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {product.collections.length === 0 && draft.addedCollectionIds.length === 0 ? (
        <p className="text-text-muted text-[0.85rem]">
          This product is not in any collection.
        </p>
      ) : (
        <ul aria-label="Collections" className="flex flex-col gap-2">
          {product.collections.map((collection) => {
            const isRemoved = removed.has(collection.id)
            return (
              <li
                key={collection.id}
                className="border-border flex items-center gap-3 rounded-xl border px-3.5 py-2.5"
              >
                <div className={`min-w-0 flex-1 ${isRemoved ? 'opacity-50' : ''}`}>
                  <p
                    className={`truncate text-[0.88rem] font-semibold ${isRemoved ? 'line-through' : ''}`}
                  >
                    {collection.title}
                  </p>
                  <p className="text-text-muted truncate font-mono text-[0.74rem]">
                    {collection.handle}
                  </p>
                </div>
                {isRemoved && <Badge tone="danger">Will be removed</Badge>}
                <button
                  type="button"
                  onClick={() => toggleRemoved(collection.id)}
                  aria-label={
                    isRemoved
                      ? `Keep ${collection.title}`
                      : `Remove from ${collection.title}`
                  }
                  className={
                    isRemoved
                      ? TEXT_BUTTON
                      : 'text-text-muted hover:text-danger cursor-pointer border-none bg-transparent p-1 transition-colors'
                  }
                >
                  {isRemoved ? 'Undo' : <XIcon width={16} height={16} />}
                </button>
              </li>
            )
          })}
          {draft.addedCollectionIds.map((id, index) => (
            <li
              key={id}
              className="border-accent/40 bg-accent-tint/40 flex items-center gap-3 rounded-xl border px-3.5 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[0.88rem] font-semibold">Collection to add</p>
                <p className="text-text-muted truncate font-mono text-[0.74rem]">{id}</p>
                {errors[`addedCollections.${index}`] && (
                  <p role="alert" className="text-danger text-[0.78rem]">
                    {errors[`addedCollections.${index}`]}
                  </p>
                )}
              </div>
              <Badge tone="success">New</Badge>
              <button
                type="button"
                aria-label={`Don't add collection ${id}`}
                onClick={() =>
                  onChange({
                    addedCollectionIds: draft.addedCollectionIds.filter(
                      (value) => value !== id,
                    ),
                  })
                }
                className="text-text-muted hover:text-danger cursor-pointer border-none bg-transparent p-1 transition-colors"
              >
                <XIcon width={16} height={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="edit-collection-id"
          className="text-text text-[0.82rem] font-semibold"
        >
          Add to a collection by ID
        </label>
        <div className="flex gap-2">
          <input
            id="edit-collection-id"
            autoComplete="off"
            spellCheck={false}
            value={input}
            placeholder="3fa85f64-5717-4562-b3fc-2c963f66afa6"
            aria-invalid={inputError ? true : undefined}
            onChange={(event) => {
              setInput(event.target.value)
              setInputError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                add()
              }
            }}
            className={`${FIELD_INPUT} font-mono text-[0.8rem]`}
          />
          <button
            type="button"
            onClick={add}
            disabled={!input.trim()}
            className="border-border bg-bg text-text hover:border-accent inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
          >
            <PlusIcon width={14} height={14} />
            Add
          </button>
        </div>
        {inputError && (
          <p role="alert" className="text-danger text-[0.78rem]">
            {inputError}
          </p>
        )}
      </div>
    </div>
  )
}
