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

interface TagsInputProps {
  id: string
  /** What the typing box is called for assistive technology ("Add tags"). */
  ariaLabel: string
  tags: string[]
  onChange: (tags: string[]) => void
  /** What the list of chips is called ('Tags'). */
  listLabel?: string
  /** The remove button's name for a chip ('Remove tag x'). */
  removeLabel?: (tag: string) => string
  /** Shown in the empty box when there are no chips yet. */
  placeholder?: string
  /** A line under the card (leave out for none). */
  hint?: string
  /** Put the cursor in the box when it appears. */
  autoFocus?: boolean
}

/**
 * A list of short values as chips in one card, with the box new ones are typed
 * into right inside the same card: each chip has a ✕, Enter or a comma adds what's
 * typed (pasting "a, b, c" adds three; blanks and duplicates are ignored),
 * Backspace in the empty box removes the last chip, and leaving the box keeps
 * what was typed. Used for a product's tags and for an option's values.
 */
export function TagsInput({
  id,
  ariaLabel,
  tags,
  onChange,
  listLabel = 'Values',
  removeLabel = (tag) => `Remove ${tag}`,
  placeholder = 'Type a tag and press Enter',
  hint,
  autoFocus = false,
}: TagsInputProps) {
  const [input, setInput] = useState('')
  const box = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) box.current?.focus()
  }, [autoFocus])

  function add(raw: string) {
    const fresh = splitTags(raw).filter((tag) => !tags.includes(tag))
    if (fresh.length) onChange([...tags, ...new Set(fresh)])
    setInput('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add(input)
    } else if (event.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Clicking anywhere in the card puts the cursor in the box. */}
      <div
        onClick={() => box.current?.focus()}
        className="border-border bg-bg focus-within:border-accent focus-within:outline-accent-tint flex cursor-text flex-wrap items-center gap-1.5 rounded-xl border p-2.5 transition-colors focus-within:outline-2"
      >
        {tags.length > 0 && (
          <ul aria-label={listLabel} className="contents">
            {tags.map((tag) => (
              <li key={tag} className={`${TAG_CHIP} flex items-center gap-1 pr-1.5`}>
                {tag}
                <button
                  type="button"
                  aria-label={removeLabel(tag)}
                  onClick={() => onChange(tags.filter((value) => value !== tag))}
                  className="hover:text-danger inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current transition-colors"
                >
                  <XIcon width={12} height={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          id={id}
          ref={box}
          aria-label={ariaLabel}
          autoComplete="off"
          value={input}
          placeholder={tags.length > 0 ? 'Add another' : placeholder}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => input.trim() && add(input)}
          className="text-text placeholder:text-text-muted/70 min-w-32 flex-1 border-none bg-transparent px-1 py-1 text-[0.85rem] outline-none"
        />
      </div>
      {hint && <p className="text-text-muted text-[0.76rem]">{hint}</p>}
    </div>
  )
}

/**
 * The product's tags, being edited (in the Product Specifications form, with its Save).
 * Tags are changed as additions and removals, so a tag a colleague adds meanwhile is
 * never wiped out by this edit.
 */
export function TagsSection({ draft, onChange }: SectionProps) {
  return (
    <TagsInput
      id="edit-tag-input"
      ariaLabel="Add tags"
      listLabel="Tags"
      removeLabel={(tag) => `Remove tag ${tag}`}
      tags={draft.tags}
      onChange={(tags) => onChange({ tags })}
      hint="Press Enter or a comma to add a tag; separate several with commas. Tags are used for search and filters."
    />
  )
}
