import { useEffect, useRef, useState } from 'react'

/**
 * A text field whose typing is instant but whose committed value is
 * debounced — for inputs that trigger a request (search, price range).
 * `draft` updates on every keystroke; `commit(draft)` runs once the user
 * pauses for `delay` ms. If `external` changes underneath (e.g. a "clear
 * all" button), the draft follows it.
 */
export function useDebouncedField(
  external: string,
  commit: (value: string) => void,
  delay = 350,
) {
  const [draft, setDraft] = useState(external)
  const [seenExternal, setSeenExternal] = useState(external)

  if (external !== seenExternal) {
    setSeenExternal(external)
    setDraft(external)
  }

  // Always call the latest `commit` without restarting the timer when its
  // identity changes between renders.
  const commitRef = useRef(commit)
  useEffect(() => {
    commitRef.current = commit
  })

  useEffect(() => {
    if (draft === external) return undefined
    const timer = window.setTimeout(() => commitRef.current(draft), delay)
    return () => window.clearTimeout(timer)
  }, [draft, external, delay])

  return [draft, setDraft] as const
}
