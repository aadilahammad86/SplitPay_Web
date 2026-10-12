import { normalizeToE164, formatE164Display, getE164DigitsOnly } from '../../domain/phone'
import type { Person } from '../../domain/entities'
import { getSupabaseClient } from '../../supabase/supabaseClient'

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
 * 3. Matches against registered accounts where discoverableByPhone !== false.
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

  // Eligible directory map: registered phone + discoverable=true
  // Excludes the requester
  const eligibleDirectory = directory.filter(
    (p) =>
      p.id !== meId &&
      p.discoverableByPhone !== false &&
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

/**
 * Searches for an individual person by phone number across both local database and live Supabase database.
 */
export async function lookupPersonByPhone(params: {
  phoneInput: string
  localDirectory: Person[]
  meId: string
  existingFriendIds: string[]
  defaultCountryPrefix?: string
  inviteCode?: string
}): Promise<{
  valid: boolean
  e164?: string
  match?: MatchedFriend
  whatsappInviteUrl?: string
  error?: string
}> {
  const {
    phoneInput,
    localDirectory,
    meId,
    existingFriendIds,
    defaultCountryPrefix = '+91',
    inviteCode = 'splitpay',
  } = params

  const norm = normalizeToE164(phoneInput, defaultCountryPrefix)
  const digitsOnly = phoneInput.replace(/\D/g, '')
  const last9 = digitsOnly.length >= 7 ? digitsOnly.slice(-9) : ''

  if (!norm.valid && !last9) {
    return { valid: false, error: norm.error || 'Please enter a valid phone number.' }
  }

  const e164 = norm.valid ? norm.e164 : `+${digitsOnly}`

  // 1. Check local directory
  const localMatch = localDirectory.find((p) => {
    if (p.id === meId || p.discoverableByPhone === false || !p.phone) return false
    if (norm.valid && p.phone === e164) return true
    if (last9 && p.phone.replace(/\D/g, '').endsWith(last9)) return true
    return false
  })

  if (localMatch) {
    return {
      valid: true,
      e164: localMatch.phone || e164,
      match: {
        id: localMatch.id,
        name: localMatch.name,
        handle: localMatch.handle,
        phoneDisplay: formatE164Display(localMatch.phone || e164),
        alreadyFriend: existingFriendIds.includes(localMatch.id),
      },
    }
  }

  // 2. Check live Supabase database if configured
  try {
    const supabase = getSupabaseClient()
    if (supabase) {
      // First attempt exact E.164 match
      let remoteUser: { id: string; name: string; handle?: string; phone: string } | null = null

      if (norm.valid) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, handle, phone')
          .eq('phone', e164)
          .limit(1)

        if (!error && data && data.length > 0) {
          remoteUser = data[0]
        }
      }

      // If not found, attempt flexible suffix matching on subscriber digits
      if (!remoteUser && last9) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, handle, phone')
          .ilike('phone', `%${last9}%`)
          .limit(1)

        if (!error && data && data.length > 0) {
          remoteUser = data[0]
        }
      }

      if (remoteUser && remoteUser.id !== meId) {
        return {
          valid: true,
          e164: remoteUser.phone || e164,
          match: {
            id: remoteUser.id,
            name: remoteUser.name,
            handle: remoteUser.handle,
            phoneDisplay: formatE164Display(remoteUser.phone || e164),
            alreadyFriend: existingFriendIds.includes(remoteUser.id),
          },
        }
      }
    }
  } catch {
    // Ignore remote lookup network errors
  }

  // 3. Unmatched: prepare WhatsApp invite link
  if (!norm.valid) {
    return { valid: false, error: norm.error || 'Please enter a valid phone number with country code.' }
  }

  const digits = getE164DigitsOnly(e164)
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://splitpay.app'
  const inviteLink = `${appUrl}?invite=${encodeURIComponent(inviteCode)}`
  const inviteMessage = `Hey! I'm using SplitPay to track and split expenses with friends. Join me here: ${inviteLink}`
  const whatsappInviteUrl = `https://wa.me/${digits}?text=${encodeURIComponent(inviteMessage)}`

  return {
    valid: true,
    e164,
    whatsappInviteUrl,
  }
}
