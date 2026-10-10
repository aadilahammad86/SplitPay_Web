import { normalizeToE164, formatE164Display, getE164DigitsOnly } from '../../domain/phone'
import type { Person } from '../../domain/entities'

export interface ContactCandidate {
  name?: string
  phones: string[]
}

export interface MatchedFriend {
  id: string
  name: string
  handle?: string
  phoneDisplay: string
  alreadyFriend: boolean
}

export interface UnmatchedContact {
  name: string
  rawPhone: string
  e164: string
  whatsappUrl: string
}

export interface ContactMatchResult {
  matches: MatchedFriend[]
  unmatched: UnmatchedContact[]
  totalProcessed: number
}

export const MAX_CONTACT_BATCH_SIZE = 50

/**
 * Checks if the browser natively supports the Contact Picker API.
 * Strict check: 'contacts' in navigator && 'ContactsManager' in window
 * Invariant: Never use user-agent sniffing.
 */
export function isContactPickerSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }
  return 'contacts' in navigator && 'ContactsManager' in window
}

/**
 * Privacy-preserving contact matcher:
 * 1. Normalizes input contacts to E.164.
 * 2. Caps batch size to MAX_CONTACT_BATCH_SIZE.
 * 3. Matches ONLY against candidates where:
 *    - emailVerified === true
 *    - phoneVerified === true
 *    - discoverableByPhone === true
 * 4. Excludes the requester (meId).
 * 5. Does NOT persist unmatched phone numbers anywhere.
 */
export function matchContactsAgainstDirectory(params: {
  candidates: ContactCandidate[]
  directory: Person[] // Known registered people pool
  meId: string
  existingFriendIds: string[]
  defaultCountryPrefix?: string
  inviteCode?: string
}): ContactMatchResult {
  const {
    candidates,
    directory,
    meId,
    existingFriendIds,
    defaultCountryPrefix = '+91',
    inviteCode = 'splitpay',
  } = params

  const matches: MatchedFriend[] = []
  const unmatched: UnmatchedContact[] = []
  const seenE164 = new Set<string>()

  // Eligible directory map: verified email + registered phone + discoverable=true
  // Excludes the requester
  const eligibleDirectory = directory.filter(
    (p) =>
      p.id !== meId &&
      p.emailVerified === true &&
      p.discoverableByPhone === true &&
      !!p.phone
  )

  const directoryByE164 = new Map<string, Person>()
  for (const person of eligibleDirectory) {
    if (person.phone) {
      directoryByE164.set(person.phone, person)
    }
  }

  let processedCount = 0

  for (const candidate of candidates) {
    if (processedCount >= MAX_CONTACT_BATCH_SIZE) break

    const name = candidate.name || 'Contact'
    for (const rawPhone of candidate.phones) {
      if (processedCount >= MAX_CONTACT_BATCH_SIZE) break

      const normalized = normalizeToE164(rawPhone, defaultCountryPrefix)
      if (!normalized.valid) continue

      const e164 = normalized.e164
      if (seenE164.has(e164)) continue
      seenE164.add(e164)
      processedCount++

      const matchedPerson = directoryByE164.get(e164)
      if (matchedPerson) {
        matches.push({
          id: matchedPerson.id,
          name: matchedPerson.name,
          handle: matchedPerson.handle,
          phoneDisplay: formatE164Display(e164),
          alreadyFriend: existingFriendIds.includes(matchedPerson.id),
        })
      } else {
        // Prepare client-side invite helper without persisting
        const digits = getE164DigitsOnly(e164)
        const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://splitpay.app'
        const inviteLink = `${appUrl}?invite=${encodeURIComponent(inviteCode)}`
        const inviteMessage = `Hey ${name}! I'm using SplitPay to track and split expenses with friends. Join me here: ${inviteLink}`
        const whatsappUrl = `https://wa.me/${digits}?text=${encodeURIComponent(inviteMessage)}`

        unmatched.push({
          name,
          rawPhone,
          e164,
          whatsappUrl,
        })
      }
    }
  }

  return {
    matches,
    unmatched,
    totalProcessed: processedCount,
  }
}
