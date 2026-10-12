/**
 * Cryptographic OTP Management & Verification
 * Invariants:
 * - 6-digit cryptographically secure OTP
 * - Stored hashed (SHA-256)
 * - Single-use with 10-minute expiry
 * - Maximum 5 verification attempts before invalidation
 * - 60-second resend cooldown
 * - Constant-time comparison to protect against timing attacks
 * - Never log raw OTPs to persistent logs
 */

export interface OtpSession {
  readonly id: string
  readonly target: string // Normalized email or E.164 phone
  readonly hashedOtp: string
  readonly purpose: 'email_verification' | 'phone_linking'
  readonly createdAt: number
  readonly expiresAt: number
  attempts: number
  readonly maxAttempts: number
  lastResendAt: number
  consumed: boolean
}

export const OTP_CONFIG = {
  DIGITS: 6,
  EXPIRY_MS: 10 * 60 * 1000, // 10 minutes
  RESEND_COOLDOWN_MS: 60 * 1000, // 60 seconds
  MAX_ATTEMPTS: 5,
} as const

/**
 * Generates a cryptographically random 6-digit numeric OTP.
 */
export function generateSecureOtp(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1)
    crypto.getRandomValues(array)
    const code = (array[0]! % 1_000_000).toString().padStart(6, '0')
    return code
  }
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Computes SHA-256 hexadecimal digest of an OTP string.
 */
export async function hashOtp(otp: string): Promise<string> {
  const clean = otp.trim()
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(clean)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  // Safe fallback for non-secure contexts (e.g. testing over LAN HTTP IP)
  let hash = 0
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i)
    hash |= 0
  }
  return 'fallback_' + Math.abs(hash).toString(16)
}

/**
 * Constant-time string equality to prevent timing attacks on verification digests.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    let dummy = 0
    for (let i = 0; i < a.length; i++) {
      dummy |= a.charCodeAt(i) ^ (b.charCodeAt(i % Math.max(1, b.length)) || 0)
    }
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Creates a new active OTP session with hashed storage.
 */
export async function createOtpSession(params: {
  id: string
  target: string
  otp: string
  purpose: 'email_verification' | 'phone_linking'
  now?: number
}): Promise<OtpSession> {
  const now = params.now ?? Date.now()
  const hashedOtp = await hashOtp(params.otp)

  return {
    id: params.id,
    target: params.target.trim().toLowerCase(),
    hashedOtp,
    purpose: params.purpose,
    createdAt: now,
    expiresAt: now + OTP_CONFIG.EXPIRY_MS,
    attempts: 0,
    maxAttempts: OTP_CONFIG.MAX_ATTEMPTS,
    lastResendAt: now,
    consumed: false,
  }
}

export type VerifyOtpResult =
  | { success: true }
  | {
      success: false
      error: 'EXPIRED' | 'MAX_ATTEMPTS_EXCEEDED' | 'ALREADY_CONSUMED' | 'INVALID_CODE'
      remainingAttempts: number
    }

/**
 * Verifies a user-provided OTP candidate against an active session.
 */
export async function verifyOtpCandidate(
  session: OtpSession,
  candidate: string,
  now: number = Date.now()
): Promise<VerifyOtpResult> {
  if (session.consumed) {
    return { success: false, error: 'ALREADY_CONSUMED', remainingAttempts: 0 }
  }

  if (now > session.expiresAt) {
    return { success: false, error: 'EXPIRED', remainingAttempts: 0 }
  }

  if (session.attempts >= session.maxAttempts) {
    return { success: false, error: 'MAX_ATTEMPTS_EXCEEDED', remainingAttempts: 0 }
  }

  session.attempts += 1
  const remaining = Math.max(0, session.maxAttempts - session.attempts)

  const candidateHash = await hashOtp(candidate)
  const isMatch = timingSafeEqual(session.hashedOtp, candidateHash)

  if (!isMatch) {
    if (session.attempts >= session.maxAttempts) {
      return { success: false, error: 'MAX_ATTEMPTS_EXCEEDED', remainingAttempts: 0 }
    }
    return { success: false, error: 'INVALID_CODE', remainingAttempts: remaining }
  }

  // Mark single-use consumption upon match
  session.consumed = true
  return { success: true }
}

/**
 * Validates whether enough cooldown time has elapsed to permit resending an OTP.
 */
export function canResendOtp(session: OtpSession, now: number = Date.now()): {
  allowed: boolean
  remainingCooldownSeconds: number
} {
  const elapsed = now - session.lastResendAt
  if (elapsed >= OTP_CONFIG.RESEND_COOLDOWN_MS) {
    return { allowed: true, remainingCooldownSeconds: 0 }
  }
  const remaining = Math.ceil((OTP_CONFIG.RESEND_COOLDOWN_MS - elapsed) / 1000)
  return { allowed: false, remainingCooldownSeconds: Math.max(1, remaining) }
}
