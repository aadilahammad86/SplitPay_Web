/**
 * Locale-aware money formatting for display.
 *
 * Financial Invariant INV-1: Input is always integer minor units.
 * This function never rounds — it divides by scale and uses the
 * currency's declared digits for fixed-point display.
 */
import type { CurrencyCode } from './money'

export function formatMoney(
  minor: number,
  currency: CurrencyCode,
  options?: {
    /** Prefix with + or − sign */
    showSign?: boolean
    /** Use compact notation for large numbers (e.g., ₹1.2L) */
    compact?: boolean
    /** Override locale (defaults to user's browser locale) */
    locale?: string
  },
): string {
  const { showSign = false, compact = false, locale } = options ?? {}
  const value = Math.abs(minor) / currency.scale

  let formatted: string
  try {
    formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: currency.digits,
      maximumFractionDigits: currency.digits,
      notation: compact ? 'compact' : 'standard',
    }).format(value)
  } catch {
    // Fallback for unsupported currency codes
    formatted = `${currency.symbol}${value.toFixed(currency.digits)}`
  }

  if (!showSign) return formatted
  if (minor > 0) return `+${formatted}`
  if (minor < 0) return `\u2212${formatted}` // proper minus sign, not hyphen
  return formatted
}

/**
 * Returns just the numeric portion without currency symbol.
 * Uses Intl.NumberFormat for proper thousand-grouping.
 */
export function formatMoneyPlain(
  minor: number,
  currency: CurrencyCode,
  locale?: string,
): string {
  const value = Math.abs(minor) / currency.scale
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: currency.digits,
      maximumFractionDigits: currency.digits,
    }).format(value)
  } catch {
    return value.toFixed(currency.digits)
  }
}

/**
 * Format timestamp in microseconds to a clean human-readable relative date.
 * (e.g. "Today", "Yesterday", "3d ago", or "Oct 14")
 */
export function formatRelativeDate(createdAtMicros: number): string {
  const date = new Date(Math.floor(createdAtMicros / 1000))
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

