// Sets [data-theme] before first paint so the stored/default theme doesn't
// flash the wrong mode while React loads. Light is the default (not the OS
// preference) unless the user explicitly picks 'dark' or 'system'.
//
// This is a separate same-origin file (not an inline <script>) so the
// Content-Security-Policy in vercel.json can forbid inline scripts.
// Keep it in sync with src/app/store/uiSlice.ts (THEME_STORAGE_KEY).
;(function () {
  try {
    var theme = localStorage.getItem('polymer-crm:theme')
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else if (theme !== 'system') {
      document.documentElement.setAttribute('data-theme', 'light')
    }
  } catch {
    // localStorage unavailable — default to light.
    document.documentElement.setAttribute('data-theme', 'light')
  }
})()
