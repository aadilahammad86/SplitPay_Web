import type { Expense, Group, Settlement } from './entities'
import type { CurrencyCode } from './money'

export interface BalanceSlice {
  groupId: string | null
  amountMinor: number
  isDirect: boolean
}

/**
 * Signature feature SE-12:
 * Decomposes net balance between [me] and [friend] into coloured source chips
 * showing which group (or direct 1:1) produced each slice.
 *
 * Invariant: sum of slices === netMinor exactly.
 */
export interface BalanceBreakdown {
  slices: BalanceSlice[]
  netMinor: number
  isSettled: boolean
  theyOweYou: boolean
  direct: BalanceSlice | null
  groupSlices: BalanceSlice[]
}

export function breakdownFor(params: {
  me: string
  friend: string
  expenses: readonly Expense[]
  settlements: readonly Settlement[]
  isMe?: (id: string) => boolean
  isFriend?: (id: string) => boolean
}): BalanceBreakdown {
  const { me, friend, expenses, settlements, isMe, isFriend } = params
  const isMeFn = isMe ?? ((id: string) => id === me)
  const isFriendFn = isFriend ?? ((id: string) => id === friend)
  const byGroup = new Map<string | null, number>()

  for (const e of expenses) {
    if (e.isTombstone) continue
    for (const s of e.shares) {
      if (isFriendFn(s.owedBy) && isMeFn(s.owedTo)) {
        const current = byGroup.get(s.groupId) ?? 0
        byGroup.set(s.groupId, current + s.amountMinor)
      } else if (isMeFn(s.owedBy) && isFriendFn(s.owedTo)) {
        const current = byGroup.get(s.groupId) ?? 0
        byGroup.set(s.groupId, current - s.amountMinor)
      }
    }
  }

  for (const st of settlements) {
    if (st.isTombstone) continue
    if (isFriendFn(st.from) && isMeFn(st.to)) {
      const current = byGroup.get(st.groupId) ?? 0
      byGroup.set(st.groupId, current - st.amountMinor)
    } else if (isMeFn(st.from) && isFriendFn(st.to)) {
      const current = byGroup.get(st.groupId) ?? 0
      byGroup.set(st.groupId, current + st.amountMinor)
    }
  }

  // Remove settled slices
  for (const [k, v] of byGroup.entries()) {
    if (v === 0) {
      byGroup.delete(k)
    }
  }

  // Deterministic order: direct (null) first, then groupId ascending
  const keys = Array.from(byGroup.keys()).sort((a, b) => {
    if (a === null) return -1
    if (b === null) return 1
    return a.localeCompare(b)
  })

  let net = 0
  const slices: BalanceSlice[] = []
  for (const k of keys) {
    const v = byGroup.get(k)!
    net += v
    slices.push({
      groupId: k,
      amountMinor: v,
      isDirect: k === null,
    })
  }

  const directSlice = slices.find((s) => s.isDirect) ?? null
  const groupSlices = slices.filter((s) => !s.isDirect)

  return {
    slices,
    netMinor: net,
    isSettled: net === 0,
    theyOweYou: net > 0,
    direct: directSlice,
    groupSlices,
  }
}

/**
 * Net position of each member in a group: (paid - owed) in minor units.
 * Used for debt simplification.
 */
export function groupNets(params: {
  group: Group
  expenses: readonly Expense[]
  settlements: readonly Settlement[]
}): Record<string, number> {
  const { group, expenses, settlements } = params
  const nets: Record<string, number> = {}
  for (const mId of group.memberIds) {
    nets[mId] = 0
  }

  for (const e of expenses) {
    if (e.isTombstone || e.groupId !== group.id) continue
    for (const s of e.shares) {
      nets[s.owedTo] = (nets[s.owedTo] ?? 0) + s.amountMinor
      nets[s.owedBy] = (nets[s.owedBy] ?? 0) - s.amountMinor
    }
  }

  for (const st of settlements) {
    if (st.groupId !== group.id) continue
    nets[st.from] = (nets[st.from] ?? 0) + st.amountMinor
    nets[st.to] = (nets[st.to] ?? 0) - st.amountMinor
  }

  return nets
}

/**
 * Calculates overall net balances for a user across all people.
 */
export function calculateOverallBalance(params: {
  me: string
  friendIds: readonly string[]
  expenses: readonly Expense[]
  settlements: readonly Settlement[]
  isMe?: (id: string) => boolean
}): {
  totalOwedToYouMinor: number
  totalYouOweMinor: number
  netMinor: number
} {
  const { me, friendIds, expenses, settlements, isMe } = params
  let totalOwedToYouMinor = 0
  let totalYouOweMinor = 0

  for (const fId of friendIds) {
    if (fId === me || (isMe && isMe(fId))) continue
    const breakdown = breakdownFor({ me, friend: fId, expenses, settlements, isMe })
    if (breakdown.netMinor > 0) {
      totalOwedToYouMinor += breakdown.netMinor
    } else if (breakdown.netMinor < 0) {
      totalYouOweMinor += Math.abs(breakdown.netMinor)
    }
  }

  return {
    totalOwedToYouMinor,
    totalYouOweMinor,
    netMinor: totalOwedToYouMinor - totalYouOweMinor,
  }
}

export type TransactionUserStatus =
  | 'lent'
  | 'borrowed'
  | 'sent'
  | 'received'
  | 'settled'
  | 'not_involved'

export interface UserTransactionPosition {
  id: string
  title: string
  totalMinor: number
  currency: CurrencyCode
  createdAtMicros: number
  emoji: string
  isSettlement: boolean
  groupId: string | null
  paidBy: string
  paidByName: string
  isPayer: boolean
  userShareMinor: number
  netImpactMinor: number
  status: TransactionUserStatus
}

export function getUserExpensePosition(params: {
  expense: Expense
  meId: string
  isMe?: (id: string) => boolean
  getPayerName?: (id: string) => string
}): UserTransactionPosition {
  const { expense, meId, isMe, getPayerName } = params
  const isMeFn = isMe ?? ((id: string) => id === meId)
  const isPayer = isMeFn(expense.paidBy)
  const paidByName = isPayer ? 'You' : (getPayerName ? getPayerName(expense.paidBy) : 'Someone')

  // Sum what others owe the payer on this expense
  const sumOthersOwedMinor = expense.shares
    .filter((s) => s.owedTo === expense.paidBy && !isMeFn(s.owedBy))
    .reduce((sum, s) => sum + s.amountMinor, 0)

  const myShareRow = expense.shares.find((s) => isMeFn(s.owedBy))
  const userShareMinor = isPayer
    ? Math.max(0, expense.totalMinor - sumOthersOwedMinor)
    : myShareRow?.amountMinor || 0

  let netImpactMinor = 0
  let status: TransactionUserStatus = 'not_involved'

  if (isPayer) {
    netImpactMinor = sumOthersOwedMinor
    status = netImpactMinor > 0 ? 'lent' : 'settled'
  } else if (myShareRow) {
    netImpactMinor = -myShareRow.amountMinor
    status = 'borrowed'
  }

  return {
    id: expense.id,
    title: expense.description,
    totalMinor: expense.totalMinor,
    currency: expense.currency,
    createdAtMicros: expense.createdAtMicros,
    emoji: expense.categoryEmoji || '🧾',
    isSettlement: false,
    groupId: expense.groupId,
    paidBy: expense.paidBy,
    paidByName,
    isPayer,
    userShareMinor,
    netImpactMinor,
    status,
  }
}

export function getUserSettlementPosition(params: {
  settlement: Settlement
  meId: string
  isMe?: (id: string) => boolean
  getPersonName?: (id: string) => string
}): UserTransactionPosition {
  const { settlement, meId, isMe, getPersonName } = params
  const isMeFn = isMe ?? ((id: string) => id === meId)
  const isSender = isMeFn(settlement.from)
  const isReceiver = isMeFn(settlement.to)
  const fromName = isSender ? 'You' : (getPersonName ? getPersonName(settlement.from) : 'Someone')
  const toName = isReceiver ? 'You' : (getPersonName ? getPersonName(settlement.to) : 'Someone')

  let netImpactMinor = 0
  let status: TransactionUserStatus = 'not_involved'

  if (isSender) {
    netImpactMinor = -settlement.amountMinor
    status = 'sent'
  } else if (isReceiver) {
    netImpactMinor = settlement.amountMinor
    status = 'received'
  }

  const title = settlement.note
    ? `Payment: ${settlement.note}`
    : isSender
    ? `Payment to ${toName}`
    : isReceiver
    ? `Payment from ${fromName}`
    : `Payment from ${fromName} to ${toName}`

  return {
    id: settlement.id,
    title,
    totalMinor: settlement.amountMinor,
    currency: settlement.currency,
    createdAtMicros: settlement.createdAtMicros,
    emoji: '🤝',
    isSettlement: true,
    groupId: settlement.groupId,
    paidBy: settlement.from,
    paidByName: fromName,
    isPayer: isSender,
    userShareMinor: 0,
    netImpactMinor,
    status,
  }
}
