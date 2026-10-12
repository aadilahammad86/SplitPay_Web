import { Currencies, type CurrencyCode } from './money'

export type SplitMode = 'equal' | 'exact' | 'percentage' | 'shares' | 'adjustment' | 'itemised'

export const SplitModeLabels: Record<SplitMode, string> = {
  equal: 'Equally',
  exact: 'Exact amounts',
  percentage: 'Percentages',
  shares: 'Shares',
  adjustment: 'Adjustment',
  itemised: 'Itemised',
}

export type GroupKind = 'trip' | 'home' | 'couple' | 'event' | 'project' | 'other'

export const GroupKindInfo: Record<GroupKind, { label: string; emoji: string }> = {
  trip: { label: 'Trip', emoji: '🏝' },
  home: { label: 'Home', emoji: '🏠' },
  couple: { label: 'Couple', emoji: '💞' },
  event: { label: 'Event', emoji: '🎉' },
  project: { label: 'Project', emoji: '📁' },
  other: { label: 'Other', emoji: '👥' },
}

export interface Person {
  id: string
  name: string
  handle?: string
  email?: string
  emailVerified?: boolean
  phone?: string // Normalized E.164
  phoneVerified?: boolean
  discoverableByPhone?: boolean
  inviteCode?: string
}

export function personInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  if (parts.length === 1) return parts[0].substring(0, 1).toUpperCase()
  const first = parts[0].substring(0, 1)
  const last = parts[parts.length - 1]!.substring(0, 1)
  return (first + last).toUpperCase()
}

export interface Group {
  id: string
  name: string
  kind: GroupKind
  memberIds: string[]
  currency: CurrencyCode
}

/**
 * One debtor's slice of an expense.
 * Invariant SE-12: groupId is stored on the share row itself (null = direct 1:1).
 * This makes cross-context source chip breakdown a fast grouping.
 */
export interface ExpenseShare {
  id: string
  expenseId: string
  owedBy: string
  owedTo: string
  amountMinor: number
  groupId: string | null
}

export interface Expense {
  id: string
  description: string
  totalMinor: number
  currency: CurrencyCode
  paidBy: string
  groupId: string | null
  mode: SplitMode
  createdAtMicros: number
  categoryEmoji: string
  isTombstone: boolean
  shares: ExpenseShare[]
}

export interface Settlement {
  id: string
  from: string
  to: string
  amountMinor: number
  currency: CurrencyCode
  groupId: string | null
  note: string
  createdAtMicros: number
  isTombstone?: boolean
}

export interface ActivityEntry {
  id: string
  title: string
  subtitle: string
  atMicros: number
  emoji: string
  groupId: string | null
  isSettlement: boolean
  amountMinor?: number
  currency?: CurrencyCode
  isTombstone?: boolean
}

export const BASE_CURRENCY = Currencies.INR
