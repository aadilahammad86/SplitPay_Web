import { describe, it, expect } from 'vitest'
import {
  normalizeToE164,
  isValidE164,
  formatE164Display,
  getE164DigitsOnly,
} from '../../src/domain/phone'

describe('Domain - Phone Number E.164 Normalization & Validation', () => {
  it('normalizes valid international formatted phone numbers', () => {
    expect(normalizeToE164('+1 (415) 555-2671')).toEqual({
      valid: true,
      e164: '+14155552671',
    })
    expect(normalizeToE164('+44 20 7946 0919')).toEqual({
      valid: true,
      e164: '+442079460919',
    })
    expect(normalizeToE164('+91 98765 43210')).toEqual({
      valid: true,
      e164: '+919876543210',
    })
    expect(normalizeToE164('+971-50-123-4567')).toEqual({
      valid: true,
      e164: '+971501234567',
    })
  })

  it('normalizes national numbers with default country prefix', () => {
    expect(normalizeToE164('9876543210', '+91')).toEqual({
      valid: true,
      e164: '+919876543210',
    })
    expect(normalizeToE164('4155552671', '+1')).toEqual({
      valid: true,
      e164: '+14155552671',
    })
    expect(normalizeToE164('(555) 123-4567', '+1')).toEqual({
      valid: true,
      e164: '+15551234567',
    })
  })

  it('handles numbers already in strict E.164 format', () => {
    expect(normalizeToE164('+14155552671')).toEqual({
      valid: true,
      e164: '+14155552671',
    })
    expect(normalizeToE164('+919876543210')).toEqual({
      valid: true,
      e164: '+919876543210',
    })
  })

  it('rejects invalid or malformed numbers', () => {
    expect(normalizeToE164('').valid).toBe(false)
    expect(normalizeToE164('   ').valid).toBe(false)
    expect(normalizeToE164('123').valid).toBe(false) // Too short
    expect(normalizeToE164('abc-def-ghij').valid).toBe(false)
    expect(normalizeToE164('+12345678901234567890').valid).toBe(false) // Exceeds 15 digits
  })

  it('validates strict E.164 format with isValidE164', () => {
    expect(isValidE164('+14155552671')).toBe(true)
    expect(isValidE164('+919876543210')).toBe(true)
    expect(isValidE164('919876543210')).toBe(false) // Missing leading +
    expect(isValidE164('+0123456789')).toBe(false)  // E.164 country code cannot start with 0
    expect(isValidE164('+1 (415) 555-2671')).toBe(false) // Unnormalized
  })

  it('extracts digits without leading plus for click-to-chat links (wa.me)', () => {
    expect(getE164DigitsOnly('+14155552671')).toBe('14155552671')
    expect(getE164DigitsOnly('+919876543210')).toBe('919876543210')
    expect(getE164DigitsOnly('9876543210')).toBe('9876543210')
  })

  it('formats display numbers with readable spacing', () => {
    expect(formatE164Display('+14155552671')).toBe('+1 (415) 555-2671')
    expect(formatE164Display('+919876543210')).toBe('+91 98765 43210')
  })
})
