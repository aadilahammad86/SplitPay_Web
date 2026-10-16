import type { Expense, Group, Person, Settlement } from './entities'
import { breakdownFor } from './balance'
import { isExpenseParticipant, isSettlementParticipant } from './privacy'

export interface StatementItem {
  id: string
  date: Date
  type: 'expense' | 'settlement'
  description: string
  totalMinor: number
  yourShareMinor: number
  paidByName: string
  isSettlement: boolean
  isTombstone: boolean
  note?: string
}

export interface StatementSummary {
  title: string
  startDate?: Date
  endDate?: Date
  totalExpenseCount: number
  totalSettlementCount: number
  netBalanceMinor: number
  items: StatementItem[]
}

/**
 * Builds a chronological statement for a 1:1 friend relationship.
 */
export function buildFriendStatement(params: {
  me: Person
  friend: Person
  expenses: readonly Expense[]
  settlements: readonly Settlement[]
  startDate?: Date
  endDate?: Date
}): StatementSummary {
  const { me, friend, expenses, settlements, startDate, endDate } = params
  const startMicros = startDate ? startDate.getTime() * 1000 : 0
  const endMicros = endDate ? (endDate.getTime() + 86400000) * 1000 : Infinity

  const items: StatementItem[] = []

  for (const e of expenses) {
    if (e.createdAtMicros < startMicros || e.createdAtMicros > endMicros) continue

    // Find shares between me and friend
    let delta = 0
    for (const s of e.shares) {
      if (s.owedBy === friend.id && s.owedTo === me.id) delta += s.amountMinor
      if (s.owedBy === me.id && s.owedTo === friend.id) delta -= s.amountMinor
    }

    if (delta !== 0) {
      items.push({
        id: e.id,
        date: new Date(Math.floor(e.createdAtMicros / 1000)),
        type: 'expense',
        description: e.description,
        totalMinor: e.totalMinor,
        yourShareMinor: Math.abs(delta),
        paidByName: e.paidBy === me.id ? me.name : friend.name,
        isSettlement: false,
        isTombstone: e.isTombstone,
      })
    }
  }

  for (const st of settlements) {
    if (st.createdAtMicros < startMicros || st.createdAtMicros > endMicros) continue

    if (
      (st.from === me.id && st.to === friend.id) ||
      (st.from === friend.id && st.to === me.id)
    ) {
      items.push({
        id: st.id,
        date: new Date(Math.floor(st.createdAtMicros / 1000)),
        type: 'settlement',
        description: st.from === me.id ? `Payment to ${friend.name}` : `Payment from ${friend.name}`,
        totalMinor: st.amountMinor,
        yourShareMinor: st.amountMinor,
        paidByName: st.from === me.id ? me.name : friend.name,
        isSettlement: true,
        isTombstone: false,
        note: st.note,
      })
    }
  }

  // Sort descending by date
  items.sort((a, b) => b.date.getTime() - a.date.getTime())

  const breakdown = breakdownFor({
    me: me.id,
    friend: friend.id,
    expenses,
    settlements,
  })

  return {
    title: `Statement with ${friend.name}`,
    startDate,
    endDate,
    totalExpenseCount: items.filter((i) => !i.isSettlement && !i.isTombstone).length,
    totalSettlementCount: items.filter((i) => i.isSettlement).length,
    netBalanceMinor: breakdown.netMinor,
    items,
  }
}

/**
 * Builds a statement for a shared group.
 */
export function buildGroupStatement(params: {
  me: Person
  group: Group
  people: readonly Person[]
  expenses: readonly Expense[]
  settlements: readonly Settlement[]
  startDate?: Date
  endDate?: Date
}): StatementSummary {
  const { me, group, people, expenses, settlements, startDate, endDate } = params
  const startMicros = startDate ? startDate.getTime() * 1000 : 0
  const endMicros = endDate ? (endDate.getTime() + 86400000) * 1000 : Infinity

  const personNameMap = new Map(people.map((p) => [p.id, p.name]))
  const items: StatementItem[] = []

  for (const e of expenses) {
    if (e.groupId !== group.id) continue
    if (e.createdAtMicros < startMicros || e.createdAtMicros > endMicros) continue
    // Invariant INV-TRANSACTION-PRIVACY: Only include transactions where the user participated
    if (!isExpenseParticipant(e, me.id)) continue

    const myShare = e.shares.find((s) => s.owedBy === me.id)?.amountMinor ?? 0
    items.push({
      id: e.id,
      date: new Date(Math.floor(e.createdAtMicros / 1000)),
      type: 'expense',
      description: e.description,
      totalMinor: e.totalMinor,
      yourShareMinor: myShare,
      paidByName: personNameMap.get(e.paidBy) ?? 'Unknown',
      isSettlement: false,
      isTombstone: e.isTombstone,
    })
  }

  for (const st of settlements) {
    if (st.groupId !== group.id) continue
    if (st.createdAtMicros < startMicros || st.createdAtMicros > endMicros) continue
    // Invariant INV-TRANSACTION-PRIVACY: Only include settlements where the user is from or to
    if (!isSettlementParticipant(st, me.id)) continue

    items.push({
      id: st.id,
      date: new Date(Math.floor(st.createdAtMicros / 1000)),
      type: 'settlement',
      description: `Settlement: ${personNameMap.get(st.from) ?? 'Someone'} → ${personNameMap.get(st.to) ?? 'Someone'}`,
      totalMinor: st.amountMinor,
      yourShareMinor: st.from === me.id || st.to === me.id ? st.amountMinor : 0,
      paidByName: personNameMap.get(st.from) ?? 'Unknown',
      isSettlement: true,
      isTombstone: false,
      note: st.note,
    })
  }

  items.sort((a, b) => b.date.getTime() - a.date.getTime())

  return {
    title: `Statement: ${group.name}`,
    startDate,
    endDate,
    totalExpenseCount: items.filter((i) => !i.isSettlement && !i.isTombstone).length,
    totalSettlementCount: items.filter((i) => i.isSettlement).length,
    netBalanceMinor: 0,
    items,
  }
}

/**
 * Generates RFC 4180 compliant CSV format for download.
 */
export function generateStatementCsv(summary: StatementSummary, currencyCode: string = 'INR'): string {
  const rows: string[][] = [
    ['Date', 'Type', 'Description', `Total (${currencyCode})`, `Your Share (${currencyCode})`, 'Paid By', 'Status', 'Note'],
  ]

  for (const item of summary.items) {
    const totalPlain = (item.totalMinor / 100).toFixed(2)
    const sharePlain = (item.yourShareMinor / 100).toFixed(2)
    const status = item.isTombstone ? 'DELETED' : 'ACTIVE'
    const dateStr = item.date.toISOString().split('T')[0] ?? ''

    rows.push([
      dateStr,
      item.type,
      item.description,
      totalPlain,
      sharePlain,
      item.paidByName,
      status,
      item.note ?? '',
    ])
  }

  return rows
    .map((row) =>
      row
        .map((field) => {
          const escaped = field.replace(/"/g, '""')
          return `"${escaped}"`
        })
        .join(',')
    )
    .join('\r\n')
}
