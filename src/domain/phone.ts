/**
 * Phone Number Utilities & E.164 Normalization
 * Standard E.164: +[country code][subscriber number], max 15 digits, min 7 digits.
 */

export interface PhoneNormalizationResult {
  valid: boolean
  e164: string
  error?: string
}

/**
 * Normalizes an arbitrary phone string to E.164 format.
 * Defaults to defaultCountryPrefix (e.g. '+91') if no international prefix is present.
 */
export function normalizeToE164(
  raw: string,
  defaultCountryPrefix: string = '+91'
): PhoneNormalizationResult {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, e164: '', error: 'Phone number cannot be empty' }
  }

  // Remove common phone formatting characters: spaces, dashes, parentheses, dots
  let cleaned = raw.trim().replace(/[\s\-().]/g, '')

  // Handle leading 00 (international call prefix)
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2)
  }

  // If starts with single 0 (local dialing prefix), strip it if adding default country
  if (cleaned.startsWith('0') && !cleaned.startsWith('00')) {
    cleaned = cleaned.slice(1)
  }

  // If no leading +, attach the default country prefix
  if (!cleaned.startsWith('+')) {
    const cleanPrefix = defaultCountryPrefix.startsWith('+')
      ? defaultCountryPrefix
      : '+' + defaultCountryPrefix
    cleaned = cleanPrefix + cleaned
  }

  // Validate E.164 structure: + followed by 7 to 15 digits
  const e164Regex = /^\+[1-9]\d{6,14}$/

  if (!e164Regex.test(cleaned)) {
    return {
      valid: false,
      e164: '',
      error: 'Invalid phone number format. Must be a valid E.164 international number.',
    }
  }

  return {
    valid: true,
    e164: cleaned,
  }
}

/**
 * Checks whether a given string is already a valid E.164 phone number.
 */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone.trim())
}

/**
 * Formats an E.164 number for user-friendly display.
 * E.g., +919876543210 -> +91 98765 43210
 */
export function formatE164Display(e164: string): string {
  if (!isValidE164(e164)) return e164

  if (e164.startsWith('+91') && e164.length === 13) {
    return `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`
  }
  if (e164.startsWith('+1') && e164.length === 12) {
    return `+1 (${e164.slice(2, 5)}) ${e164.slice(5, 8)}-${e164.slice(8)}`
  }
  if (e164.startsWith('+44') && e164.length === 13) {
    return `+44 ${e164.slice(3, 7)} ${e164.slice(7)}`
  }
  if (e164.startsWith('+971') && e164.length === 13) {
    return `+971 ${e164.slice(4, 6)} ${e164.slice(6, 9)} ${e164.slice(9)}`
  }

  return e164
}

/**
 * Returns digits-only representation without '+' for services like WhatsApp (wa.me)
 */
export function getE164DigitsOnly(e164: string): string {
  return e164.replace(/\D/g, '')
}
