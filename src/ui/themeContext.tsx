import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { ThemeMode, ThemeColors } from './theme'
import { lightTheme, darkTheme, amoledTheme } from './theme'

interface ThemeContextType {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  colors: ThemeColors
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('splitpay_theme_mode') as ThemeMode | null
      if (saved && ['system', 'light', 'dark', 'amoled'].includes(saved)) {
        return saved
      }
    }
    return 'system'
  })

  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('splitpay_theme_mode', newMode)
    }
  }

  const isDark = mode === 'amoled' || mode === 'dark' || (mode === 'system' && systemDark)
  const colors = mode === 'amoled' ? amoledTheme : isDark ? darkTheme : lightTheme

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--color-bg', colors.bg)
    root.style.setProperty('--color-surface', colors.surface)
    root.style.setProperty('--color-surface-subtle', colors.surfaceSubtle)
    root.style.setProperty('--color-surface-elevated', colors.surfaceElevated)
    root.style.setProperty('--color-border', colors.border)
    root.style.setProperty('--color-border-subtle', colors.borderSubtle)
    root.style.setProperty('--color-text', colors.text)
    root.style.setProperty('--color-text-muted', colors.textMuted)
    root.style.setProperty('--color-text-subtle', colors.textSubtle)
    root.style.setProperty('--color-primary', colors.primary)
    root.style.setProperty('--color-primary-hover', colors.primaryHover)
    root.style.setProperty('--color-primary-text', colors.primaryText)
    root.style.setProperty('--color-positive', colors.positive)
    root.style.setProperty('--color-positive-bg', colors.positiveBg)
    root.style.setProperty('--color-negative', colors.negative)
    root.style.setProperty('--color-negative-bg', colors.negativeBg)
    root.style.setProperty('--color-warning', colors.warning)
    root.style.setProperty('--color-chip-track', colors.chipTrack)

    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [colors, isDark])

  return (
    <ThemeContext.Provider value={{ mode, setMode, colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
