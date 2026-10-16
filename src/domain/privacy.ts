import type { Expense, Settlement } from './entities'

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
  const match = (id?: string): boolean =>
    Boolean(id && ((userId && id === userId) || (isMe ? isMe(id) : false)))

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
  const match = (id?: string): boolean =>
    Boolean(id && ((userId && id === userId) || (isMe ? isMe(id) : false)))

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
  const match = (id?: string): boolean =>
    Boolean(id && ((userId && id === userId) || (isMe ? isMe(id) : false)))

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
  const match = (id?: string): boolean =>
    Boolean(id && ((userId && id === userId) || (isMe ? isMe(id) : false)))

  return match(payload.from) || match(payload.to)
}
