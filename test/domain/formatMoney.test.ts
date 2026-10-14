import { describe, it, expect } from 'vitest'
import { Currencies } from '../../src/domain/money'
import { formatMoney, formatMoneyPlain, formatRelativeDate } from '../../src/domain/formatMoney'

describe('Domain - formatMoney & formatRelativeDate', () => {
  it('formats standard 2-decimal currencies (USD, INR, AED)', () => {
    expect(formatMoney(123450, Currencies.USD)).toContain('1,234.50')
    expect(formatMoney(5000, Currencies.INR)).toContain('50.00')
    expect(formatMoney(25000, Currencies.AED)).toContain('250.00')
  })

  it('formats zero-decimal currencies (JPY) without cents', () => {
    const formatted = formatMoney(1500, Currencies.JPY)
    expect(formatted).toContain('1,500')
    expect(formatted).not.toContain('.')
  })

  it('formats 3-decimal currencies (KWD) with three fractional digits', () => {
    const formatted = formatMoney(1250, Currencies.KWD)
    expect(formatted).toContain('1.250')
  })

  it('prefixes with + or proper unicode minus sign when showSign is requested', () => {
    expect(formatMoney(5000, Currencies.INR, { showSign: true })).toMatch(/^\+/)
    expect(formatMoney(-5000, Currencies.INR, { showSign: true })).toMatch(/^\u2212/)
    expect(formatMoney(0, Currencies.INR, { showSign: true })).not.toMatch(/^[+\u2212]/)
  })

  it('provides plain decimal strings via formatMoneyPlain', () => {
    expect(formatMoneyPlain(123450, Currencies.USD)).toBe('1,234.50')
    expect(formatMoneyPlain(1500, Currencies.JPY)).toBe('1,500')
    expect(formatMoneyPlain(1250, Currencies.KWD)).toBe('1.250')
  })

  it('formats relative dates accurately', () => {
    const now = Date.now() * 1000 // micros
    expect(formatRelativeDate(now)).toBe('Today')

    const oneDayAgo = now - 24 * 60 * 60 * 1000 * 1000
    expect(formatRelativeDate(oneDayAgo)).toBe('Yesterday')

    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000 * 1000
    expect(formatRelativeDate(threeDaysAgo)).toBe('3d ago')

    const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000 * 1000
    expect(formatRelativeDate(tenDaysAgo)).not.toBe('Today')
    expect(formatRelativeDate(tenDaysAgo)).not.toBe('Yesterday')
  })
})
