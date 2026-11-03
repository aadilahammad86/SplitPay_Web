import { describe, it, expect, vi } from 'vitest'
import {
  isExpenseParticipant,
  isSettlementParticipant,
  isExpenseOpParticipant,
  isSettlementOpParticipant,
  isFriendOfUser,
} from '../../src/domain/privacy'
import { Currencies } from '../../src/domain/money'
import type { Expense, Group, Person, Settlement } from '../../src/domain/entities'
import { buildGroupStatement } from '../../src/domain/statement'
import { groupNets } from '../../src/domain/balance'
import { simplifyDebts } from '../../src/domain/splitEngine'
import { NotificationService } from '../../src/services/notifications/notificationService'
import type { SyncOp } from '../../src/domain/syncOp'

describe('Invariant INV-TRANSACTION-PRIVACY: Group and 1-to-1 Transaction Privacy & Transparency', () => {
  const alice: Person = { id: 'p_alice', name: 'Alice' }
  const bob: Person = { id: 'p_bob', name: 'Bob' }
  const charlie: Person = { id: 'p_charlie', name: 'Charlie' }
  const people: Person[] = [alice, bob, charlie]

  const tripGroup: Group = {
    id: 'grp_trip',
    name: 'Goa Trip',
    kind: 'trip',
    memberIds: [alice.id, bob.id, charlie.id],
    currency: Currencies.INR,
  }

  // Alice pays 6000 (INR 60.00) split equally between Alice and Charlie only (Bob is excluded)
  const groupExpenseAC: Expense = {
    id: 'exp_ac_1',
    description: 'Scuba Diving (Alice & Charlie)',
    totalMinor: 6000,
    currency: Currencies.INR,
    paidBy: alice.id,
    groupId: tripGroup.id,
    mode: 'equal',
    createdAtMicros: 1000000000,
    categoryEmoji: '🤿',
    isTombstone: false,
    shares: [
      {
        id: 's1',
        expenseId: 'exp_ac_1',
        owedBy: charlie.id,
        owedTo: alice.id,
        amountMinor: 3000,
        groupId: tripGroup.id,
      },
      {
        id: 's2',
        expenseId: 'exp_ac_1',
        owedBy: alice.id,
        owedTo: alice.id,
        amountMinor: 3000,
        groupId: tripGroup.id,
      },
    ],
  }

  // Settlement: Charlie pays Alice 3000 in the group
  const groupSettlementCA: Settlement = {
    id: 'set_ca_1',
    from: charlie.id,
    to: alice.id,
    amountMinor: 3000,
    currency: Currencies.INR,
    groupId: tripGroup.id,
    note: 'Settle scuba diving',
    createdAtMicros: 2000000000,
  }

  describe('Core Participant Predicates', () => {
    it('identifies participants in a group expense correctly', () => {
      expect(isExpenseParticipant(groupExpenseAC, alice.id)).toBe(true)
      expect(isExpenseParticipant(groupExpenseAC, charlie.id)).toBe(true)
      // Bob is in the group but NOT in the transaction
      expect(isExpenseParticipant(groupExpenseAC, bob.id)).toBe(false)
    })

    it('works with isMe function predicate', () => {
      const isBob = (id: string) => id === bob.id
      const isCharlie = (id: string) => id === charlie.id

      expect(isExpenseParticipant(groupExpenseAC, '', isBob)).toBe(false)
      expect(isExpenseParticipant(groupExpenseAC, '', isCharlie)).toBe(true)
    })

    it('identifies participants in a settlement correctly', () => {
      expect(isSettlementParticipant(groupSettlementCA, alice.id)).toBe(true)
      expect(isSettlementParticipant(groupSettlementCA, charlie.id)).toBe(true)
      // Bob is in the group but has zero participation in Alice-Charlie settlement
      expect(isSettlementParticipant(groupSettlementCA, bob.id)).toBe(false)
    })

    it('identifies raw sync op payload participation', () => {
      const expensePayload = {
        paidBy: alice.id,
        shares: [{ owedBy: charlie.id, owedTo: alice.id }],
      }
      expect(isExpenseOpParticipant(expensePayload, bob.id)).toBe(false)
      expect(isExpenseOpParticipant(expensePayload, charlie.id)).toBe(true)
      expect(isExpenseOpParticipant(expensePayload, alice.id)).toBe(true)

      const settlementPayload = {
        from: charlie.id,
        to: alice.id,
      }
      expect(isSettlementOpParticipant(settlementPayload, bob.id)).toBe(false)
      expect(isSettlementOpParticipant(settlementPayload, charlie.id)).toBe(true)
      expect(isSettlementOpParticipant(settlementPayload, alice.id)).toBe(true)
    })
  })

  describe('Group Statement Privacy Projection', () => {
    it('omits non-participating transactions from a member statement', () => {
      // Bob's statement for the group
      const bobStatement = buildGroupStatement({
        me: bob,
        group: tripGroup,
        people,
        expenses: [groupExpenseAC],
        settlements: [groupSettlementCA],
      })

      // Bob was in neither expense nor settlement -> total counts must be 0
      expect(bobStatement.totalExpenseCount).toBe(0)
      expect(bobStatement.totalSettlementCount).toBe(0)
      expect(bobStatement.items).toHaveLength(0)

      // Charlie's statement for the group
      const charlieStatement = buildGroupStatement({
        me: charlie,
        group: tripGroup,
        people,
        expenses: [groupExpenseAC],
        settlements: [groupSettlementCA],
      })

      expect(charlieStatement.totalExpenseCount).toBe(1)
      expect(charlieStatement.totalSettlementCount).toBe(1)
      expect(charlieStatement.items).toHaveLength(2)

      // Alice's statement for the group
      const aliceStatement = buildGroupStatement({
        me: alice,
        group: tripGroup,
        people,
        expenses: [groupExpenseAC],
        settlements: [groupSettlementCA],
      })

      expect(aliceStatement.totalExpenseCount).toBe(1)
      expect(aliceStatement.totalSettlementCount).toBe(1)
      expect(aliceStatement.items).toHaveLength(2)
    })
  })

  describe('Group Net Position & Debt Simplification Privacy', () => {
    it('ensures non-participating members have zero balance impact and no debt plan obligations', () => {
      // For Bob: expenses filtered by isExpenseParticipant
      const bobVisibleExpenses = [groupExpenseAC].filter((e) => isExpenseParticipant(e, bob.id))
      const bobVisibleSettlements = [groupSettlementCA].filter((s) => isSettlementParticipant(s, bob.id))

      const bobNets = groupNets({
        group: tripGroup,
        expenses: bobVisibleExpenses,
        settlements: bobVisibleSettlements,
      })

      expect(bobNets[bob.id]).toBe(0)

      const bobDebtPlan = simplifyDebts(bobNets).filter((t) => t.from === bob.id || t.to === bob.id)
      expect(bobDebtPlan).toHaveLength(0)

      // For Charlie: Charlie sees his debt with Alice
      const charlieVisibleExpenses = [groupExpenseAC].filter((e) => isExpenseParticipant(e, charlie.id))
      const charlieNets = groupNets({
        group: tripGroup,
        expenses: charlieVisibleExpenses,
        settlements: [],
      })

      expect(charlieNets[charlie.id]).toBe(-3000)
      expect(charlieNets[alice.id]).toBe(3000)
    })
  })

  describe('Push & In-App Notification Privacy Suppression', () => {
    it('suppresses notifications for non-participants on incoming sync operations', () => {
      const notificationService = new NotificationService()
      const toastHandler = vi.fn()
      notificationService.subscribeToast(toastHandler)

      const remoteExpenseOp: SyncOp = {
        opId: 'op_exp_1',
        deviceId: 'device_alice',
        kind: 'addExpense',
        payload: {
          id: 'exp_remote',
          description: 'Kayak Rental',
          totalMinor: 4000,
          currency: { symbol: '₹', scale: 100 },
          paidBy: alice.id,
          shares: [
            { owedBy: charlie.id, owedTo: alice.id },
            { owedBy: alice.id, owedTo: alice.id },
          ],
        },
        createdAtMicros: Date.now() * 1000,
      }

      // 1. Process as Bob: Bob is NOT a participant -> no notification
      notificationService.notifyRemoteOps([remoteExpenseOp], {
        localDeviceId: 'device_bob',
        isMe: (id) => id === bob.id,
      })
      expect(toastHandler).not.toHaveBeenCalled()

      // 2. Process as Charlie: Charlie is in shares -> receives notification
      notificationService.notifyRemoteOps([remoteExpenseOp], {
        localDeviceId: 'device_charlie',
        isMe: (id) => id === charlie.id,
      })
      expect(toastHandler).toHaveBeenCalledTimes(1)
      expect(toastHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Expense Added',
          body: expect.stringContaining('Kayak Rental'),
        })
      )
    })

    it('suppresses settlement notifications for members not involved in the transfer', () => {
      const notificationService = new NotificationService()
      const toastHandler = vi.fn()
      notificationService.subscribeToast(toastHandler)

      const remoteSettlementOp: SyncOp = {
        opId: 'op_set_1',
        deviceId: 'device_charlie',
        kind: 'addSettlement',
        payload: {
          amountMinor: 3000,
          currency: { symbol: '₹', scale: 100 },
          from: charlie.id,
          to: alice.id,
        },
        createdAtMicros: Date.now() * 1000,
      }

      // Bob is neither payer nor recipient -> suppressed
      notificationService.notifyRemoteOps([remoteSettlementOp], {
        localDeviceId: 'device_bob',
        isMe: (id) => id === bob.id,
      })
      expect(toastHandler).not.toHaveBeenCalled()

      // Alice is recipient (to) -> notified
      notificationService.notifyRemoteOps([remoteSettlementOp], {
        localDeviceId: 'device_alice',
        isMe: (id) => id === alice.id,
      })
      expect(toastHandler).toHaveBeenCalledTimes(1)
      expect(toastHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Settlement Payment Received',
        })
      )
    })
  })

  describe('1-to-1 Bilateral Transactions Outside Groups', () => {
    it('restricts visibility strictly to the two parties involved', () => {
      const directLoan: Expense = {
        id: 'exp_direct_1',
        description: 'Personal Loan',
        totalMinor: 5000,
        currency: Currencies.INR,
        paidBy: alice.id,
        groupId: null, // Outside group
        mode: 'exact',
        createdAtMicros: 1500000000,
        categoryEmoji: '💸',
        isLoan: true,
        loanType: 'lent',
        isTombstone: false,
        shares: [
          {
            id: 's_loan_1',
            expenseId: 'exp_direct_1',
            owedBy: bob.id,
            owedTo: alice.id,
            amountMinor: 5000,
            groupId: null,
          },
        ],
      }

      // Alice and Bob are the two parties
      expect(isExpenseParticipant(directLoan, alice.id)).toBe(true)
      expect(isExpenseParticipant(directLoan, bob.id)).toBe(true)

      // Charlie is a third party -> zero visibility
      expect(isExpenseParticipant(directLoan, charlie.id)).toBe(false)
    })
  })

  describe('Exception Safety & Bound Store Predicates', () => {
    it('does not throw when isMe throws or accesses undefined context', () => {
      const brokenIsMe = () => {
        throw new TypeError('can\'t access property "state", this is undefined')
      }

      expect(() => isExpenseParticipant(groupExpenseAC, 'unknown', brokenIsMe)).not.toThrow()
      expect(isExpenseParticipant(groupExpenseAC, 'unknown', brokenIsMe)).toBe(false)

      expect(() => isSettlementParticipant(groupSettlementCA, 'unknown', brokenIsMe)).not.toThrow()
      expect(isSettlementParticipant(groupSettlementCA, 'unknown', brokenIsMe)).toBe(false)
    })

    it('works with LedgerStore instance even when detached', async () => {
      const { LedgerStore } = await import('../../src/data/storage/ledgerStore')
      const { MemoryStorageAdapter } = await import('../../src/data/storage/memoryStorageAdapter')
      const store = new LedgerStore(new MemoryStorageAdapter())
      await store.init()

      const detachedIsMe = store.isMe
      expect(() => detachedIsMe('test')).not.toThrow()
      expect(isExpenseParticipant(groupExpenseAC, '', detachedIsMe)).toBe(false)
    })
  })

  describe('Invariant INV-FRIEND-PRIVACY: Friend Visibility Scoping', () => {
    const aadil: Person = { id: 'user_aadil', name: 'Aadil' }
    const hashim: Person = { id: 'user_hashim', name: 'Hashim', handle: '9526638234', addedBy: 'user_aadil' }
    const nabeel: Person = { id: 'user_nabeel', name: 'Nabeel' }
    const abhijith: Person = { id: 'user_abhijith', name: 'Abhijith' }

    const loanExpense: Expense = {
      id: 'loan_aadil_hashim',
      description: 'Loan given to Hashim',
      totalMinor: 200000,
      currency: Currencies.AED,
      paidBy: aadil.id,
      splitMode: 'exact',
      shares: [
        {
          id: 'share_hashim',
          expenseId: 'loan_aadil_hashim',
          owedBy: hashim.id,
          owedTo: aadil.id,
          amountMinor: 200000,
        },
      ],
      createdAtMicros: 1000,
    }

    it('shows Hashim to Aadil because Aadil added Hashim and shares an expense with him', () => {
      const visibleToAadil = isFriendOfUser({
        person: hashim,
        meId: aadil.id,
        expenses: [loanExpense],
        settlements: [],
        groups: [],
      })
      expect(visibleToAadil).toBe(true)
    })

    it('hides Hashim from Nabeel and Abhijith who have no mutual transactions or groups with Hashim', () => {
      const visibleToNabeel = isFriendOfUser({
        person: hashim,
        meId: nabeel.id,
        expenses: [loanExpense],
        settlements: [],
        groups: [],
      })
      expect(visibleToNabeel).toBe(false)

      const visibleToAbhijith = isFriendOfUser({
        person: hashim,
        meId: abhijith.id,
        expenses: [loanExpense],
        settlements: [],
        groups: [],
      })
      expect(visibleToAbhijith).toBe(false)
    })

    it('shows manually added friend without transactions ONLY to creator', () => {
      const newFriend: Person = { id: 'user_new', name: 'New Friend', addedBy: aadil.id }

      // Visible to Aadil (creator)
      expect(isFriendOfUser({ person: newFriend, meId: aadil.id, expenses: [], settlements: [], groups: [] })).toBe(true)

      // Hidden from Nabeel
      expect(isFriendOfUser({ person: newFriend, meId: nabeel.id, expenses: [], settlements: [], groups: [] })).toBe(false)
    })

    it('shows friend to other user if they join a mutual group', () => {
      const groupFriend: Person = { id: 'user_group_friend', name: 'Group Friend' }
      const mutualGroup: Group = {
        id: 'group_work',
        name: 'Work Trip',
        kind: 'trip',
        memberIds: [nabeel.id, groupFriend.id],
        currency: Currencies.AED,
      }

      // Visible to Nabeel because of mutual group membership
      expect(
        isFriendOfUser({
          person: groupFriend,
          meId: nabeel.id,
          expenses: [],
          settlements: [],
          groups: [mutualGroup],
        })
      ).toBe(true)

      // Hidden from Abhijith who is not in the group
      expect(
        isFriendOfUser({
          person: groupFriend,
          meId: abhijith.id,
          expenses: [],
          settlements: [],
          groups: [mutualGroup],
        })
      ).toBe(false)
    })

    it('never shows self as a friend of self', () => {
      expect(isFriendOfUser({ person: aadil, meId: aadil.id })).toBe(false)
    })

    it('never shows tombstoned persons or system placeholders', () => {
      const tombstoned: Person = { id: 'user_tomb', name: 'Deleted', isTombstone: true, addedBy: aadil.id }
      expect(isFriendOfUser({ person: tombstoned, meId: aadil.id })).toBe(false)

      const placeholderYou: Person = { id: 'user_you', name: 'You', addedBy: aadil.id }
      expect(isFriendOfUser({ person: placeholderYou, meId: aadil.id })).toBe(false)

      const invitedUser: Person = { id: 'invited_12345', name: 'Invited Friend' }
      expect(isFriendOfUser({ person: invitedUser, meId: aadil.id })).toBe(false)
    })
  })

})
