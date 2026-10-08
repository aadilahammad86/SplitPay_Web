import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ThemeMode, ThemeColors, ColorPaletteId, PaletteDefinition } from './theme'
import { lightTheme, darkTheme, amoledTheme, colorPalettes } from './theme'

interface ThemeContextType {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  palette: ColorPaletteId
  setPalette: (palette: ColorPaletteId) => void
  availablePalettes: PaletteDefinition[]
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

  const [palette, setPaletteState] = useState<ColorPaletteId>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('splitpay_color_palette') as ColorPaletteId | null
      if (saved && colorPalettes[saved]) {
        return saved
      }
    }
    return 'emerald' // Default to SplitPay iconic Emerald
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

  const setPalette = (newPalette: ColorPaletteId) => {
    if (!colorPalettes[newPalette]) return
    setPaletteState(newPalette)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('splitpay_color_palette', newPalette)
    }
  }

  const isDark = mode === 'amoled' || mode === 'dark' || (mode === 'system' && systemDark)
  const baseColors = mode === 'amoled' ? amoledTheme : isDark ? darkTheme : lightTheme
  const currentPaletteDef = colorPalettes[palette] || colorPalettes.emerald
  const paletteTokens = isDark ? currentPaletteDef.dark : currentPaletteDef.light

  const colors: ThemeColors = useMemo(() => ({
    ...baseColors,
    primary: paletteTokens.primary,
    primaryHover: paletteTokens.primaryHover,
    primaryText: paletteTokens.primaryText,
    chipTrack: paletteTokens.chipTrack,
  }), [baseColors, paletteTokens])

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
    root.style.setProperty('--color-primary-subtle', paletteTokens.primarySubtle)
    root.style.setProperty('--color-primary-border', paletteTokens.primaryBorder)
    root.style.setProperty('--color-primary-glow', paletteTokens.ring)
    root.style.setProperty('--primary-gradient-from', paletteTokens.gradientFrom)
    root.style.setProperty('--primary-gradient-to', paletteTokens.gradientTo)
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
  }, [colors, paletteTokens, isDark])

  const availablePalettes = Object.values(colorPalettes)

  return (
    <ThemeContext.Provider
      value={{
        mode,
        setMode,
        palette,
        setPalette,
        availablePalettes,
        colors,
        isDark,
      }}
    >
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
