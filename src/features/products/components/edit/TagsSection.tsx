import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useAppSelector } from '../../../../app/store/hooks.ts'
import { useStoreTags } from '../../hooks/useStoreTags.ts'
import { matchSuggestions, mergeTags } from '../../utils/tagSuggestions.ts'
import { XIcon } from '../../../../components/ui/icons.tsx'
import type { SectionProps } from './fields.tsx'

/** Room the suggestion list wants below the box before it opens above it instead (px). */
const LIST_ROOM = 280

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
  /**
   * Existing values to offer while typing: every one that contains what has been typed (and
   * isn't already a chip) is listed under the box, to pick with the pointer or the arrow keys.
   */
  suggestions?: readonly string[]
  /**
   * With `suggestions`: also list every existing value as soon as the box is focused (before
   * anything is typed), so the whole set can be browsed and picked from.
   */
  suggestAll?: boolean
  /** The box was focused — a parent that loads the suggestions lazily starts loading here. */
  onActivate?: () => void
}

/**
 * A list of short values as chips in one card, with the box new ones are typed
 * into right inside the same card: each chip has a ✕, Enter or a comma adds what's
 * typed (pasting "a, b, c" adds three; blanks and duplicates are ignored),
 * Backspace in the empty box removes the last chip, and leaving the box keeps
 * what was typed. Used for a product's tags and for an option's values.
 *
 * With `suggestions`, typing opens a list of the matching existing values under the card
 * (drawn on top of the page, so the section's own clipping never cuts it): click one, or
 * move with the arrow keys and press Enter, and it is added. Escape closes the list; scrolling
 * the page does not — the list follows its card.
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
  suggestions = [],
  suggestAll = false,
  onActivate,
}: TagsInputProps) {
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)
  const box = useRef<HTMLInputElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const listId = useId()
  const list = useRef<HTMLUListElement>(null)
  // Which suggestion is highlighted (-1: none), and whether Escape put the list away.
  const [active, setActive] = useState(-1)
  const [dismissed, setDismissed] = useState(false)
  // Where the list goes: under the card (or above it when there is no room below), and
  // whether the card is on screen at all.
  const [place, setPlace] = useState<{
    left: number
    width: number
    top?: number
    bottom?: number
    visible: boolean
  } | null>(null)

  // What is being typed now: the text after the last comma.
  const query = input.split(',').pop() ?? ''
  const matches = useMemo(
    () =>
      // Browsing everything only while the box has the focus; typing narrows it down.
      matchSuggestions(suggestions, query, tags, suggestAll && focused),
    [suggestions, query, tags, suggestAll, focused],
  )
  const open = !dismissed && matches.length > 0 && place !== null && place.visible

  // Keep the list with its card: placed when there is something to show, and moved again
  // whenever the page scrolls or the window is resized (it is fixed to the screen, so it would
  // otherwise stay behind). It stays open while you scroll; it is only hidden for as long as
  // the card itself is scrolled out of view.
  useEffect(() => {
    if (matches.length === 0) return undefined
    function measure() {
      const rect = card.current?.getBoundingClientRect()
      if (!rect) return
      const below = window.innerHeight - rect.bottom
      const upward = below < LIST_ROOM && rect.top > below
      setPlace({
        left: rect.left,
        width: rect.width,
        // A box that isn't laid out (no size) can't be off screen; otherwise it must be in view.
        visible:
          (rect.width === 0 && rect.height === 0) ||
          (rect.bottom > 0 && rect.top < window.innerHeight),
        ...(upward
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      })
    }
    function onScroll(event: Event) {
      // Scrolling the list itself (a long one) moves nothing.
      if (event.target instanceof Node && list.current?.contains(event.target)) return
      measure()
    }
    measure()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', measure)
    }
  }, [matches.length, input])

  useEffect(() => {
    if (autoFocus) box.current?.focus()
  }, [autoFocus])

  function add(raw: string) {
    const fresh = splitTags(raw).filter((tag) => !tags.includes(tag))
    if (fresh.length) onChange([...tags, ...new Set(fresh)])
    setInput('')
  }

  /** Adds a suggestion, together with anything complete typed before a comma. */
  function pick(value: string) {
    const earlier = splitTags(input.split(',').slice(0, -1).join(','))
    const fresh = [...earlier, value].filter((tag) => !tags.includes(tag))
    if (fresh.length) onChange([...tags, ...new Set(fresh)])
    setInput('')
    setActive(-1)
    box.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (open && event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (index + 1) % matches.length)
    } else if (open && event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (index <= 0 ? matches.length - 1 : index - 1))
    } else if (open && event.key === 'Escape') {
      // Only the list closes; the section's own Escape (discard) is left for the next press.
      event.preventDefault()
      event.stopPropagation()
      setDismissed(true)
    } else if (event.key === 'Enter' && open && active >= 0) {
      event.preventDefault()
      pick(matches[active])
    } else if (event.key === 'Enter' || event.key === ',') {
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
        ref={card}
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
          role={suggestions.length > 0 ? 'combobox' : undefined}
          aria-expanded={suggestions.length > 0 ? open : undefined}
          aria-controls={open ? listId : undefined}
          aria-autocomplete={suggestions.length > 0 ? 'list' : undefined}
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(event) => {
            setInput(event.target.value)
            // Typing again brings the list back and starts from the top.
            setDismissed(false)
            setActive(-1)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setFocused(true)
            setDismissed(false)
            onActivate?.()
          }}
          onBlur={() => {
            setFocused(false)
            if (input.trim()) add(input)
          }}
          className="text-text placeholder:text-text-muted/70 min-w-32 flex-1 border-none bg-transparent px-1 py-1 text-[0.85rem] outline-none"
        />
      </div>
      {hint && <p className="text-text-muted text-[0.76rem]">{hint}</p>}

      {open &&
        place &&
        createPortal(
          <ul
            ref={list}
            id={listId}
            role="listbox"
            aria-label="Matching tags"
            style={{
              left: place.left,
              top: place.top,
              bottom: place.bottom,
              width: place.width,
            }}
            className="border-border bg-bg fixed z-50 max-h-64 overflow-y-auto rounded-xl border p-1.5 shadow-lg"
          >
            {matches.map((value, index) => (
              <li
                key={value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                // Keep the focus in the box: leaving it would add the half-typed text as a tag.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(value)}
                className={`cursor-pointer rounded-lg px-3 py-2 text-[0.85rem] font-medium ${
                  index === active ? 'bg-accent-tint text-accent' : 'text-text'
                }`}
              >
                {value}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
}

/**
 * The product's tags, being edited (in the Product Specifications form, with its Save).
 * Tags are changed as additions and removals, so a tag a colleague adds meanwhile is
 * never wiped out by this edit.
 */
export function TagsSection({ product, draft, onChange }: SectionProps) {
  // Every tag the product's store has (`GET /access/tags`), plus the ones seen on the products
  // loaded — so the list is complete, and still works when the tags call is not allowed.
  const seen = useAppSelector((state) => state.products.facets.tags)
  const { tags: storeTags } = useStoreTags([
    product.shop?.key ?? product.shop?.domain ?? '',
  ])
  const known = useMemo(() => mergeTags(storeTags, seen), [storeTags, seen])
  return (
    <TagsInput
      suggestions={known}
      suggestAll
      id="edit-tag-input"
      ariaLabel="Add tags"
      listLabel="Tags"
      removeLabel={(tag) => `Remove tag ${tag}`}
      tags={draft.tags}
      onChange={(tags) => onChange({ tags })}
      hint="Click the box to see every tag in the store and pick one, or type to narrow the list. Press Enter or a comma to add a new tag; separate several with commas. Tags are used for search and filters."
    />
  )
}
