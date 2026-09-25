import type { ComponentType } from 'react'
import { useTheme, type Theme } from '../../hooks/useTheme.ts'
import { MonitorIcon, MoonIcon, SunIcon, type IconProps } from './icons.tsx'
import './ThemeToggle.css'

interface ThemeOption {
  value: Theme
  label: string
  icon: ComponentType<IconProps>
}

const OPTIONS: ThemeOption[] = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'System', icon: MonitorIcon },
]

/**
 * Segmented light/dark/system control. Lives in the AppBar's UserMenu
 * rather than as a standalone AppBar button. Reflects and controls the
 * theme set by `useTheme` (persisted, applied via `[data-theme]`).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          className={`theme-toggle__option${theme === value ? ' theme-toggle__option--active' : ''}`}
          onClick={() => setTheme(value)}
        >
          <Icon />
          {label}
        </button>
      ))}
    </div>
  )
}
