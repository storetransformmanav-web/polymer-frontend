import { AlertTriangleIcon, CheckCircleIcon } from '../../../components/ui/icons.tsx'

interface FormMessageProps {
  tone: 'error' | 'success'
  children: string
}

/** Inline feedback line under a form control (errors are announced by screen readers). */
export function FormMessage({ tone, children }: FormMessageProps) {
  const isError = tone === 'error'
  const Icon = isError ? AlertTriangleIcon : CheckCircleIcon

  return (
    <p
      role={isError ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-left text-[0.85rem] leading-snug transition-all duration-200 starting:-translate-y-1 starting:opacity-0 ${
        isError ? 'bg-danger-bg text-danger' : 'bg-accent-tint text-accent'
      }`}
    >
      <Icon width={16} height={16} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  )
}
