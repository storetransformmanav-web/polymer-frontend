import { useTheme } from '../../hooks/useTheme.js'
import './ThemeToggle.css'

const THEME_META = {
  system: { icon: '🖥️', label: 'System' },
  light: { icon: '☀️', label: 'Light' },
  dark: { icon: '🌙', label: 'Dark' },
}

/**
 * Cycles system → light → dark → system. Reflects and controls the
 * theme set by `useTheme` (persisted, applied via `[data-theme]`).
 */
export function ThemeToggle() {
  const { theme, cycleTheme } = useTheme()
  const { icon, label } = THEME_META[theme]

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycleTheme}
      aria-label={`Theme: ${label}. Click to change.`}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="theme-toggle__label">{label}</span>
    </button>
  )
}
