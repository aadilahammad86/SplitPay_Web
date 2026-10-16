import { describe, it, expect } from 'vitest'
import { Currencies } from '../../src/domain/money'
import { buildExpense } from '../../src/domain/splitEngine'
import { breakdownFor } from '../../src/domain/balance'
import {
  applyOps,
  emptyLedgerSnapshot,
  opAddPerson,
  opAddExpense,
  encodeExpense,
  decodeExpense,
} from '../../src/domain/syncOp'
import type { Expense, Person } from '../../src/domain/entities'

describe('Features - Direct Loans, Credit & Groupwise/Individual Breakdown', () => {
  const me: Person = { id: 'user_me', name: 'You' }
  const alice: Person = { id: 'user_alice', name: 'Alice' }
  const bob: Person = { id: 'user_bob', name: 'Bob' }

  it('buildExpense correctly attaches isLoan, loanType, and dueDateMicros', () => {
    const dueDate = Date.now() * 1000 + 7 * 86400 * 1000000
    const loan = buildExpense({
      id: 'loan_1',
      description: 'Emergency Cash',
      totalMinor: 5000,
      currency: Currencies.INR.code,
      paidBy: me.id,
      groupId: null,
      memberIds: [me.id, alice.id],
      mode: 'exact',
      exactAmounts: [0, 5000],
      isLoan: true,
      loanType: 'lent',
      dueDateMicros: dueDate,
    })

    expect(loan.isLoan).toBe(true)
    expect(loan.loanType).toBe('lent')
    expect(loan.dueDateMicros).toBe(dueDate)
    expect(loan.shares).toHaveLength(1)
    expect(loan.shares[0]!.owedBy).toBe(alice.id)
    expect(loan.shares[0]!.owedTo).toBe(me.id)
    expect(loan.shares[0]!.amountMinor).toBe(5000)
  })

  it('encodeExpense and decodeExpense preserve loan attributes bidirectionally', () => {
    const original: Expense = {
      id: 'loan_test_2',
      description: 'Rent Credit',
      totalMinor: 12000,
      currency: 'INR',
      paidBy: alice.id,
      groupId: null,
      mode: 'exact',
      createdAtMicros: 1700000000000,
      categoryEmoji: '💸',
      isTombstone: false,
      shares: [
        {
          id: 'loan_test_2_s0',
          expenseId: 'loan_test_2',
          owedBy: me.id,
          owedTo: alice.id,
          amountMinor: 12000,
          groupId: null,
        },
      ],
      isLoan: true,
      loanType: 'borrowed',
      dueDateMicros: 1710000000000,
    }

    const encoded = encodeExpense(original)
    const decoded = decodeExpense(encoded)

    expect(decoded.id).toBe(original.id)
    expect(decoded.isLoan).toBe(true)
    expect(decoded.loanType).toBe('borrowed')
    expect(decoded.dueDateMicros).toBe(1710000000000)
    expect(decoded.totalMinor).toBe(12000)
  })

  it('breakdownFor separates groupwise slices and direct slices including direct loans', () => {
    // 1. Group Expense: Alice paid ₹300 for group "Trip", split equally with me
    const groupExpense = buildExpense({
      id: 'exp_group_1',
      description: 'Group Dinner',
      totalMinor: 30000,
      currency: 'INR',
      paidBy: alice.id,
      groupId: 'grp_trip',
      memberIds: [alice.id, me.id],
      mode: 'equal',
    })

    // 2. Direct 1:1 Shared Bill: Me paid ₹100, split equally with Alice
    const directExpense = buildExpense({
      id: 'exp_direct_1',
      description: 'Coffee',
      totalMinor: 10000,
      currency: 'INR',
      paidBy: me.id,
      groupId: null,
      memberIds: [alice.id, me.id],
      mode: 'equal',
    })

    // 3. Direct Loan: Me lent Alice ₹500
    const directLoan: Expense = {
      id: 'loan_direct_1',
      description: 'Cash advance',
      totalMinor: 50000,
      currency: 'INR',
      paidBy: me.id,
      groupId: null,
      mode: 'exact',
      createdAtMicros: Date.now() * 1000,
      categoryEmoji: '💸',
      isTombstone: false,
      shares: [
        {
          id: 'loan_direct_1_s0',
          expenseId: 'loan_direct_1',
          owedBy: alice.id,
          owedTo: me.id,
          amountMinor: 50000,
          groupId: null,
        },
      ],
      isLoan: true,
      loanType: 'lent',
    }

    const breakdown = breakdownFor({
      me: me.id,
      friend: alice.id,
      expenses: [groupExpense, directExpense, directLoan],
      settlements: [],
    })

    // Analysis:
    // Group "Trip": Alice paid 30000, my share is 15000 => I owe Alice 15000 (-15000)
    // Direct Coffee: I paid 10000, Alice share is 5000 => Alice owes me 5000 (+5000)
    // Direct Loan: I lent Alice 50000 => Alice owes me 50000 (+50000)
    // Direct slice total: +5000 + 50000 = +55000
    // Group slice total: -15000
    // Net total: +55000 - 15000 = +40000 (Alice owes me ₹400)
    expect(breakdown.direct?.amountMinor).toBe(55000)
    expect(breakdown.groupSlices).toHaveLength(1)
    expect(breakdown.groupSlices[0]!.groupId).toBe('grp_trip')
    expect(breakdown.groupSlices[0]!.amountMinor).toBe(-15000)
    expect(breakdown.netMinor).toBe(40000)
    expect(breakdown.theyOweYou).toBe(true)

    // Mathematical invariant: sum of slices === netMinor
    const sumSlices = breakdown.slices.reduce((sum, s) => sum + s.amountMinor, 0)
    expect(sumSlices).toBe(breakdown.netMinor)
  })

  it('folds append-only loan ops through applyOps idempotently', () => {
    let snapshot = emptyLedgerSnapshot()
    snapshot = applyOps(snapshot, [
      opAddPerson({
        opId: 'op_p1',
        deviceId: 'dev_1',
        atMicros: 1000,
        person: me,
      }),
      opAddPerson({
        opId: 'op_p2',
        deviceId: 'dev_1',
        atMicros: 1001,
        person: bob,
      }),
    ])

    const loanExpense: Expense = {
      id: 'loan_bob_1',
      description: 'Hand Loan',
      totalMinor: 25000,
      currency: 'INR',
      paidBy: me.id,
      groupId: null,
      mode: 'exact',
      createdAtMicros: 2000,
      categoryEmoji: '💸',
      isTombstone: false,
      shares: [
        {
          id: 'loan_bob_1_s0',
          expenseId: 'loan_bob_1',
          owedBy: bob.id,
          owedTo: me.id,
          amountMinor: 25000,
          groupId: null,
        },
      ],
      isLoan: true,
      loanType: 'lent',
    }

    const opLoan = opAddExpense({
      opId: 'op_exp_loan',
      deviceId: 'dev_1',
      atMicros: 2000,
      expense: loanExpense,
    })

    // Apply once
    snapshot = applyOps(snapshot, [opLoan])
    expect(snapshot.expenses).toHaveLength(1)
    expect(snapshot.expenses[0]!.isLoan).toBe(true)

    // Apply duplicate op (idempotence invariant)
    snapshot = applyOps(snapshot, [opLoan])
    expect(snapshot.expenses).toHaveLength(1)
  })
})
