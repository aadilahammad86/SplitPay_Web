/**
 * RFC 6238 Time-Based One-Time Password (TOTP) Algorithm
 * Compatible with Google Authenticator, Microsoft Authenticator, 1Password, etc.
 *
 * Invariants:
 * - HMAC-SHA1 with 160-bit (20-byte) key
 * - 30-second time step window
 * - 6-digit numeric token
 * - Base32 encoding without padding
 * - Drift tolerance window: +/- 1 step (current, previous, next 30s)
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/**
 * Encodes an ArrayBuffer or Uint8Array into a Base32 string (RFC 4648).
 */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]!
    bits += 8

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

/**
 * Decodes a Base32 string into a Uint8Array.
 */
export function base32Decode(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '')
  let bits = 0
  let value = 0
  const result: number[] = []

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]!
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) continue

    value = (value << 5) | idx
    bits += 5

    if (bits >= 8) {
      result.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return new Uint8Array(result)
}

/**
 * Generates a cryptographically random 20-byte Base32 secret for Google Authenticator.
 */
export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return base32Encode(bytes)
}

/**
 * Formats a Base32 secret with spaces every 4 characters for easy manual entry.
 * Example: "JBSW Y3DP EHPK 3PXP"
 */
export function formatSecretForDisplay(secret: string): string {
  const clean = secret.toUpperCase().replace(/\s+/g, '')
  return clean.match(/.{1,4}/g)?.join(' ') || clean
}

/**
 * Generates an otpauth:// URI for scanning with Google Authenticator or camera.
 */
export function generateOtpAuthUri(params: {
  username: string
  secret: string
  issuer?: string
}): string {
  const issuer = encodeURIComponent(params.issuer || 'SplitPay')
  const account = encodeURIComponent(params.username.trim().replace(/^@/, ''))
  const secret = params.secret.toUpperCase().replace(/[\s-]/g, '')
  return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
}

/**
 * Computes HMAC-SHA1 using Web Crypto API.
 */
async function hmacSha1(keyBytes: Uint8Array, messageBytes: Uint8Array): Promise<Uint8Array> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes as unknown as ArrayBuffer,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBytes as unknown as ArrayBuffer)
    return new Uint8Array(signature)
  }

  // Fallback pure-JS HMAC-SHA1 if subtle crypto is somehow not present
  return fallbackHmacSha1(keyBytes, messageBytes)
}

/**
 * Generates a 6-digit TOTP code for a given counter value.
 */
async function generateHotp(secretBytes: Uint8Array, counter: number): Promise<string> {
  const counterBuffer = new Uint8Array(8)
  let tmp = counter
  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = tmp & 0xff
    tmp = Math.floor(tmp / 256)
  }

  const hmac = await hmacSha1(secretBytes, counterBuffer)
  const offset = hmac[hmac.length - 1]! & 0x0f

  const codeInt =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff)

  const otp = codeInt % 1_000_000
  return otp.toString().padStart(6, '0')
}

/**
 * Generates the current 6-digit TOTP code for a Base32 secret.
 */
export async function generateTotpCode(secret: string, timestampMs = Date.now()): Promise<string> {
  const keyBytes = base32Decode(secret)
  const counter = Math.floor(timestampMs / 1000 / 30)
  return generateHotp(keyBytes, counter)
}

/**
 * Verifies a 6-digit TOTP code against a Base32 secret.
 * Checks current time step and +/- windowSteps (default 1 = +/- 30s) to tolerate clock drift.
 */
export async function verifyTotpCode(
  inputCode: string,
  secret: string,
  timestampMs = Date.now(),
  windowSteps = 1
): Promise<boolean> {
  const cleanCode = inputCode.trim().replace(/\s+/g, '')
  if (!/^\d{6}$/.test(cleanCode)) return false

  const keyBytes = base32Decode(secret)
  if (keyBytes.length === 0) return false

  const currentCounter = Math.floor(timestampMs / 1000 / 30)

  for (let step = -windowSteps; step <= windowSteps; step++) {
    const expected = await generateHotp(keyBytes, currentCounter + step)
    if (constantTimeCompare(cleanCode, expected)) {
      return true
    }
  }

  return false
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Minimal fallback HMAC-SHA1 implementation
 */
function fallbackHmacSha1(key: Uint8Array, message: Uint8Array): Uint8Array {
  // Simple SHA-1 padding and processing if subtle crypto is unavailable
  const blockSize = 64
  let k = key
  if (k.length > blockSize) {
    k = sha1(k)
  }
  const keyPad = new Uint8Array(blockSize)
  keyPad.set(k)

  const iPad = new Uint8Array(blockSize)
  const oPad = new Uint8Array(blockSize)
  for (let i = 0; i < blockSize; i++) {
    iPad[i] = keyPad[i]! ^ 0x36
    oPad[i] = keyPad[i]! ^ 0x5c
  }

  const innerMsg = new Uint8Array(blockSize + message.length)
  innerMsg.set(iPad)
  innerMsg.set(message, blockSize)
  const innerHash = sha1(innerMsg)

  const outerMsg = new Uint8Array(blockSize + innerHash.length)
  outerMsg.set(oPad)
  outerMsg.set(innerHash, blockSize)
  return sha1(outerMsg)
}

function sha1(data: Uint8Array): Uint8Array {
  function rotl(n: number, s: number) {
    return (n << s) | (n >>> (32 - s))
  }

  let h0 = 0x67452301
  let h1 = 0xefcdab89
  let h2 = 0x98badcfe
  let h3 = 0x10325476
  let h4 = 0xc3d2e1f0

  const len = data.length
  const withPad = (len + 8 + 64) & ~63
  const msg = new Uint8Array(withPad)
  msg.set(data)
  msg[len] = 0x80

  const bits = len * 8
  const view = new DataView(msg.buffer)
  view.setUint32(withPad - 4, bits & 0xffffffff)
  view.setUint32(withPad - 8, Math.floor(bits / 0x100000000))

  const words = new Uint32Array(80)
  for (let i = 0; i < withPad; i += 64) {
    for (let j = 0; j < 16; j++) {
      words[j] = view.getUint32(i + j * 4)
    }
    for (let j = 16; j < 80; j++) {
      words[j] = rotl(words[j - 3]! ^ words[j - 8]! ^ words[j - 14]! ^ words[j - 16]!, 1)
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4

    for (let j = 0; j < 80; j++) {
      let f = 0
      let k = 0
      if (j < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (j < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (j < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }

      const temp = (rotl(a, 5) + f + e + k + words[j]!) | 0
      e = d
      d = c
      c = rotl(b, 30)
      b = a
      a = temp
    }

    h0 = (h0 + a) | 0
    h1 = (h1 + b) | 0
    h2 = (h2 + c) | 0
    h3 = (h3 + d) | 0
    h4 = (h4 + e) | 0
  }

  const out = new Uint8Array(20)
  const outView = new DataView(out.buffer)
  outView.setUint32(0, h0)
  outView.setUint32(4, h1)
  outView.setUint32(8, h2)
  outView.setUint32(12, h3)
  outView.setUint32(16, h4)
  return out
}
