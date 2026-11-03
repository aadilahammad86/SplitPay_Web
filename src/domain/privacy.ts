import type { Expense, Settlement, Group, Person } from './entities'

/**
 * Invariant INV-TRANSACTION-PRIVACY:
 * Members who share a group have full transparency with each other ONLY for transactions
 * they are both part of. A transaction made through a group is visible only to the members
 * who take part in it (payer or debtor in split shares).
 *
 * Transactions made outside a group (1-to-1) are visible only to the two parties involved.
 */

/**
 * Returns true if the user is a participant in the given expense:
 * either the payer (paidBy) or one of the debtors/creditors in the shares list.
 */
export function isExpenseParticipant(
  expense: Expense,
  userId?: string,
  isMe?: (id: string) => boolean
): boolean {
  if (!userId && !isMe) return false
  const match = (id?: string): boolean => {
    if (!id) return false
    if (userId && id === userId) return true
    if (typeof isMe === 'function') {
      try {
        return Boolean(isMe(id))
      } catch {
        return false
      }
    }
    return false
  }

  if (match(expense.paidBy)) return true
  if (Array.isArray(expense.shares)) {
    return expense.shares.some((s) => match(s.owedBy) || match(s.owedTo))
  }
  return false
}

/**
 * Returns true if the user is a participant in the given settlement:
 * either the payer (from) or the recipient (to).
 */
export function isSettlementParticipant(
  settlement: Settlement,
  userId?: string,
  isMe?: (id: string) => boolean
): boolean {
  if (!userId && !isMe) return false
  const match = (id?: string): boolean => {
    if (!id) return false
    if (userId && id === userId) return true
    if (typeof isMe === 'function') {
      try {
        return Boolean(isMe(id))
      } catch {
        return false
      }
    }
    return false
  }

  return match(settlement.from) || match(settlement.to)
}

/**
 * Validates participation for raw sync operations payloads (e.g. for notifications or sync filters).
 */
export function isExpenseOpParticipant(
  payload: {
    paidBy?: string
    shares?: Array<{ owedBy?: string; owedTo?: string }>
  },
  userId?: string,
  isMe?: (id: string) => boolean
): boolean {
  if (!userId && !isMe) return false
  const match = (id?: string): boolean => {
    if (!id) return false
    if (userId && id === userId) return true
    if (typeof isMe === 'function') {
      try {
        return Boolean(isMe(id))
      } catch {
        return false
      }
    }
    return false
  }

  if (match(payload.paidBy)) return true
  if (Array.isArray(payload.shares)) {
    return payload.shares.some((s) => match(s?.owedBy) || match(s?.owedTo))
  }
  return false
}

/**
 * Validates settlement participation for raw sync operations payloads.
 */
export function isSettlementOpParticipant(
  payload: {
    from?: string
    to?: string
  },
  userId?: string,
  isMe?: (id: string) => boolean
): boolean {
  if (!userId && !isMe) return false
  const match = (id?: string): boolean => {
    if (!id) return false
    if (userId && id === userId) return true
    if (typeof isMe === 'function') {
      try {
        return Boolean(isMe(id))
      } catch {
        return false
      }
    }
    return false
  }

  return match(payload.from) || match(payload.to)
}

/**
 * Invariant INV-FRIEND-PRIVACY:
 * A person P is a visible friend of user M (me) if and only if:
 * 1. P is not a tombstone, not 'You' / 'SplitPay Friend' / 'Guest User' / invited placeholder, and not user M.
 * 2. AND at least ONE of the following holds:
 *    a) Mutual Transaction: M and P share at least one non-tombstoned expense or settlement.
 *    b) Mutual Group: M and P are both members of at least one group.
 *    c) Creator Link: P was explicitly added by M (person.addedBy === M).
 */
export function isFriendOfUser(params: {
  person: Person
  meId?: string
  expenses?: readonly Expense[]
  settlements?: readonly Settlement[]
  groups?: readonly Group[]
  isMe?: (id: string) => boolean
}): boolean {
  const { person, meId, expenses = [], settlements = [], groups = [], isMe } = params

  if (!person || person.isTombstone) return false

  const isMeMatch = (id?: string): boolean => {
    if (!id) return false
    if (meId && id === meId) return true
    if (typeof isMe === 'function') {
      try {
        return Boolean(isMe(id))
      } catch {
        return false
      }
    }
    return false
  }

  // Self is never one's own friend in friend lists
  if (isMeMatch(person.id)) return false

  // Filter out system or invited placeholders
  const name = person.name ? person.name.trim() : ''
  if (
    !name ||
    name === 'You' ||
    name === 'SplitPay Friend' ||
    name === 'Guest User' ||
    person.id.startsWith('invited_')
  ) {
    return false
  }

  // 1. Creator link: Was this person explicitly created/added by me?
  if (person.addedBy && isMeMatch(person.addedBy)) {
    return true
  }

  // 2. Mutual Group: Does this person belong to any group that I also belong to?
  const hasMutualGroup = groups.some((g) => {
    if (!Array.isArray(g.memberIds)) return false
    const personInGroup = g.memberIds.includes(person.id)
    if (!personInGroup) return false
    return g.memberIds.some((mId) => isMeMatch(mId))
  })
  if (hasMutualGroup) return true

  // 3. Mutual Transaction: Does this person share any expense or settlement with me?
  const hasMutualExpense = expenses.some((e) => {
    if (e.isTombstone) return false
    const personInExpense =
      e.paidBy === person.id ||
      (Array.isArray(e.shares) && e.shares.some((s) => s.owedBy === person.id || s.owedTo === person.id))
    if (!personInExpense) return false
    return isExpenseParticipant(e, meId, isMe)
  })
  if (hasMutualExpense) return true

  const hasMutualSettlement = settlements.some((s) => {
    if (s.isTombstone) return false
    const matchSettlementParty = (partyA: string, partyB: string) =>
      (partyA === person.id && isMeMatch(partyB)) || (partyB === person.id && isMeMatch(partyA))
    return matchSettlementParty(s.from, s.to)
  })
  if (hasMutualSettlement) return true

  return false
}
