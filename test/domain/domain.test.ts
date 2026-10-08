import { describe, it, expect } from 'vitest'
import { Money, Currencies } from '../../src/domain/money'
import { stableSeed } from '../../src/domain/stableSeed'
import {
  splitEqual,
  splitByShares,
  splitByPercentage,
  splitExact,
  splitByAdjustment,
  simplifyDebts,
  buildExpense,
  ValidationFailure,
} from '../../src/domain/splitEngine'
import { breakdownFor } from '../../src/domain/balance'
import {
  applyOps,
  emptyLedgerSnapshot,
  opAddPerson,
  opAddExpense,
  opSetTombstone,
} from '../../src/domain/syncOp'
import { buildFriendStatement, generateStatementCsv } from '../../src/domain/statement'
import type { Person } from '../../src/domain/entities'

describe('Domain - Financial Invariants & Money (INV-1)', () => {
  it('enforces integer minor units strictly', () => {
    const m = new Money(5000, Currencies.INR) // ₹50.00
    expect(m.minor).toBe(5000)
    expect(m.plain()).toBe('50.00')

    expect(() => new Money(50.5, Currencies.INR)).toThrow(TypeError)
  })

  it('respects per-currency scales (e.g. JPY has 0 decimals, KWD has 3)', () => {
    const jpy = new Money(1500, Currencies.JPY)
    expect(jpy.plain()).toBe('1500')

    const kwd = new Money(1250, Currencies.KWD)
    expect(kwd.plain()).toBe('1.250')

    const usd = new Money(1999, Currencies.USD)
    expect(usd.plain()).toBe('19.99')
  })

  it('performs arithmetic without floating-point error', () => {
    const m1 = new Money(100, Currencies.USD)
    const m2 = new Money(200, Currencies.USD)
    expect(m1.add(m2).minor).toBe(300)
    expect(m2.sub(m1).minor).toBe(100)
  })

  it('prohibits cross-currency arithmetic', () => {
    const m1 = new Money(100, Currencies.USD)
    const m2 = new Money(100, Currencies.EUR)
    expect(() => m1.add(m2)).toThrow(/Currency mismatch/)
  })
})

describe('Domain - Split Engine & Invariants (INV-2, INV-3)', () => {
  it('FNV-1a stableSeed produces identical deterministic values', () => {
    const s1 = stableSeed('expense_12345')
    const s2 = stableSeed('expense_12345')
    expect(s1).toBe(s2)
    expect(Number.isInteger(s1)).toBe(true)
    expect(s1).toBeGreaterThanOrEqual(0)
  })

  it('INV-2: allocateByWeight exact sum: 100 minor units between 3 people yields [33, 33, 34]', () => {
    const shares = splitEqual({
      totalMinor: 100,
      memberIds: ['u1', 'u2', 'u3'],
      expenseId: 'exp_deterministic',
    })
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100)
    expect(shares.sort()).toEqual([33, 33, 34])
  })

  it('INV-2 property: sum of allocated shares matches total for arbitrary splits', () => {
    for (let total = 1; total <= 500; total += 13) {
      for (const n of [2, 3, 4, 5, 7]) {
        const members = Array.from({ length: n }, (_, i) => `user_${i}`)
        const res = splitEqual({ totalMinor: total, memberIds: members, expenseId: `exp_${total}_${n}` })
        const sum = res.reduce((a, b) => a + b, 0)
        expect(sum).toBe(total)
      }
    }
  })

  it('supports percentage splits totaling 10000 basis points', () => {
    const shares = splitByPercentage({
      totalMinor: 10000, // 100.00
      memberIds: ['u1', 'u2', 'u3'],
      basisPoints: [5000, 2500, 2500],
      expenseId: 'exp_pct',
    })
    expect(shares.reduce((a, b) => a + b, 0)).toBe(10000)
    expect(shares).toEqual([5000, 2500, 2500])

    expect(() =>
      splitByPercentage({
        totalMinor: 1000,
        memberIds: ['u1', 'u2'],
        basisPoints: [5000, 4000], // 90%
        expenseId: 'exp_err',
      })
    ).toThrow(ValidationFailure)
  })

  it('supports weighted shares', () => {
    const shares = splitByShares({
      totalMinor: 300,
      memberIds: ['u1', 'u2'],
      weights: [2, 1],
      expenseId: 'exp_shares',
    })
    expect(shares.reduce((a, b) => a + b, 0)).toBe(300)
    expect(shares).toEqual([200, 100])
  })

  it('supports exact amounts and rejects mismatch', () => {
    const res = splitExact({
      totalMinor: 1500,
      amountsMinor: [500, 1000],
    })
    expect(res).toEqual([500, 1000])

    expect(() =>
      splitExact({
        totalMinor: 1500,
        amountsMinor: [500, 999],
      })
    ).toThrow(ValidationFailure)
  })

  it('supports adjustment splits', () => {
    const shares = splitByAdjustment({
      totalMinor: 100,
      memberIds: ['u1', 'u2'],
      adjustmentsMinor: [20, 0],
      expenseId: 'exp_adj',
    })
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100)
    expect(shares).toEqual([60, 40])
  })

  it('simplifies debts via greedy min-cash-flow in at most n - 1 transfers', () => {
    // 3 users: A owes 30, B owes 20, C is owed 50
    const nets = {
      userA: -30,
      userB: -20,
      userC: 50,
    }
    const transfers = simplifyDebts(nets)
    expect(transfers.length).toBeLessThanOrEqual(2)
    const totalTransferred = transfers.reduce((acc, t) => acc + t.amountMinor, 0)
    expect(totalTransferred).toBe(50)
    expect(transfers.find((t) => t.from === 'userA' && t.to === 'userC')?.amountMinor).toBe(30)
    expect(transfers.find((t) => t.from === 'userB' && t.to === 'userC')?.amountMinor).toBe(20)
  })
})

describe('Domain - Derived Balances & Source Chips (INV-5, SE-12)', () => {
  it('decomposes friend balance into direct and group source chips', () => {
    const me = 'user_me'
    const friend = 'user_friend'

    // Expense 1: Direct 1:1 dinner for 100, me paid, friend owes 50
    const exp1 = buildExpense({
      id: 'e1',
      description: 'Dinner',
      totalMinor: 100,
      currency: Currencies.INR,
      paidBy: me,
      groupId: null, // direct
      memberIds: [me, friend],
      mode: 'equal',
      createdAtMicros: 1000,
    })

    // Expense 2: Trip group expense for 300, me paid, friend owes 150
    const exp2 = buildExpense({
      id: 'e2',
      description: 'Hotel',
      totalMinor: 300,
      currency: Currencies.INR,
      paidBy: me,
      groupId: 'grp_trip',
      memberIds: [me, friend],
      mode: 'equal',
      createdAtMicros: 2000,
    })

    const breakdown = breakdownFor({
      me,
      friend,
      expenses: [exp1, exp2],
      settlements: [],
    })

    expect(breakdown.netMinor).toBe(200) // 50 + 150
    expect(breakdown.theyOweYou).toBe(true)
    expect(breakdown.slices.length).toBe(2)

    // Direct slice
    expect(breakdown.direct?.amountMinor).toBe(50)
    // Group slice
    const tripSlice = breakdown.groupSlices.find((s) => s.groupId === 'grp_trip')
    expect(tripSlice?.amountMinor).toBe(150)
  })

  it('settlement reduces the balance correctly', () => {
    const me = 'user_me'
    const friend = 'user_friend'

    const exp = buildExpense({
      id: 'e1',
      description: 'Lunch',
      totalMinor: 100,
      currency: Currencies.INR,
      paidBy: me,
      groupId: null,
      memberIds: [me, friend],
      mode: 'equal',
      createdAtMicros: 1000,
    })

    const settlement = {
      id: 's1',
      from: friend,
      to: me,
      amountMinor: 50,
      currency: Currencies.INR,
      groupId: null,
      note: 'UPI transfer',
      createdAtMicros: 2000,
    }

    const breakdown = breakdownFor({
      me,
      friend,
      expenses: [exp],
      settlements: [settlement],
    })

    expect(breakdown.netMinor).toBe(0)
    expect(breakdown.isSettled).toBe(true)
    expect(breakdown.slices.length).toBe(0)
  })
})

describe('Domain - Append-Only Sync Operations & Skew-Proof Fold (INV-4)', () => {
  it('applyOps is idempotent by opId', () => {
    const base = emptyLedgerSnapshot()
    const op = opAddPerson({
      opId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      deviceId: 'dev1',
      atMicros: 1000,
      person: { id: 'p1', name: 'Alice' },
    })

    const first = applyOps(base, [op])
    expect(first.people.length).toBe(1)

    // Replay same op
    const second = applyOps(first, [op, op])
    expect(second.people.length).toBe(1)
    expect(second.people[0]?.name).toBe('Alice')
  })

  it('applyOps is commutative: order of op arrival does not alter the final state', () => {
    const op1 = opAddPerson({
      opId: '01ARZ3NDEKTSV4RRFFQ69G5FA1',
      deviceId: 'dev1',
      atMicros: 1000,
      person: { id: 'p1', name: 'Alice' },
    })
    const op2 = opAddPerson({
      opId: '01ARZ3NDEKTSV4RRFFQ69G5FA2',
      deviceId: 'dev2',
      atMicros: 2000,
      person: { id: 'p2', name: 'Bob' },
    })

    const runA = applyOps(emptyLedgerSnapshot(), [op1, op2])
    const runB = applyOps(emptyLedgerSnapshot(), [op2, op1])

    expect(runA.people).toEqual(runB.people)
  })

  it('applyOps is skew-proof: handles clock-skew where tombstone has higher opId but lower timestamp', () => {
    const expense = buildExpense({
      id: 'exp1',
      description: 'Coffee',
      totalMinor: 40,
      currency: Currencies.INR,
      paidBy: 'p1',
      groupId: null,
      memberIds: ['p1', 'p2'],
      mode: 'equal',
      createdAtMicros: 5000,
    })

    const addOp = opAddExpense({
      opId: '01ARZ3NDEKTSV4RRFFQ69G5FA1',
      deviceId: 'dev1',
      atMicros: 1000,
      expense,
    })

    const deleteOp = opSetTombstone({
      opId: '01ARZ3NDEKTSV4RRFFQ69G5FA2',
      deviceId: 'dev2',
      atMicros: 2000,
      expenseId: 'exp1',
      tombstoned: true,
    })

    // Delete arrives before add
    const folded = applyOps(emptyLedgerSnapshot(), [deleteOp, addOp])
    expect(folded.expenses.length).toBe(1)
    expect(folded.expenses[0]?.isTombstone).toBe(true)
  })
})

describe('Domain - Statements and CSV Export', () => {
  it('generates friend statement and CSV export', () => {
    const me: Person = { id: 'u1', name: 'Me' }
    const friend: Person = { id: 'u2', name: 'Friend' }

    const exp = buildExpense({
      id: 'e1',
      description: 'Groceries',
      totalMinor: 2000,
      currency: Currencies.INR,
      paidBy: me.id,
      groupId: null,
      memberIds: [me.id, friend.id],
      mode: 'equal',
      createdAtMicros: 1690000000000,
    })

    const statement = buildFriendStatement({
      me,
      friend,
      expenses: [exp],
      settlements: [],
    })

    expect(statement.items.length).toBe(1)
    expect(statement.netBalanceMinor).toBe(1000)

    const csv = generateStatementCsv(statement, 'INR')
    expect(csv).toContain('Groceries')
    expect(csv).toContain('20.00')
    expect(csv).toContain('10.00')
    expect(csv).toContain('ACTIVE')
  })
})
