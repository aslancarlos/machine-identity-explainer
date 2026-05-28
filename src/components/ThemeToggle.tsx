import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../lib/useTheme'

/**
 * IDIRA theme toggle button. 44×44px touch target, ARIA-labeled.
 */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={isDark}
      className={
        'inline-flex items-center justify-center w-11 h-11 rounded-full ' +
        'border border-border bg-surface text-text ' +
        'hover:bg-bg-muted hover:border-text-muted ' +
        'transition-all duration-200 ' +
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-idira-blue focus-visible:outline-offset-2 ' +
        'hover:rotate-12 ' +
        className
      }
    >
      {isDark
        ? <Sun  size={18} aria-hidden="true" />
        : <Moon size={18} aria-hidden="true" />}
    </button>
  )
}
