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

/**
 * Migrate legacy palette IDs saved in localStorage to the new 3-palette set.
 * Returns the closest match, or null if already valid / unknown.
 */
function migratePaletteId(saved: string): ColorPaletteId | null {
  const map: Record<string, ColorPaletteId> = {
    emerald: 'jade',
    ocean: 'electric',
    indigo: 'electric',
    amber: 'copper',
    rose: 'jade',
    slate: 'jade',
  }
  return map[saved] ?? null
}

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
      const saved = localStorage.getItem('splitpay_color_palette')
      if (saved && colorPalettes[saved as ColorPaletteId]) {
        return saved as ColorPaletteId
      }
      // Migrate legacy palette IDs
      if (saved) {
        const migrated = migratePaletteId(saved)
        if (migrated) {
          localStorage.setItem('splitpay_color_palette', migrated)
          return migrated
        }
      }
    }
    return 'jade'
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
  const currentPaletteDef = colorPalettes[palette] || colorPalettes.jade
  const paletteTokens = isDark ? currentPaletteDef.dark : currentPaletteDef.light

  const colors: ThemeColors = useMemo(() => ({
    ...baseColors,
    primary: paletteTokens.primary,
    primaryHover: paletteTokens.primaryHover,
    primaryActive: paletteTokens.primaryActive,
    primaryText: paletteTokens.primaryText,
    primarySubtle: paletteTokens.primarySubtle,
    primaryBorder: paletteTokens.primaryBorder,
    primaryGlow: paletteTokens.ring,
    chipTrack: paletteTokens.chipTrack,
  }), [baseColors, paletteTokens])

  useEffect(() => {
    const root = document.documentElement

    /* Surface layers */
    root.style.setProperty('--color-bg', colors.bg)
    root.style.setProperty('--color-surface', colors.surface)
    root.style.setProperty('--color-surface-subtle', colors.surfaceSubtle)
    root.style.setProperty('--color-surface-raised', colors.surfaceRaised)
    root.style.setProperty('--color-surface-elevated', colors.surfaceElevated)
    root.style.setProperty('--color-surface-overlay', colors.surfaceOverlay)

    /* Borders */
    root.style.setProperty('--color-border', colors.border)
    root.style.setProperty('--color-border-subtle', colors.borderSubtle)

    /* Text hierarchy */
    root.style.setProperty('--color-text', colors.text)
    root.style.setProperty('--color-text-secondary', colors.textSecondary)
    root.style.setProperty('--color-text-muted', colors.textMuted)
    root.style.setProperty('--color-text-subtle', colors.textSubtle)
    root.style.setProperty('--color-text-disabled', colors.textDisabled)

    /* Brand */
    root.style.setProperty('--color-primary', colors.primary)
    root.style.setProperty('--color-primary-hover', colors.primaryHover)
    root.style.setProperty('--color-primary-active', colors.primaryActive)
    root.style.setProperty('--color-primary-text', colors.primaryText)
    root.style.setProperty('--color-primary-subtle', colors.primarySubtle)
    root.style.setProperty('--color-primary-border', colors.primaryBorder)
    root.style.setProperty('--color-primary-glow', colors.primaryGlow)
    root.style.setProperty('--primary-gradient-from', paletteTokens.gradientFrom)
    root.style.setProperty('--primary-gradient-to', paletteTokens.gradientTo)

    /* Semantic money colors */
    root.style.setProperty('--color-owed', colors.owed)
    root.style.setProperty('--color-owed-bg', colors.owedBg)
    root.style.setProperty('--color-owed-border', colors.owedBorder)
    root.style.setProperty('--color-owe', colors.owe)
    root.style.setProperty('--color-owe-bg', colors.oweBg)
    root.style.setProperty('--color-owe-border', colors.oweBorder)
    root.style.setProperty('--color-pending', colors.pending)
    root.style.setProperty('--color-pending-bg', colors.pendingBg)
    root.style.setProperty('--color-pending-border', colors.pendingBorder)
    root.style.setProperty('--color-settled', colors.settled)
    root.style.setProperty('--color-settled-bg', colors.settledBg)

    /* Legacy semantic */
    root.style.setProperty('--color-positive', colors.positive)
    root.style.setProperty('--color-positive-bg', colors.positiveBg)
    root.style.setProperty('--color-negative', colors.negative)
    root.style.setProperty('--color-negative-bg', colors.negativeBg)
    root.style.setProperty('--color-warning', colors.warning)

    /* Status */
    root.style.setProperty('--color-danger', colors.danger)
    root.style.setProperty('--color-danger-bg', colors.dangerBg)
    root.style.setProperty('--color-info', colors.info)
    root.style.setProperty('--color-info-bg', colors.infoBg)

    /* Misc */
    root.style.setProperty('--color-chip-track', colors.chipTrack)

    /* Shadow glow updates with palette color */
    root.style.setProperty('--shadow-glow', `0 0 20px ${colors.primaryGlow}`)

    root.setAttribute('data-theme', mode)
    root.setAttribute('data-palette', palette)

    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [colors, paletteTokens, isDark, mode, palette])

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
