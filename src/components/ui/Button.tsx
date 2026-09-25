import type { ButtonHTMLAttributes } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent px-4 py-2 font-medium cursor-pointer disabled:opacity-70 disabled:pointer-events-none'

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-accent text-accent-contrast hover:bg-accent-hover',
  secondary: 'border-border text-text bg-transparent',
}

/**
 * Generic, unstyled-by-feature button primitive. This is the kind of
 * component that belongs in `components/ui`: no knowledge of any
 * specific feature, reused across the app.
 */
export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className}`.trim()}
      {...props}
    />
  )
}
