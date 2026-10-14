export type ThemeMode = 'system' | 'light' | 'dark' | 'amoled'

export type ColorPaletteId = 'jade' | 'electric' | 'copper'

export interface PaletteModeTokens {
  primary: string
  primaryHover: string
  primaryActive: string
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
  /**
   * Jade — refined emerald green, SplitPay's signature.
   * Calm, trustworthy, "money is safe" energy.
   */
  jade: {
    id: 'jade',
    name: 'Jade',
    label: 'Jade',
    swatchHex: '#10b981',
    light: {
      primary: '#059669',
      primaryHover: '#047857',
      primaryActive: '#10b981',
      primarySubtle: '#ecfdf5',
      primaryBorder: '#a7f3d0',
      primaryText: '#ffffff',
      chipTrack: '#d1fae5',
      ring: 'rgba(5, 150, 105, 0.25)',
      gradientFrom: '#059669',
      gradientTo: '#10b981',
    },
    dark: {
      primary: '#10b981',
      primaryHover: '#34d399',
      primaryActive: '#059669',
      primarySubtle: 'rgba(16, 185, 129, 0.12)',
      primaryBorder: 'rgba(16, 185, 129, 0.25)',
      primaryText: '#ffffff',
      chipTrack: 'rgba(6, 78, 59, 0.5)',
      ring: 'rgba(16, 185, 129, 0.30)',
      gradientFrom: '#064e3b',
      gradientTo: '#10b981',
    },
  },

  /**
   * Electric — vibrant blue-purple, fintech energy.
   * Revolut / Stripe inspired. Clean and modern.
   */
  electric: {
    id: 'electric',
    name: 'Electric',
    label: 'Electric',
    swatchHex: '#6366f1',
    light: {
      primary: '#4f46e5',
      primaryHover: '#4338ca',
      primaryActive: '#6366f1',
      primarySubtle: '#eef2ff',
      primaryBorder: '#c7d2fe',
      primaryText: '#ffffff',
      chipTrack: '#e0e7ff',
      ring: 'rgba(79, 70, 229, 0.25)',
      gradientFrom: '#4f46e5',
      gradientTo: '#6366f1',
    },
    dark: {
      primary: '#818cf8',
      primaryHover: '#a5b4fc',
      primaryActive: '#6366f1',
      primarySubtle: 'rgba(129, 140, 248, 0.12)',
      primaryBorder: 'rgba(129, 140, 248, 0.25)',
      primaryText: '#1e1b4b',
      chipTrack: 'rgba(49, 46, 129, 0.5)',
      ring: 'rgba(129, 140, 248, 0.30)',
      gradientFrom: '#312e81',
      gradientTo: '#818cf8',
    },
  },

  /**
   * Copper — warm amber-gold, premium feel.
   * Luxury expense tracker energy. Rich and grounded.
   */
  copper: {
    id: 'copper',
    name: 'Copper',
    label: 'Copper',
    swatchHex: '#f59e0b',
    light: {
      primary: '#d97706',
      primaryHover: '#b45309',
      primaryActive: '#f59e0b',
      primarySubtle: '#fffbeb',
      primaryBorder: '#fde68a',
      primaryText: '#ffffff',
      chipTrack: '#fef3c7',
      ring: 'rgba(217, 119, 6, 0.25)',
      gradientFrom: '#d97706',
      gradientTo: '#f59e0b',
    },
    dark: {
      primary: '#f59e0b',
      primaryHover: '#fbbf24',
      primaryActive: '#d97706',
      primarySubtle: 'rgba(245, 158, 11, 0.12)',
      primaryBorder: 'rgba(245, 158, 11, 0.25)',
      primaryText: '#451a03',
      chipTrack: 'rgba(120, 53, 15, 0.5)',
      ring: 'rgba(245, 158, 11, 0.30)',
      gradientFrom: '#78350f',
      gradientTo: '#f59e0b',
    },
  },
}

export interface ThemeColors {
  /* Surface layers */
  bg: string
  surface: string
  surfaceSubtle: string
  surfaceRaised: string
  surfaceElevated: string
  surfaceOverlay: string

  /* Borders */
  border: string
  borderSubtle: string

  /* Text hierarchy */
  text: string
  textSecondary: string
  textMuted: string
  textSubtle: string
  textDisabled: string

  /* Brand (overridden per palette) */
  primary: string
  primaryHover: string
  primaryActive: string
  primaryText: string
  primarySubtle: string
  primaryBorder: string
  primaryGlow: string

  /* Semantic money — fixed across all palettes */
  owed: string
  owedBg: string
  owedBorder: string
  owe: string
  oweBg: string
  oweBorder: string
  pending: string
  pendingBg: string
  pendingBorder: string
  settled: string
  settledBg: string

  /* Legacy semantic aliases (backward compat) */
  positive: string
  positiveBg: string
  negative: string
  negativeBg: string
  warning: string

  /* Status */
  danger: string
  dangerBg: string
  info: string
  infoBg: string

  /* Misc */
  chipTrack: string
}

export const lightTheme: ThemeColors = {
  bg: '#f6f8fb',
  surface: '#ffffff',
  surfaceSubtle: '#f1f5f9',
  surfaceRaised: '#ffffff',
  surfaceElevated: '#ffffff',
  surfaceOverlay: 'rgba(0, 0, 0, 0.4)',

  border: '#e2e8f0',
  borderSubtle: '#f1f5f9',

  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#64748b',
  textSubtle: '#94a3b8',
  textDisabled: '#94a3b8',

  primary: '#059669',
  primaryHover: '#047857',
  primaryActive: '#10b981',
  primaryText: '#ffffff',
  primarySubtle: '#ecfdf5',
  primaryBorder: '#a7f3d0',
  primaryGlow: 'rgba(5, 150, 105, 0.25)',

  owed: '#059669',
  owedBg: '#ecfdf5',
  owedBorder: '#a7f3d0',
  owe: '#e11d48',
  oweBg: '#fff1f2',
  oweBorder: '#fecdd3',
  pending: '#d97706',
  pendingBg: '#fffbeb',
  pendingBorder: '#fde68a',
  settled: '#94a3b8',
  settledBg: '#f1f5f9',

  positive: '#10b981',
  positiveBg: '#ecfdf5',
  negative: '#f43f5e',
  negativeBg: '#fff1f2',
  warning: '#f59e0b',

  danger: '#f43f5e',
  dangerBg: 'rgba(244, 63, 94, 0.08)',
  info: '#3b82f6',
  infoBg: 'rgba(59, 130, 246, 0.08)',

  chipTrack: '#e0e7ff',
}

export const darkTheme: ThemeColors = {
  bg: '#0a0e1a',
  surface: '#111827',
  surfaceSubtle: '#1e293b',
  surfaceRaised: '#1a2236',
  surfaceElevated: '#222d45',
  surfaceOverlay: 'rgba(0, 0, 0, 0.6)',

  border: '#1f2b42',
  borderSubtle: '#172035',

  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#94a3b8',
  textSubtle: '#64748b',
  textDisabled: '#475569',

  primary: '#10b981',
  primaryHover: '#34d399',
  primaryActive: '#059669',
  primaryText: '#ffffff',
  primarySubtle: 'rgba(16, 185, 129, 0.12)',
  primaryBorder: 'rgba(16, 185, 129, 0.25)',
  primaryGlow: 'rgba(16, 185, 129, 0.20)',

  owed: '#34d399',
  owedBg: 'rgba(52, 211, 153, 0.12)',
  owedBorder: 'rgba(52, 211, 153, 0.25)',
  owe: '#fb7185',
  oweBg: 'rgba(251, 113, 133, 0.12)',
  oweBorder: 'rgba(251, 113, 133, 0.25)',
  pending: '#fbbf24',
  pendingBg: 'rgba(251, 191, 36, 0.12)',
  pendingBorder: 'rgba(251, 191, 36, 0.25)',
  settled: '#64748b',
  settledBg: 'rgba(100, 116, 139, 0.10)',

  positive: '#34d399',
  positiveBg: 'rgba(6, 78, 59, 0.2)',
  negative: '#fb7185',
  negativeBg: 'rgba(136, 19, 55, 0.2)',
  warning: '#fbbf24',

  danger: '#f43f5e',
  dangerBg: 'rgba(244, 63, 94, 0.12)',
  info: '#3b82f6',
  infoBg: 'rgba(59, 130, 246, 0.12)',

  chipTrack: '#312e81',
}

export const amoledTheme: ThemeColors = {
  ...darkTheme,
  bg: '#000000',
  surface: '#0a0a0a',
  surfaceSubtle: '#141414',
  surfaceRaised: '#171717',
  surfaceElevated: '#1c1c1c',
  border: '#262626',
  borderSubtle: '#1a1a1a',
}
