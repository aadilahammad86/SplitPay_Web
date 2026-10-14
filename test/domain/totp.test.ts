import { describe, it, expect } from 'vitest'
import {
  base32Encode,
  base32Decode,
  generateTotpSecret,
  formatSecretForDisplay,
  generateOtpAuthUri,
  generateTotpCode,
  verifyTotpCode,
} from '../../src/domain/totp'

describe('Domain: RFC 6238 TOTP (Google Authenticator 2FA)', () => {
  it('encodes and decodes base32 symmetrically', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111, 33]) // "Hello!"
    const encoded = base32Encode(original)
    const decoded = base32Decode(encoded)
    expect(Array.from(decoded)).toEqual(Array.from(original))
  })

  it('generates a valid 20-byte base32 secret formatted in 4-character chunks', () => {
    const secret = generateTotpSecret()
    expect(secret.length).toBeGreaterThanOrEqual(32)
    const formatted = formatSecretForDisplay(secret)
    expect(formatted).toContain(' ')
    expect(formatted.replace(/\s+/g, '')).toBe(secret)
  })

  it('generates standard otpauth URI compatible with Google Authenticator', () => {
    const secret = 'JBSWY3DPEHPK3PXP'
    const uri = generateOtpAuthUri({
      username: 'aadilahammad1406',
      secret,
      issuer: 'SplitPay',
    })
    expect(uri).toContain('otpauth://totp/SplitPay:aadilahammad1406')
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP')
    expect(uri).toContain('issuer=SplitPay')
    expect(uri).toContain('algorithm=SHA1')
    expect(uri).toContain('digits=6')
    expect(uri).toContain('period=30')
  })

  it('generates a 6-digit numeric TOTP code', async () => {
    const secret = generateTotpSecret()
    const code = await generateTotpCode(secret)
    expect(code).toMatch(/^\d{6}$/)
  })

  it('verifies a valid TOTP code within current 30s window', async () => {
    const secret = generateTotpSecret()
    const now = Date.now()
    const code = await generateTotpCode(secret, now)
    const valid = await verifyTotpCode(code, secret, now)
    expect(valid).toBe(true)
  })

  it('tolerates +/- 30s clock drift (window = 1 step)', async () => {
    const secret = generateTotpSecret()
    const now = 1700000000000 // Fixed timestamp
    const prevCode = await generateTotpCode(secret, now - 30_000)
    const nextCode = await generateTotpCode(secret, now + 30_000)

    expect(await verifyTotpCode(prevCode, secret, now, 1)).toBe(true)
    expect(await verifyTotpCode(nextCode, secret, now, 1)).toBe(true)
  })

  it('rejects expired codes outside drift window', async () => {
    const secret = generateTotpSecret()
    const now = 1700000000000
    const ancientCode = await generateTotpCode(secret, now - 120_000) // 2 minutes ago
    expect(await verifyTotpCode(ancientCode, secret, now, 1)).toBe(false)
  })

  it('rejects incorrect codes or malformed input', async () => {
    const secret = generateTotpSecret()
    expect(await verifyTotpCode('000000', secret)).toBe(false)
    expect(await verifyTotpCode('123', secret)).toBe(false)
    expect(await verifyTotpCode('abcdef', secret)).toBe(false)
    expect(await verifyTotpCode('', secret)).toBe(false)
  })
})
