/**
 * ULID (Universally Unique Lexicographically Sortable Identifier) generator.
 * Crockford's Base32 encoding: 48-bit timestamp (ms) + 80-bit randomness.
 * Guarantees monotonic lexicographical sort order across calls.
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const ENCODING_LEN = ENCODING.length

let lastTime = 0
const lastRandom: number[] = new Array(16).fill(0)

function initRandom(): void {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    for (let i = 0; i < 16; i++) {
      lastRandom[i] = bytes[i]! % ENCODING_LEN
    }
  } else {
    for (let i = 0; i < 16; i++) {
      lastRandom[i] = Math.floor(Math.random() * ENCODING_LEN)
    }
  }
}

function incrementRandom(): boolean {
  for (let i = 15; i >= 0; i--) {
    if (lastRandom[i]! < ENCODING_LEN - 1) {
      lastRandom[i]!++
      return true
    }
    lastRandom[i] = 0
  }
  return false
}

export function generateUlid(nowMs: number = Date.now()): string {
  let time = Math.floor(nowMs)
  if (time <= lastTime) {
    time = lastTime
    const ok = incrementRandom()
    if (!ok) {
      time = ++lastTime
      initRandom()
    }
  } else {
    lastTime = time
    initRandom()
  }

  // 10 chars of timestamp (48 bits)
  let timeStr = ''
  let t = time
  for (let i = 9; i >= 0; i--) {
    const mod = t % ENCODING_LEN
    timeStr = ENCODING.charAt(mod) + timeStr
    t = Math.floor(t / ENCODING_LEN)
  }

  // 16 chars of randomness (80 bits)
  let randStr = ''
  for (let i = 0; i < 16; i++) {
    randStr += ENCODING.charAt(lastRandom[i]!)
  }

  return timeStr + randStr
}
