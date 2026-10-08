export type ThemeMode = 'system' | 'light' | 'dark' | 'amoled'

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
