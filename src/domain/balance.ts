import type { Expense, Group, Settlement } from './entities'

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
}): BalanceBreakdown {
  const { me, friend, expenses, settlements } = params
  const byGroup = new Map<string | null, number>()

  for (const e of expenses) {
    if (e.isTombstone) continue
    for (const s of e.shares) {
      if (s.owedBy === friend && s.owedTo === me) {
        const current = byGroup.get(s.groupId) ?? 0
        byGroup.set(s.groupId, current + s.amountMinor)
      } else if (s.owedBy === me && s.owedTo === friend) {
        const current = byGroup.get(s.groupId) ?? 0
        byGroup.set(s.groupId, current - s.amountMinor)
      }
    }
  }

  for (const st of settlements) {
    if (st.from === friend && st.to === me) {
      const current = byGroup.get(st.groupId) ?? 0
      byGroup.set(st.groupId, current - st.amountMinor)
    } else if (st.from === me && st.to === friend) {
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
}): {
  totalOwedToYouMinor: number
  totalYouOweMinor: number
  netMinor: number
} {
  const { me, friendIds, expenses, settlements } = params
  let totalOwedToYouMinor = 0
  let totalYouOweMinor = 0

  for (const fId of friendIds) {
    if (fId === me) continue
    const breakdown = breakdownFor({ me, friend: fId, expenses, settlements })
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
