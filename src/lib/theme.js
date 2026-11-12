const KEY = 'node-theme'

export function readTheme() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage can be blocked. The desk still opens in dark mode.
  }
  return 'dark'
}

export function writeTheme(theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // The choice still applies until the page closes.
  }
}
