import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { XIcon } from '../../../../components/ui/icons.tsx'
import type { SectionProps } from './fields.tsx'

/** A tag chip: the same pill whether the tags are shown or being edited. */
export const TAG_CHIP =
  'bg-surface text-text border-border rounded-md border px-2.5 py-1 text-[0.8rem] font-medium'

/** "a, b ,c" → ["a", "b", "c"] — trimmed, without blanks. */
function splitTags(input: string): string[] {
  return input
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

/**
 * The product's tags, being edited: one card holding every tag as a chip (each
 * with a ✕) and, right in the same card, the box new tags are typed into. Enter
 * or a comma adds what's typed (pasting "a, b, c" adds three); Backspace in the
 * empty box removes the last tag. Tags are changed as additions and removals,
 * so a tag a colleague adds meanwhile is never wiped out by this edit.
 */
export function TagsSection({ draft, onChange }: SectionProps) {
  const [input, setInput] = useState('')
  const box = useRef<HTMLInputElement>(null)

  // Opened from the ⊕ button: the cursor is ready in the card.
  useEffect(() => {
    box.current?.focus()
  }, [])

  function add(raw: string) {
    const fresh = splitTags(raw).filter((tag) => !draft.tags.includes(tag))
    if (fresh.length) onChange({ tags: [...draft.tags, ...new Set(fresh)] })
    setInput('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add(input)
    } else if (event.key === 'Backspace' && input === '' && draft.tags.length > 0) {
      onChange({ tags: draft.tags.slice(0, -1) })
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Clicking anywhere in the card puts the cursor in the box. */}
      <div
        onClick={() => box.current?.focus()}
        className="border-border bg-bg focus-within:border-accent focus-within:outline-accent-tint flex cursor-text flex-wrap items-center gap-1.5 rounded-xl border p-2.5 transition-colors focus-within:outline-2"
      >
        {draft.tags.length > 0 && (
          <ul aria-label="Tags" className="contents">
            {draft.tags.map((tag) => (
              <li key={tag} className={`${TAG_CHIP} flex items-center gap-1 pr-1.5`}>
                {tag}
                <button
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() =>
                    onChange({ tags: draft.tags.filter((value) => value !== tag) })
                  }
                  className="hover:text-danger inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current transition-colors"
                >
                  <XIcon width={12} height={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          id="edit-tag-input"
          ref={box}
          aria-label="Add tags"
          autoComplete="off"
          value={input}
          placeholder={draft.tags.length > 0 ? 'Add a tag' : 'Type a tag and press Enter'}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => input.trim() && add(input)}
          className="text-text placeholder:text-text-muted/70 min-w-32 flex-1 border-none bg-transparent px-1 py-1 text-[0.85rem] outline-none"
        />
      </div>
      <p className="text-text-muted text-[0.76rem]">
        Press Enter or a comma to add a tag; separate several with commas. Tags are used
        for search and filters.
      </p>
    </div>
  )
}
