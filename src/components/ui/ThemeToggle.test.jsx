import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { THEME_STORAGE_KEY } from '../../hooks/useTheme.js'
import { ThemeToggle } from './ThemeToggle.jsx'

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('cycles system → light → dark → system, persisting and applying each choice', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    const button = screen.getByRole('button')

    expect(button).toHaveAccessibleName(/System/)
    expect(document.documentElement).not.toHaveAttribute('data-theme')

    await user.click(button)
    expect(button).toHaveAccessibleName(/Light/)
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')

    await user.click(button)
    expect(button).toHaveAccessibleName(/Dark/)
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    await user.click(button)
    expect(button).toHaveAccessibleName(/System/)
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })
})
