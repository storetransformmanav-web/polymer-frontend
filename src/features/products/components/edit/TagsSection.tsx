import { useState, type KeyboardEvent } from 'react'
import { XIcon } from '../../../../components/ui/icons.tsx'
import { FIELD_INPUT, type SectionProps } from './fields.tsx'

/** "a, b ,c" → ["a", "b", "c"] — trimmed, without blanks. */
function splitTags(input: string): string[] {
  return input
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

/**
 * The product's tags as removable chips, with a box to add more. Enter or a
 * comma adds what's typed (pasting "a, b, c" adds three); Backspace in the
 * empty box removes the last tag. Tags are changed as additions and removals,
 * so a tag a colleague adds meanwhile is never wiped out by this edit.
 */
export function TagsSection({ draft, onChange }: SectionProps) {
  const [input, setInput] = useState('')

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
    <div className="flex flex-col gap-3">
      {draft.tags.length > 0 ? (
        <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
          {draft.tags.map((tag) => (
            <li
              key={tag}
              className="bg-accent-tint text-accent flex items-center gap-1 rounded-full py-1 pr-1.5 pl-3 text-[0.8rem] font-semibold"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() =>
                  onChange({ tags: draft.tags.filter((value) => value !== tag) })
                }
                className="hover:bg-accent/15 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current transition-colors"
              >
                <XIcon width={12} height={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-text-muted text-[0.85rem]">No tags yet.</p>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="edit-tag-input"
          className="text-text text-[0.82rem] font-semibold"
        >
          Add tags
        </label>
        <input
          id="edit-tag-input"
          autoComplete="off"
          value={input}
          placeholder="Type a tag and press Enter"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => input.trim() && add(input)}
          className={FIELD_INPUT}
        />
        <p className="text-text-muted text-[0.76rem]">
          Separate several tags with commas. Tags are used for search and filters.
        </p>
      </div>
    </div>
  )
}
