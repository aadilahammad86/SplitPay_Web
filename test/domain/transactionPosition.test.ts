import { describe, it, expect } from 'vitest'
import { Currencies } from '../../src/domain/money'
import {
  getUserExpensePosition,
  getUserSettlementPosition,
} from '../../src/domain/balance'
import { buildExpense } from '../../src/domain/splitEngine'
import type { Settlement } from '../../src/domain/entities'

describe('Domain - User Transaction Position (Proposal 1 & Exact Share Accounting)', () => {
  const userAadil = 'user_aadil'
  const userNabeel = 'user_nabeel'
  const userSarah = 'user_sarah'
  const userAlex = 'user_alex'

  const peopleMap = new Map([
    [userAadil, { id: userAadil, name: 'Aadil' }],
    [userNabeel, { id: userNabeel, name: 'Nabeel' }],
    [userSarah, { id: userSarah, name: 'Sarah' }],
    [userAlex, { id: userAlex, name: 'Alex' }],
  ])

  const getPersonName = (id: string) => peopleMap.get(id)?.name || 'Someone'

  describe('getUserExpensePosition', () => {
    it('accurately calculates lent amount for payer and borrowed amount for debtor in a 50/50 split', () => {
      // karak: 38.00 AED total, Aadil paid, split 50/50 between Aadil & Nabeel
      const karakExpense = buildExpense({
        id: 'exp_karak',
        description: 'karak',
        totalMinor: 3800,
        currency: Currencies.AED,
        paidBy: userAadil,
        groupId: null,
        memberIds: [userAadil, userNabeel],
        mode: 'equal',
        createdAtMicros: 1000000,
      })

      // View from Aadil (Payer)
      const aadilView = getUserExpensePosition({
        expense: karakExpense,
        meId: userAadil,
        isMe: (id) => id === userAadil,
        getPayerName: getPersonName,
      })

      expect(aadilView.isPayer).toBe(true)
      expect(aadilView.paidByName).toBe('You')
      expect(aadilView.totalMinor).toBe(3800)
      expect(aadilView.userShareMinor).toBe(1900) // consumed 19.00 AED
      expect(aadilView.netImpactMinor).toBe(1900) // lent +19.00 AED to Nabeel
      expect(aadilView.status).toBe('lent')

      // View from Nabeel (Debtor)
      const nabeelView = getUserExpensePosition({
        expense: karakExpense,
        meId: userNabeel,
        isMe: (id) => id === userNabeel,
        getPayerName: getPersonName,
      })

      expect(nabeelView.isPayer).toBe(false)
      expect(nabeelView.paidByName).toBe('Aadil')
      expect(nabeelView.totalMinor).toBe(3800)
      expect(nabeelView.userShareMinor).toBe(1900) // consumed 19.00 AED
      expect(nabeelView.netImpactMinor).toBe(-1900) // owes -19.00 AED
      expect(nabeelView.status).toBe('borrowed')
    })

    it('accurately calculates net impact in a 3-way split with non-participating spectators', () => {
      // camp restaurant: 42.00 AED total, Aadil paid, split equally among Aadil, Nabeel, Sarah (14.00 each)
      const campExpense = buildExpense({
        id: 'exp_camp',
        description: 'camp restaurant',
        totalMinor: 4200,
        currency: Currencies.AED,
        paidBy: userAadil,
        groupId: 'grp_work',
        memberIds: [userAadil, userNabeel, userSarah],
        mode: 'equal',
        createdAtMicros: 2000000,
      })

      // View from Aadil (Payer): consumes 14.00, lends 28.00 (14.00 to Nabeel + 14.00 to Sarah)
      const aadilView = getUserExpensePosition({
        expense: campExpense,
        meId: userAadil,
        isMe: (id) => id === userAadil,
        getPayerName: getPersonName,
      })
      expect(aadilView.isPayer).toBe(true)
      expect(aadilView.userShareMinor).toBe(1400)
      expect(aadilView.netImpactMinor).toBe(2800)
      expect(aadilView.status).toBe('lent')

      // View from Sarah (Participant): owes 14.00
      const sarahView = getUserExpensePosition({
        expense: campExpense,
        meId: userSarah,
        isMe: (id) => id === userSarah,
        getPayerName: getPersonName,
      })
      expect(sarahView.isPayer).toBe(false)
      expect(sarahView.paidByName).toBe('Aadil')
      expect(sarahView.userShareMinor).toBe(1400)
      expect(sarahView.netImpactMinor).toBe(-1400)
      expect(sarahView.status).toBe('borrowed')

      // View from Alex (Spectator, not involved in this expense)
      const alexView = getUserExpensePosition({
        expense: campExpense,
        meId: userAlex,
        isMe: (id) => id === userAlex,
        getPayerName: getPersonName,
      })
      expect(alexView.isPayer).toBe(false)
      expect(alexView.userShareMinor).toBe(0)
      expect(alexView.netImpactMinor).toBe(0)
      expect(alexView.status).toBe('not_involved')
    })

    it('correctly handles personal / self-funded expense with 0 lent', () => {
      const soloExpense = buildExpense({
        id: 'exp_solo',
        description: 'solo coffee',
        totalMinor: 2500,
        currency: Currencies.AED,
        paidBy: userAadil,
        groupId: null,
        memberIds: [userAadil],
        mode: 'equal',
        createdAtMicros: 3000000,
      })

      const aadilView = getUserExpensePosition({
        expense: soloExpense,
        meId: userAadil,
        isMe: (id) => id === userAadil,
        getPayerName: getPersonName,
      })
      expect(aadilView.isPayer).toBe(true)
      expect(aadilView.userShareMinor).toBe(2500)
      expect(aadilView.netImpactMinor).toBe(0)
      expect(aadilView.status).toBe('settled')
    })
  })

  describe('getUserSettlementPosition', () => {
    it('correctly reports sender, receiver, and spectator states', () => {
      const settlement: Settlement = {
        id: 'set_1',
        from: userNabeel,
        to: userAadil,
        amountMinor: 1000,
        currency: Currencies.AED,
        groupId: null,
        note: 'Cash settlement',
        createdAtMicros: 4000000,
      }

      // View from Nabeel (Sender)
      const nabeelView = getUserSettlementPosition({
        settlement,
        meId: userNabeel,
        isMe: (id) => id === userNabeel,
        getPersonName,
      })
      expect(nabeelView.isPayer).toBe(true)
      expect(nabeelView.netImpactMinor).toBe(-1000)
      expect(nabeelView.status).toBe('sent')
      expect(nabeelView.title).toBe('Payment: Cash settlement')

      // View from Aadil (Receiver)
      const aadilView = getUserSettlementPosition({
        settlement,
        meId: userAadil,
        isMe: (id) => id === userAadil,
        getPersonName,
      })
      expect(aadilView.isPayer).toBe(false)
      expect(aadilView.netImpactMinor).toBe(1000)
      expect(aadilView.status).toBe('received')

      // View from Sarah (Not involved)
      const sarahView = getUserSettlementPosition({
        settlement,
        meId: userSarah,
        isMe: (id) => id === userSarah,
        getPersonName,
      })
      expect(sarahView.netImpactMinor).toBe(0)
      expect(sarahView.status).toBe('not_involved')
    })
  })
})
