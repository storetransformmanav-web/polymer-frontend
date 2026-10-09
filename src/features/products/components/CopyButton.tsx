import { useEffect, useState, type MouseEvent } from 'react'
import { CheckCircleIcon, CopyIcon } from '../../../components/ui/icons.tsx'

interface CopyButtonProps {
  value: string
  label: string
}

/** Tiny icon button that copies `value` and briefly confirms with a tick. */
export function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return undefined
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function handleClick(event: MouseEvent) {
    event.stopPropagation() // don't also open the row
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // Clipboard blocked (insecure context/permissions) — nothing to confirm.
    }
  }

  const Icon = copied ? CheckCircleIcon : CopyIcon

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center border-none bg-none p-0.5 transition-colors ${
        copied ? 'text-accent' : 'text-text-muted hover:text-text'
      }`}
    >
      <Icon width={15} height={15} />
    </button>
  )
}
