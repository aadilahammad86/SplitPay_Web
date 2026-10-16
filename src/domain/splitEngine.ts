import { stableSeed } from './stableSeed'
import type { CurrencyCode } from './money'
import type { Expense, ExpenseShare, LoanType, SplitMode } from './entities'

export class ValidationFailure extends Error {
  constructor(message: string) {
    super(`ValidationFailure: ${message}`)
    this.name = 'ValidationFailure'
  }
}

export interface Transfer {
  from: string
  to: string
  amountMinor: number
}

/**
 * Core allocation primitive. Every split mode routes through it.
 * Guarantees:
 *  - result.length === weights.length
 *  - sum(result) === totalMinor exactly (INV-2)
 *  - Deterministic on all platforms (INV-3)
 */
export function allocateByWeight(params: {
  totalMinor: number
  weights: number[]
  order: string[]
  rotation: number
}): number[] {
  const { totalMinor, weights, order, rotation } = params

  if (weights.length === 0) {
    throw new ValidationFailure('no members to split between')
  }
  if (weights.length !== order.length) {
    throw new ValidationFailure('weights and order must be the same length')
  }
  if (totalMinor < 0) {
    throw new ValidationFailure('allocateByWeight requires a non-negative total')
  }
  for (const w of weights) {
    if (!Number.isInteger(w) || w <= 0) {
      throw new ValidationFailure('every weight must be an integer greater than zero')
    }
  }

  let weightSum = 0
  for (const w of weights) {
    weightSum += w
  }

  const base: number[] = []
  const remainders: number[] = []
  for (const w of weights) {
    const product = totalMinor * w
    base.push(Math.floor(product / weightSum))
    remainders.push(product % weightSum)
  }

  let allocated = 0
  for (const b of base) {
    allocated += b
  }
  let leftover = totalMinor - allocated

  // Deterministic ranking: remainder desc, then member id asc
  const idx = Array.from({ length: weights.length }, (_, i) => i).sort((a, b) => {
    const remDiff = remainders[b]! - remainders[a]!
    if (remDiff !== 0) return remDiff
    return order[a]!.localeCompare(order[b]!)
  })

  const n = idx.length
  let k = 0
  while (leftover > 0) {
    const targetIdx = idx[(k + rotation) % n]!
    base[targetIdx] += 1
    leftover -= 1
    k += 1
  }

  // Runtime invariant check
  let check = 0
  for (const b of base) {
    check += b
  }
  if (check !== totalMinor) {
    throw new ValidationFailure(`allocation drift: ${check} !== ${totalMinor}`)
  }

  return base
}

function rotationFor(expenseId: string, n: number): number {
  if (n <= 0) return 0
  return ((stableSeed(expenseId) % n) + n) % n
}

export function splitEqual(params: {
  totalMinor: number
  memberIds: string[]
  expenseId: string
}): number[] {
  const { totalMinor, memberIds, expenseId } = params
  if (memberIds.length === 0) {
    throw new ValidationFailure('no members to split between')
  }
  return allocateByWeight({
    totalMinor,
    weights: new Array(memberIds.length).fill(1),
    order: memberIds,
    rotation: rotationFor(expenseId, memberIds.length),
  })
}

export function splitByShares(params: {
  totalMinor: number
  memberIds: string[]
  weights: number[]
  expenseId: string
}): number[] {
  const { totalMinor, memberIds, weights, expenseId } = params
  return allocateByWeight({
    totalMinor,
    weights,
    order: memberIds,
    rotation: rotationFor(expenseId, memberIds.length),
  })
}

export function splitByPercentage(params: {
  totalMinor: number
  memberIds: string[]
  basisPoints: number[]
  expenseId: string
}): number[] {
  const { totalMinor, memberIds, basisPoints, expenseId } = params
  let sum = 0
  for (const bp of basisPoints) {
    sum += bp
  }
  if (sum !== 10000) {
    throw new ValidationFailure(
      `percentages must total 100.00% (10000 basis points), got ${(sum / 100).toFixed(2)}%`
    )
  }
  return allocateByWeight({
    totalMinor,
    weights: basisPoints,
    order: memberIds,
    rotation: rotationFor(expenseId, memberIds.length),
  })
}

export function splitExact(params: {
  totalMinor: number
  amountsMinor: number[]
}): number[] {
  const { totalMinor, amountsMinor } = params
  let sum = 0
  for (const a of amountsMinor) {
    sum += a
  }
  if (sum !== totalMinor) {
    throw new ValidationFailure(
      `exact amounts total ${sum} but expense is ${totalMinor} (off by ${totalMinor - sum})`
    )
  }
  return [...amountsMinor]
}

export function splitByAdjustment(params: {
  totalMinor: number
  memberIds: string[]
  adjustmentsMinor: number[]
  expenseId: string
}): number[] {
  const { totalMinor, memberIds, adjustmentsMinor, expenseId } = params
  if (memberIds.length !== adjustmentsMinor.length) {
    throw new ValidationFailure('members and adjustments length mismatch')
  }
  let adjSum = 0
  for (const a of adjustmentsMinor) {
    adjSum += a
  }
  const remainder = totalMinor - adjSum
  if (remainder < 0) {
    throw new ValidationFailure('adjustments exceed the expense total')
  }
  const equal = splitEqual({
    totalMinor: remainder,
    memberIds,
    expenseId,
  })
  return equal.map((val, i) => val + adjustmentsMinor[i]!)
}

/**
 * Greedy min-cash-flow debt simplification heuristic.
 * Nets maps memberId -> (paid - owed) in minor units and MUST sum to zero.
 * Guarantees settlement in at most n - 1 transfers.
 */
export function simplifyDebts(nets: Record<string, number>): Transfer[] {
  let sum = 0
  for (const v of Object.values(nets)) {
    sum += v
  }
  if (sum !== 0) {
    throw new ValidationFailure(`net balances must sum to zero, got ${sum}`)
  }

  const work: Record<string, number> = {}
  const keys = Object.keys(nets).sort() // deterministic iteration
  for (const k of keys) {
    const val = nets[k]!
    if (val !== 0) {
      work[k] = val
    }
  }

  const out: Transfer[] = []
  const liveKeys = Object.keys(work).sort()

  while (true) {
    let creditor: string | null = null
    let debtor: string | null = null
    let maxCredit = 0
    let minDebit = 0

    for (const k of liveKeys) {
      const v = work[k] ?? 0
      if (v > maxCredit) {
        maxCredit = v
        creditor = k
      }
      if (v < minDebit) {
        minDebit = v
        debtor = k
      }
    }

    if (!creditor || !debtor) break

    const amount = maxCredit < -minDebit ? maxCredit : -minDebit
    out.push({ from: debtor, to: creditor, amountMinor: amount })
    work[creditor] = (work[creditor] ?? 0) - amount
    work[debtor] = (work[debtor] ?? 0) + amount
  }

  return out
}

/**
 * Builds a complete Expense model and calculates shares according to SplitMode.
 */
export function buildExpense(params: {
  id: string
  description: string
  totalMinor: number
  currency: CurrencyCode
  paidBy: string
  groupId: string | null
  memberIds: string[]
  mode: SplitMode
  createdAtMicros: number
  categoryEmoji?: string
  weights?: number[]
  basisPoints?: number[]
  exactAmounts?: number[]
  adjustments?: number[]
  isLoan?: boolean
  loanType?: LoanType
  dueDateMicros?: number
}): Expense {
  const {
    id,
    description,
    totalMinor,
    currency,
    paidBy,
    groupId,
    memberIds,
    mode,
    createdAtMicros,
    categoryEmoji = '🧾',
    weights,
    basisPoints,
    exactAmounts,
    adjustments,
    isLoan,
    loanType,
    dueDateMicros,
  } = params

  if (memberIds.length === 0) {
    throw new ValidationFailure('an expense needs at least one participant')
  }
  if (!memberIds.includes(paidBy)) {
    throw new ValidationFailure('the payer must be one of the participants')
  }

  let allocatedShares: number[]
  switch (mode) {
    case 'equal':
    case 'itemised':
      allocatedShares = splitEqual({ totalMinor, memberIds, expenseId: id })
      break
    case 'shares':
      if (!weights) throw new ValidationFailure('shares mode needs weights')
      allocatedShares = splitByShares({ totalMinor, memberIds, weights, expenseId: id })
      break
    case 'percentage':
      if (!basisPoints) throw new ValidationFailure('percentage mode needs basis points')
      allocatedShares = splitByPercentage({ totalMinor, memberIds, basisPoints, expenseId: id })
      break
    case 'exact':
      if (!exactAmounts) throw new ValidationFailure('exact mode needs amounts')
      allocatedShares = splitExact({ totalMinor, amountsMinor: exactAmounts })
      break
    case 'adjustment':
      if (!adjustments) throw new ValidationFailure('adjustment mode needs adjustments')
      allocatedShares = splitByAdjustment({ totalMinor, memberIds, adjustmentsMinor: adjustments, expenseId: id })
      break
  }

  const rows: ExpenseShare[] = []
  for (let i = 0; i < memberIds.length; i++) {
    const member = memberIds[i]!
    if (member === paidBy) continue // nobody owes themselves
    const shareAmount = allocatedShares[i]!
    if (shareAmount === 0) continue

    rows.push({
      id: `${id}_s${i}`,
      expenseId: id,
      owedBy: member,
      owedTo: paidBy,
      amountMinor: shareAmount,
      groupId,
    })
  }

  return {
    id,
    description: description.trim() || 'Expense',
    totalMinor,
    currency,
    paidBy,
    groupId,
    mode,
    createdAtMicros,
    categoryEmoji,
    isTombstone: false,
    shares: rows,
    isLoan: Boolean(isLoan),
    loanType,
    dueDateMicros,
  }
}
