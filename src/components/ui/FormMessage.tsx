import { AlertTriangleIcon, CheckCircleIcon, ClockIcon } from './icons.tsx'

interface FormMessageProps {
  tone: 'error' | 'success' | 'info'
  children: string
}

const TONES = {
  error: { icon: AlertTriangleIcon, classes: 'bg-danger-bg text-danger', role: 'alert' },
  success: {
    icon: CheckCircleIcon,
    classes: 'bg-accent-tint text-accent',
    role: 'status',
  },
  info: {
    icon: ClockIcon,
    classes: 'bg-surface text-text-muted border border-border',
    role: 'status',
  },
} as const

/** Inline feedback line under a form control (errors are announced by screen readers). */
export function FormMessage({ tone, children }: FormMessageProps) {
  const { icon: Icon, classes, role } = TONES[tone]

  return (
    <p
      role={role}
      className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-left text-[0.85rem] leading-snug transition-all duration-200 starting:-translate-y-1 starting:opacity-0 ${classes}`}
    >
      <Icon width={16} height={16} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  )
}
