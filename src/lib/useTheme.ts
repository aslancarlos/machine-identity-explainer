import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'idira-theme'

function readInitial(): Theme {
  if (typeof window === 'undefined') return 'dark'
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // localStorage blocked — fall through to system pref
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  html.dataset.theme = theme
  html.classList.toggle('dark', theme === 'dark')
}

/**
 * useTheme — IDIRA dark/light theme hook.
 *
 * - Reads initial theme from `localStorage('idira-theme')`,
 *   falling back to `prefers-color-scheme`.
 * - Applies `data-theme` and `.dark` on `<html>`.
 * - Persists user selection to localStorage.
 * - Listens for system theme changes (only when user has no explicit choice).
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitial)

  // Apply on mount and whenever it changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Listen to system pref changes when user hasn't chosen explicitly
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = (e: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem(STORAGE_KEY)) return
      } catch {
        return
      }
      setTheme(e.matches ? 'light' : 'dark')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
      return next
    })
  }, [])

  return { theme, toggle, setTheme }
}
