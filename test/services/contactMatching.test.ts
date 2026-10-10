import { describe, it, expect } from 'vitest'
import {
  isContactPickerSupported,
  matchContactsAgainstDirectory,
  MAX_CONTACT_BATCH_SIZE,
  type ContactCandidate,
} from '../../src/services/contacts/contactMatchingService'
import type { Person } from '../../src/domain/entities'

describe('Services - Contact Matching & Privacy Rules', () => {
  describe('Feature Detection (No UA sniffing)', () => {
    it('detects lack of Contact Picker API when navigator.contacts is absent', () => {
      // In Node test environment, contacts is absent
      expect(isContactPickerSupported()).toBe(false)
    })

    it('returns true when contacts in navigator and ContactsManager in window', () => {
      try {
        Object.defineProperty(globalThis.navigator, 'contacts', {
          value: {},
          configurable: true,
          writable: true,
        })
        // @ts-expect-error Mocking window on globalThis
        globalThis.window = {
          ContactsManager: function () {},
        }

        expect(isContactPickerSupported()).toBe(true)
      } finally {
        // @ts-expect-error Cleanup
        delete globalThis.navigator.contacts
        // @ts-expect-error Cleanup
        delete globalThis.window
      }
    })
  })

  describe('Privacy-Preserving Contact Matching Rules', () => {
    const mockDirectory: Person[] = [
      {
        id: 'me-1',
        name: 'Myself',
        phone: '+14155550001',
        email: 'me@splitpay.app',
        emailVerified: true,
        phoneVerified: true,
        discoverableByPhone: true,
      },
      {
        id: 'user-discoverable',
        name: 'Alice Discoverable',
        handle: 'alice',
        phone: '+14155550002',
        email: 'alice@test.com',
        emailVerified: true,
        phoneVerified: true,
        discoverableByPhone: true,
      },
      {
        id: 'user-not-discoverable',
        name: 'Bob Private',
        handle: 'bob',
        phone: '+14155550003',
        email: 'bob@test.com',
        emailVerified: true,
        phoneVerified: true,
        discoverableByPhone: false, // Opted out of discoverability
      },
      {
        id: 'user-unverified-email',
        name: 'Charlie NoEmailVerify',
        phone: '+14155550004',
        email: 'charlie@test.com',
        emailVerified: false, // Email NOT verified
        phoneVerified: true,
        discoverableByPhone: true,
      },
      {
        id: 'user-no-phone',
        name: 'Dave NoPhone',
        email: 'dave@test.com',
        emailVerified: true,
        discoverableByPhone: true,
      },
    ]

    it('matches ONLY accounts with verified email, registered phone, AND discoverability enabled', () => {
      const candidates: ContactCandidate[] = [
        { name: 'Alice', phones: ['+14155550002'] },
        { name: 'Bob', phones: ['+14155550003'] },
        { name: 'Charlie', phones: ['+14155550004'] },
        { name: 'Dave', phones: ['+14155550005'] },
      ]

      const result = matchContactsAgainstDirectory({
        candidates,
        directory: mockDirectory,
        meId: 'me-1',
        existingFriendIds: [],
        defaultCountryPrefix: '+1',
      })

      // Only Alice should match
      expect(result.matches).toHaveLength(1)
      expect(result.matches[0].id).toBe('user-discoverable')
      expect(result.matches[0].name).toBe('Alice Discoverable')

      // Bob (private), Charlie (unverified email), Dave (unverified phone) are treated as unmatched
      // No leak of their existence!
      const unmatchedNames = result.unmatched.map((u) => u.name)
      expect(unmatchedNames).toContain('Bob')
      expect(unmatchedNames).toContain('Charlie')
      expect(unmatchedNames).toContain('Dave')
    })

    it('strictly excludes the requester even if their own number is in the contacts list', () => {
      const candidates: ContactCandidate[] = [
        { name: 'My Own Number', phones: ['+14155550001'] },
      ]

      const result = matchContactsAgainstDirectory({
        candidates,
        directory: mockDirectory,
        meId: 'me-1',
        existingFriendIds: [],
        defaultCountryPrefix: '+1',
      })

      expect(result.matches).toHaveLength(0)
      expect(result.unmatched).toHaveLength(1)
    })

    it('correctly tags already existing friends', () => {
      const candidates: ContactCandidate[] = [
        { name: 'Alice', phones: ['+14155550002'] },
      ]

      const result = matchContactsAgainstDirectory({
        candidates,
        directory: mockDirectory,
        meId: 'me-1',
        existingFriendIds: ['user-discoverable'],
        defaultCountryPrefix: '+1',
      })

      expect(result.matches).toHaveLength(1)
      expect(result.matches[0].alreadyFriend).toBe(true)
    })

    it('generates client-side WhatsApp click-to-chat invite URLs for unmatched contacts', () => {
      const candidates: ContactCandidate[] = [
        { name: 'Frank', phones: ['+14155559999'] },
      ]

      const result = matchContactsAgainstDirectory({
        candidates,
        directory: mockDirectory,
        meId: 'me-1',
        existingFriendIds: [],
        inviteCode: 'INVITE123',
      })

      expect(result.unmatched).toHaveLength(1)
      const frank = result.unmatched[0]
      expect(frank.whatsappUrl).toContain('https://wa.me/14155559999?text=')
      expect(frank.whatsappUrl).toContain(encodeURIComponent('INVITE123'))
    })

    it('enforces maximum batch limit of 50 candidates', () => {
      const manyCandidates: ContactCandidate[] = Array.from({ length: 70 }, (_, i) => ({
        name: `Person ${i}`,
        phones: [`+1415555${(1000 + i).toString().padStart(4, '0')}`],
      }))

      const result = matchContactsAgainstDirectory({
        candidates: manyCandidates,
        directory: mockDirectory,
        meId: 'me-1',
        existingFriendIds: [],
      })

      expect(result.totalProcessed).toBe(MAX_CONTACT_BATCH_SIZE)
      expect(result.matches.length + result.unmatched.length).toBe(MAX_CONTACT_BATCH_SIZE)
    })
  })
})
