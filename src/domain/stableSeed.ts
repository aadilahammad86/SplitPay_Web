/**
 * FNV-1a 32-bit hash function.
 * Deterministic across all environments and platforms.
 * Never use String.hashCode or non-deterministic hashes for money allocations.
 */
export function stableSeed(s: string): number {
  let h = 0x811c9dc5 >>> 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h = (h ^ c) >>> 0
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}
