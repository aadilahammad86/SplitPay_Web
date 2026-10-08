export type ThemeMode = 'system' | 'light' | 'dark' | 'amoled'

export type ColorPaletteId = 'emerald' | 'ocean' | 'indigo' | 'amber' | 'rose' | 'slate'

export interface PaletteModeTokens {
  primary: string
  primaryHover: string
  primarySubtle: string
  primaryBorder: string
  primaryText: string
  chipTrack: string
  ring: string
  gradientFrom: string
  gradientTo: string
}

export interface PaletteDefinition {
  id: ColorPaletteId
  name: string
  label: string
  swatchHex: string
  light: PaletteModeTokens
  dark: PaletteModeTokens
}

export const colorPalettes: Record<ColorPaletteId, PaletteDefinition> = {
  emerald: {
    id: 'emerald',
    name: 'Split Emerald',
    label: 'Split Emerald',
    swatchHex: '#10b981',
    light: {
      primary: '#059669',
      primaryHover: '#047857',
      primarySubtle: '#ecfdf5',
      primaryBorder: '#a7f3d0',
      primaryText: '#ffffff',
      chipTrack: '#d1fae5',
      ring: 'rgba(5, 150, 105, 0.25)',
      gradientFrom: '#059669',
      gradientTo: '#047857',
    },
    dark: {
      primary: '#10b981',
      primaryHover: '#34d399',
      primarySubtle: 'rgba(16, 185, 129, 0.15)',
      primaryBorder: 'rgba(16, 185, 129, 0.3)',
      primaryText: '#064e3b',
      chipTrack: 'rgba(6, 78, 59, 0.5)',
      ring: 'rgba(16, 185, 129, 0.3)',
      gradientFrom: '#064e3b',
      gradientTo: '#065f46',
    },
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Blue',
    label: 'Ocean Blue',
    swatchHex: '#3b82f6',
    light: {
      primary: '#2563eb',
      primaryHover: '#1d4ed8',
      primarySubtle: '#eff6ff',
      primaryBorder: '#bfdbfe',
      primaryText: '#ffffff',
      chipTrack: '#dbeafe',
      ring: 'rgba(37, 99, 235, 0.25)',
      gradientFrom: '#2563eb',
      gradientTo: '#1e40af',
    },
    dark: {
      primary: '#3b82f6',
      primaryHover: '#60a5fa',
      primarySubtle: 'rgba(59, 130, 246, 0.15)',
      primaryBorder: 'rgba(59, 130, 246, 0.3)',
      primaryText: '#1e3a8a',
      chipTrack: 'rgba(30, 58, 138, 0.5)',
      ring: 'rgba(59, 130, 246, 0.3)',
      gradientFrom: '#1e3a8a',
      gradientTo: '#1e40af',
    },
  },
  indigo: {
    id: 'indigo',
    name: 'Royal Violet',
    label: 'Royal Violet',
    swatchHex: '#6366f1',
    light: {
      primary: '#4f46e5',
      primaryHover: '#4338ca',
      primarySubtle: '#eef2ff',
      primaryBorder: '#c7d2fe',
      primaryText: '#ffffff',
      chipTrack: '#e0e7ff',
      ring: 'rgba(79, 70, 229, 0.25)',
      gradientFrom: '#4f46e5',
      gradientTo: '#3730a3',
    },
    dark: {
      primary: '#6366f1',
      primaryHover: '#818cf8',
      primarySubtle: 'rgba(99, 102, 241, 0.15)',
      primaryBorder: 'rgba(99, 102, 241, 0.3)',
      primaryText: '#312e81',
      chipTrack: 'rgba(49, 46, 129, 0.5)',
      ring: 'rgba(99, 102, 241, 0.3)',
      gradientFrom: '#312e81',
      gradientTo: '#3730a3',
    },
  },
  amber: {
    id: 'amber',
    name: 'Sunset Amber',
    label: 'Sunset Amber',
    swatchHex: '#f59e0b',
    light: {
      primary: '#d97706',
      primaryHover: '#b45309',
      primarySubtle: '#fffbeb',
      primaryBorder: '#fde68a',
      primaryText: '#ffffff',
      chipTrack: '#fef3c7',
      ring: 'rgba(217, 119, 6, 0.25)',
      gradientFrom: '#d97706',
      gradientTo: '#92400e',
    },
    dark: {
      primary: '#f59e0b',
      primaryHover: '#fbbf24',
      primarySubtle: 'rgba(245, 158, 11, 0.15)',
      primaryBorder: 'rgba(245, 158, 11, 0.3)',
      primaryText: '#78350f',
      chipTrack: 'rgba(120, 53, 15, 0.5)',
      ring: 'rgba(245, 158, 11, 0.3)',
      gradientFrom: '#78350f',
      gradientTo: '#92400e',
    },
  },
  rose: {
    id: 'rose',
    name: 'Berry Rose',
    label: 'Berry Rose',
    swatchHex: '#f43f5e',
    light: {
      primary: '#e11d48',
      primaryHover: '#be123c',
      primarySubtle: '#fff1f2',
      primaryBorder: '#fecdd3',
      primaryText: '#ffffff',
      chipTrack: '#ffe4e6',
      ring: 'rgba(225, 29, 72, 0.25)',
      gradientFrom: '#e11d48',
      gradientTo: '#9f1239',
    },
    dark: {
      primary: '#f43f5e',
      primaryHover: '#fb7185',
      primarySubtle: 'rgba(244, 63, 94, 0.15)',
      primaryBorder: 'rgba(244, 63, 94, 0.3)',
      primaryText: '#881337',
      chipTrack: 'rgba(136, 19, 55, 0.5)',
      ring: 'rgba(244, 63, 94, 0.3)',
      gradientFrom: '#881337',
      gradientTo: '#9f1239',
    },
  },
  slate: {
    id: 'slate',
    name: 'Nordic Slate',
    label: 'Nordic Slate',
    swatchHex: '#64748b',
    light: {
      primary: '#334155',
      primaryHover: '#1e293b',
      primarySubtle: '#f1f5f9',
      primaryBorder: '#cbd5e1',
      primaryText: '#ffffff',
      chipTrack: '#e2e8f0',
      ring: 'rgba(51, 65, 85, 0.25)',
      gradientFrom: '#334155',
      gradientTo: '#0f172a',
    },
    dark: {
      primary: '#94a3b8',
      primaryHover: '#cbd5e1',
      primarySubtle: 'rgba(148, 163, 184, 0.15)',
      primaryBorder: 'rgba(148, 163, 184, 0.3)',
      primaryText: '#0f172a',
      chipTrack: 'rgba(30, 41, 59, 0.5)',
      ring: 'rgba(148, 163, 184, 0.3)',
      gradientFrom: '#1e293b',
      gradientTo: '#0f172a',
    },
  },
}

export interface ThemeColors {
  bg: string
  surface: string
  surfaceSubtle: string
  surfaceElevated: string
  border: string
  borderSubtle: string
  text: string
  textMuted: string
  textSubtle: string
  primary: string
  primaryHover: string
  primaryText: string
  positive: string
  positiveBg: string
  negative: string
  negativeBg: string
  warning: string
  chipTrack: string
}

export const lightTheme: ThemeColors = {
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceSubtle: '#f1f5f9',
  surfaceElevated: '#ffffff',
  border: '#e2e8f0',
  borderSubtle: '#cbd5e1',
  text: '#0f172a',
  textMuted: '#475569',
  textSubtle: '#94a3b8',
  primary: '#4f46e5',
  primaryHover: '#4338ca',
  primaryText: '#ffffff',
  positive: '#10b981',
  positiveBg: '#ecfdf5',
  negative: '#f43f5e',
  negativeBg: '#fff1f2',
  warning: '#f59e0b',
  chipTrack: '#e0e7ff',
}

export const darkTheme: ThemeColors = {
  bg: '#090d16',
  surface: '#131b2e',
  surfaceSubtle: '#1e293b',
  surfaceElevated: '#1a243a',
  border: '#2a3754',
  borderSubtle: '#1e293b',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  textSubtle: '#64748b',
  primary: '#6366f1',
  primaryHover: '#4f46e5',
  primaryText: '#ffffff',
  positive: '#34d399',
  positiveBg: '#064e3b33',
  negative: '#fb7185',
  negativeBg: '#88133733',
  warning: '#fbbf24',
  chipTrack: '#312e81',
}

export const amoledTheme: ThemeColors = {
  ...darkTheme,
  bg: '#000000',
  surface: '#0a0a0a',
  surfaceSubtle: '#141414',
  surfaceElevated: '#171717',
  border: '#262626',
  borderSubtle: '#1a1a1a',
}
