import { describe, it, expect } from 'vitest'
import {
  generateSecureOtp,
  hashOtp,
  timingSafeEqual,
  createOtpSession,
  verifyOtpCandidate,
  canResendOtp,
  OTP_CONFIG,
} from '../../src/domain/otp'

describe('Domain - Cryptographic OTP Lifecycle & Verification', () => {
  it('generates a 6-digit numeric cryptographic OTP', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateSecureOtp()
      expect(code).toMatch(/^\d{6}$/)
    }
  })

  it('hashes OTPs into deterministic SHA-256 hexadecimal strings', async () => {
    const code = '123456'
    const hash1 = await hashOtp(code)
    const hash2 = await hashOtp(code)
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64) // 256 bits = 64 hex characters
  })

  it('performs constant-time string comparison', () => {
    expect(timingSafeEqual('abcdef', 'abcdef')).toBe(true)
    expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false)
    expect(timingSafeEqual('abcdef', 'abcde')).toBe(false)
    expect(timingSafeEqual('', '')).toBe(true)
  })

  it('successfully verifies a valid OTP candidate', async () => {
    const rawOtp = '482910'
    const session = await createOtpSession({
      id: 'session-1',
      target: 'user@example.com',
      otp: rawOtp,
      purpose: 'email_verification',
    })

    const result = await verifyOtpCandidate(session, rawOtp)
    expect(result.success).toBe(true)
    expect(session.consumed).toBe(true)
  })

  it('enforces single-use consumption and rejects re-verification', async () => {
    const rawOtp = '482910'
    const session = await createOtpSession({
      id: 'session-2',
      target: '+14155552671',
      otp: rawOtp,
      purpose: 'phone_linking',
    })

    const first = await verifyOtpCandidate(session, rawOtp)
    expect(first.success).toBe(true)

    const second = await verifyOtpCandidate(session, rawOtp)
    expect(second.success).toBe(false)
    if (!second.success) {
      expect(second.error).toBe('ALREADY_CONSUMED')
    }
  })

  it('enforces maximum 5 attempts rate-limit before permanent invalidation', async () => {
    const rawOtp = '555555'
    const session = await createOtpSession({
      id: 'session-3',
      target: 'attacker@target.com',
      otp: rawOtp,
      purpose: 'email_verification',
    })

    // 4 failed attempts
    for (let i = 1; i <= 4; i++) {
      const res = await verifyOtpCandidate(session, '000000')
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe('INVALID_CODE')
        expect(res.remainingAttempts).toBe(5 - i)
      }
    }

    // 5th failed attempt: triggers MAX_ATTEMPTS_EXCEEDED
    const res5 = await verifyOtpCandidate(session, '000000')
    expect(res5.success).toBe(false)
    if (!res5.success) {
      expect(res5.error).toBe('MAX_ATTEMPTS_EXCEEDED')
      expect(res5.remainingAttempts).toBe(0)
    }

    // Even if right OTP is provided after 5 attempts, it is rejected
    const res6 = await verifyOtpCandidate(session, rawOtp)
    expect(res6.success).toBe(false)
    if (!res6.success) {
      expect(res6.error).toBe('MAX_ATTEMPTS_EXCEEDED')
    }
  })

  it('rejects expired OTP candidates after 10 minutes', async () => {
    const startTime = 1000000
    const rawOtp = '987654'
    const session = await createOtpSession({
      id: 'session-4',
      target: 'user@test.com',
      otp: rawOtp,
      purpose: 'email_verification',
      now: startTime,
    })

    // Right before expiry (9 min 59 sec)
    const validRes = await verifyOtpCandidate(
      { ...session },
      rawOtp,
      startTime + OTP_CONFIG.EXPIRY_MS - 1000
    )
    expect(validRes.success).toBe(true)

    // After expiry (10 min 1 sec)
    const expiredRes = await verifyOtpCandidate(
      session,
      rawOtp,
      startTime + OTP_CONFIG.EXPIRY_MS + 1000
    )
    expect(expiredRes.success).toBe(false)
    if (!expiredRes.success) {
      expect(expiredRes.error).toBe('EXPIRED')
    }
  })

  it('enforces 60-second resend cooldown timer', async () => {
    const t0 = 1000000
    const session = await createOtpSession({
      id: 'session-5',
      target: 'resend@test.com',
      otp: '112233',
      purpose: 'email_verification',
      now: t0,
    })

    // Immediately check cooldown
    const check1 = canResendOtp(session, t0 + 10_000) // 10s passed
    expect(check1.allowed).toBe(false)
    expect(check1.remainingCooldownSeconds).toBe(50)

    // 59 seconds passed
    const check2 = canResendOtp(session, t0 + 59_000)
    expect(check2.allowed).toBe(false)
    expect(check2.remainingCooldownSeconds).toBe(1)

    // 60 seconds passed
    const check3 = canResendOtp(session, t0 + 60_000)
    expect(check3.allowed).toBe(true)
    expect(check3.remainingCooldownSeconds).toBe(0)
  })
})
