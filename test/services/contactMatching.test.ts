import { describe, it, expect } from 'vitest'
import {
  isContactPickerSupported,
  matchContactsAgainstDirectory,
  lookupPersonByPhone,
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

    it('matches registered accounts with phone numbers where discoverability is enabled', () => {
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

      // Alice and Charlie match because both have registered phones and discoverability enabled
      expect(result.matches).toHaveLength(2)
      expect(result.matches.map((m) => m.id)).toEqual(['user-discoverable', 'user-unverified-email'])

      // Bob (private) and Dave (unregistered phone) are treated as unmatched
      // No leak of their existence!
      const unmatchedNames = result.unmatched.map((u) => u.name)
      expect(unmatchedNames).toContain('Bob')
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

  describe('lookupPersonByPhone', () => {
    const mockDirectory: Person[] = [
      {
        id: 'me-1',
        name: 'Myself',
        phone: '+971501111111',
        discoverableByPhone: true,
      },
      {
        id: 'friend-uae',
        name: 'Ahmed UAE',
        handle: 'ahmed',
        phone: '+971502222222',
        discoverableByPhone: true,
      },
      {
        id: 'friend-private',
        name: 'Private Bob',
        phone: '+971503333333',
        discoverableByPhone: false,
      },
    ]

    it('matches friend by exact E.164 phone number', async () => {
      const result = await lookupPersonByPhone({
        phoneInput: '+971502222222',
        localDirectory: mockDirectory,
        meId: 'me-1',
        existingFriendIds: [],
      })

      expect(result.valid).toBe(true)
      expect(result.match).toBeDefined()
      expect(result.match?.id).toBe('friend-uae')
      expect(result.match?.name).toBe('Ahmed UAE')
    })

    it('matches friend by subscriber digits even when typed without country prefix', async () => {
      const result = await lookupPersonByPhone({
        phoneInput: '0502222222', // Local dial format with leading zero
        localDirectory: mockDirectory,
        meId: 'me-1',
        existingFriendIds: [],
        defaultCountryPrefix: '+971',
      })

      expect(result.valid).toBe(true)
      expect(result.match).toBeDefined()
      expect(result.match?.id).toBe('friend-uae')
    })

    it('does not match private profiles where discoverableByPhone is false', async () => {
      const result = await lookupPersonByPhone({
        phoneInput: '+971503333333',
        localDirectory: mockDirectory,
        meId: 'me-1',
        existingFriendIds: [],
      })

      expect(result.valid).toBe(true)
      expect(result.match).toBeUndefined()
      expect(result.whatsappInviteUrl).toBeDefined()
    })

    it('does not match the requester themselves', async () => {
      const result = await lookupPersonByPhone({
        phoneInput: '+971501111111',
        localDirectory: mockDirectory,
        meId: 'me-1',
        existingFriendIds: [],
      })

      expect(result.valid).toBe(true)
      expect(result.match).toBeUndefined()
    })
  })
})
