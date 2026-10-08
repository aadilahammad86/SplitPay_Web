/**
 * Financial Invariant INV-1 / AP-17:
 * All currency amounts are stored in INTEGER MINOR UNITS (e.g. cents, paise).
 * No floating point money arithmetic anywhere in the codebase.
 */

export interface CurrencyCode {
  readonly code: string
  readonly symbol: string
  readonly digits: number
  readonly scale: number
}

function createCurrency(code: string, symbol: string, digits: number): CurrencyCode {
  let scale = 1
  for (let i = 0; i < digits; i++) {
    scale *= 10
  }
  return Object.freeze({ code, symbol, digits, scale })
}

export const Currencies = {
  INR: createCurrency('INR', '₹', 2),
  USD: createCurrency('USD', '$', 2),
  EUR: createCurrency('EUR', '€', 2),
  GBP: createCurrency('GBP', '£', 2),
  AED: createCurrency('AED', 'AED', 2),
  JPY: createCurrency('JPY', '¥', 0),
  KWD: createCurrency('KWD', 'KD', 3),
} as const

export const SupportedCurrencies: readonly CurrencyCode[] = Object.values(Currencies)

export function currencyFromCode(code: string): CurrencyCode {
  const normalized = (code || '').toUpperCase().trim()
  const found = SupportedCurrencies.find((c) => c.code === normalized)
  return found ?? Currencies.INR
}

export class Money {
  readonly minor: number
  readonly currency: CurrencyCode

  constructor(minor: number, currency: CurrencyCode) {
    if (!Number.isInteger(minor)) {
      throw new TypeError(`Money minor units must be an integer, got: ${minor}`)
    }
    this.minor = minor
    this.currency = currency
  }

  get isZero(): boolean {
    return this.minor === 0
  }

  get isPositive(): boolean {
    return this.minor > 0
  }

  get isNegative(): boolean {
    return this.minor < 0
  }

  abs(): Money {
    return new Money(Math.abs(this.minor), this.currency)
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency.code !== other.currency.code) {
      throw new Error(`Currency mismatch: ${this.currency.code} vs ${other.currency.code}`)
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(this.minor + other.minor, this.currency)
  }

  sub(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(this.minor - other.minor, this.currency)
  }

  /**
   * Locale-aware formatting with currency symbol.
   */
  formatted(locale: string = 'en-US'): string {
    const value = this.minor / this.currency.scale
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: this.currency.code,
        minimumFractionDigits: this.currency.digits,
        maximumFractionDigits: this.currency.digits,
      }).format(value)
    } catch {
      // Fallback if locale or currency code is unsupported by browser Intl
      return `${this.currency.symbol}${value.toFixed(this.currency.digits)}`
    }
  }

  /**
   * Decimal string without currency symbol for tables and CSV export.
   */
  plain(): string {
    const value = this.minor / this.currency.scale
    return value.toFixed(this.currency.digits)
  }

  /**
   * Accessible representation for screen readers.
   */
  spoken(): string {
    const value = Math.abs(this.minor) / this.currency.scale
    return `${value.toFixed(this.currency.digits)} ${this.currency.code}`
  }

  toString(): string {
    return `${this.currency.code} ${this.minor}(minor)`
  }
}
