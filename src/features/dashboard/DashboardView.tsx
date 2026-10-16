import React, { useState } from 'react'
import { useStore } from '../../ui/storeContext'
import { calculateOverallBalance, breakdownFor } from '../../domain/balance'
import { MoneyDisplay } from '../../ui/components/MoneyDisplay'
import { SourceChips } from '../../ui/components/SourceChips'
import { BASE_CURRENCY, GroupKindInfo, personInitials, type Expense, type Person } from '../../domain/entities'
import { formatMoney, formatRelativeDate } from '../../domain/formatMoney'
import { ExpenseEditorModal } from '../expense/ExpenseEditorModal'
import { SettleUpModal } from '../settle/SettleUpModal'
import { CreateGroupModal } from '../groups/CreateGroupModal'
import { ActivityDetailModal } from '../activity/ActivityDetailModal'
import { FriendDetailModal } from '../friends/FriendDetailModal'
import { Icon, CategoryIcon } from '../../ui/components/Icon'
import { isExpenseParticipant, isSettlementParticipant } from '../../domain/privacy'

interface DashboardViewProps {
  onNavigate: (tab: string) => void
  onSelectFriend: (friendId: string) => void
  onSelectGroup: (groupId: string) => void
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onSelectFriend,
  onSelectGroup,
}) => {
  const { store, ledgerState, sharedLedgerId } = useStore()
  const me = store.me
  const meId = me?.id || ''

  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showSettleUp, setShowSettleUp] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [settleFriendId, setSettleFriendId] = useState<string | null>(null)
  const [settleAmountMinor, setSettleAmountMinor] = useState<number>(0)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [selectedActivityIsSettlement, setSelectedActivityIsSettlement] = useState(false)
  const [selectedFriendDetail, setSelectedFriendDetail] = useState<Person | null>(null)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  const validFriends = ledgerState.people.filter(
    (p) =>
      !store.isMe(p.id) &&
      p.name !== 'You' &&
      p.name !== 'SplitPay Friend' &&
      p.name !== 'Guest User' &&
      !p.id.startsWith('invited_') &&
      p.name.trim() !== ''
  )
  const friendIds = validFriends.map((p) => p.id)

  const overall = calculateOverallBalance({
    me: meId,
    friendIds,
    expenses: ledgerState.expenses,
    settlements: ledgerState.settlements,
    isMe: (id) => store.isMe(id),
  })

  const currentCurrency = ledgerState.defaultCurrency || BASE_CURRENCY

  // Calculate total spending this month
  const totalSpentMinor = ledgerState.expenses
    .filter((e) => !e.isTombstone && store.isMe(e.paidBy))
    .reduce((sum, e) => sum + e.totalMinor, 0)

  // Recent transactions (expenses + settlements combined, reverse chronological)
  // Invariant INV-TRANSACTION-PRIVACY: Filter strictly to transactions where the user participates
  const recentTransactions = [
    ...ledgerState.expenses
      .filter((e) => !e.isTombstone && isExpenseParticipant(e, meId, store.isMe))
      .map((e) => ({
        id: e.id,
        title: e.description,
        totalMinor: e.totalMinor,
        currency: e.currency,
        paidBy: e.paidBy,
        paidByName: store.isMe(e.paidBy) ? 'You' : (ledgerState.people.find((p) => p.id === e.paidBy)?.name || 'Someone'),
        myShareMinor: e.shares.find((s) => store.isMe(s.owedBy))?.amountMinor || 0,
        createdAtMicros: e.createdAtMicros,
        emoji: e.categoryEmoji || '🧾',
        isSettlement: false,
        groupId: e.groupId,
      })),
    ...ledgerState.settlements
      .filter((s) => !s.isTombstone && isSettlementParticipant(s, meId, store.isMe))
      .map((s) => ({
        id: s.id,
        title: s.note ? `Payment: ${s.note}` : 'Payment recorded',
        totalMinor: s.amountMinor,
        currency: s.currency,
        paidBy: s.from,
        paidByName: store.isMe(s.from) ? 'You' : (ledgerState.people.find((p) => p.id === s.from)?.name || 'Someone'),
        myShareMinor: 0,
        createdAtMicros: s.createdAtMicros,
        emoji: '🤝',
        isSettlement: true,
        groupId: s.groupId,
      })),
  ].sort((a, b) => b.createdAtMicros - a.createdAtMicros).slice(0, 6)

  const visibleExpensesCount = ledgerState.expenses.filter(
    (e) => !e.isTombstone && isExpenseParticipant(e, meId, store.isMe)
  ).length

  // Friends breakdown with non-zero balances
  const friendsWithBalances = validFriends
    .map((friend) => {
      const breakdown = breakdownFor({
        me: meId,
        friend: friend.id,
        expenses: ledgerState.expenses,
        settlements: ledgerState.settlements,
        isMe: (id) => store.isMe(id),
      })
      return { friend, breakdown }
    })
    .sort((a, b) => Math.abs(b.breakdown.netMinor) - Math.abs(a.breakdown.netMinor))

  const handleQuickSettle = (friendId: string, netMinor: number) => {
    setSettleFriendId(friendId)
    setSettleAmountMinor(netMinor)
    setShowSettleUp(true)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--color-text)] tracking-tight flex items-center gap-2">
            <span>Welcome back, {me?.name || 'Friend'}</span>
            <Icon name="star" size={20} className="text-amber-500 animate-pulse-subtle" />
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {sharedLedgerId ? `Shared Ledger: ${sharedLedgerId}` : 'Local-first offline ledger active'} · All calculations in integer minor units
          </p>
        </div>

        {/* Quick Action Buttons (Option A: Uniform Equal Height & Balanced Ergonomics) */}
        <div className="grid grid-cols-3 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onNavigate('credit')}
            className="btn-press flex-1 min-w-0 min-h-[52px] sm:min-h-0 sm:flex-none py-2 px-2 bg-primary-subtle text-primary border border-primary-border font-bold text-[11px] sm:text-xs rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 hover:bg-primary hover:text-white transition-all cursor-pointer text-center"
          >
            <Icon name="creditcard" size={17} strokeWidth={2} />
            <span className="truncate w-full text-center">Lent / Credit</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddExpense(true)}
            className="btn-press btn-glow flex-1 min-w-0 min-h-[52px] sm:min-h-0 sm:flex-none py-2 px-2 font-bold text-[11px] sm:text-xs rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 cursor-pointer text-center"
          >
            <Icon name="plus" size={17} strokeWidth={2.5} />
            <span className="truncate w-full text-center">Add Expense</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSettleFriendId(null)
              setSettleAmountMinor(0)
              setShowSettleUp(true)
            }}
            className="btn-press card-glow flex-1 min-w-0 min-h-[52px] sm:min-h-0 sm:flex-none py-2 px-2 text-[var(--color-text)] font-bold text-[11px] sm:text-xs rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 cursor-pointer text-center"
          >
            <Icon name="moneyHand" size={17} strokeWidth={2} />
            <span className="truncate w-full text-center">Settle Up</span>
          </button>
        </div>
      </div>

      {/* Top 3 Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Net Balance Hero Card (Redesigned with Ambient Glow) */}
        <div className="card-hero-glow rounded-3xl p-6 sm:p-7 text-white relative overflow-hidden card-interactive sm:col-span-2 lg:col-span-1">
          {/* Subtle decorative glow orb */}
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/[0.08] blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider uppercase text-white/75">
                Net Balance
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md border border-white/10 tracking-wider">
                {currentCurrency.code}
              </span>
            </div>

            <div className="my-1">
              <div className="font-money text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tighter leading-tight number-enter">
                {overall.netMinor > 0 ? '+' : overall.netMinor < 0 ? '\u2212' : ''}
                {formatMoney(Math.abs(overall.netMinor), currentCurrency)}
              </div>
              <p className="text-xs text-white/80 mt-1">
                {overall.netMinor > 0
                  ? 'Total amount friends owe you overall'
                  : overall.netMinor < 0
                  ? 'Total amount you owe to friends overall'
                  : 'You are completely settled with everyone!'}
              </p>
            </div>

            {/* Inline Owed/Owe indicators */}
            <div className="flex items-center gap-4 pt-3 border-t border-white/20 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-300 shrink-0" />
                <span className="text-white/70 text-[11px]">Owed:</span>
                <span className="font-money font-bold text-emerald-300">
                  +{formatMoney(overall.totalOwedToYouMinor, currentCurrency)}
                </span>
              </div>
              <span className="w-px h-3.5 bg-white/25" />
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-300 shrink-0" />
                <span className="text-white/70 text-[11px]">Owe:</span>
                <span className="font-money font-bold text-rose-300">
                  {overall.totalYouOweMinor > 0 ? '\u2212' : ''}
                  {formatMoney(overall.totalYouOweMinor, currentCurrency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Total Spending & Out of Pocket */}
        <div className="card-glow rounded-3xl p-6 card-interactive flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                You Paid Out
              </span>
              <div className="w-8 h-8 rounded-xl bg-primary-subtle text-primary border border-primary-border flex items-center justify-center shadow-xs">
                <Icon name="creditcard" size={18} />
              </div>
            </div>
            <div className="font-money text-2xl sm:text-3xl font-extrabold text-[var(--color-text)]">
              {formatMoney(totalSpentMinor, currentCurrency)}
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Total expenses where you were the initial payer
            </p>
          </div>

          <div className="pt-4 border-t border-[var(--color-border-subtle)] mt-4 flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">Ledger Activity</span>
            <span className="text-xs font-bold text-[var(--color-text)] font-money flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>
                {visibleExpensesCount}{' '}
                {visibleExpensesCount === 1 ? 'expense' : 'expenses'}
              </span>
            </span>
          </div>
        </div>

        {/* Card 3: Groups & Collaboration Status */}
        <div className="card-glow rounded-3xl p-6 card-interactive flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Your Circle
              </span>
              <div className="w-8 h-8 rounded-xl bg-primary-subtle text-primary border border-primary-border flex items-center justify-center shadow-xs">
                <Icon name="users" size={18} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-money text-2xl sm:text-3xl font-extrabold text-[var(--color-text)]">
                {ledgerState.groups.length}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-medium">
                groups · {ledgerState.people.filter((p) => p.id !== meId).length} friends
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              {ledgerState.groups.length === 0
                ? 'Create a trip, home, or event group to split together'
                : 'Active shared expense pools'}
            </p>
          </div>

          <div className="pt-4 border-t border-[var(--color-border-subtle)] mt-4 flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">Debt Simplification</span>
            <span className="text-xs font-bold text-primary bg-primary-subtle px-2 py-0.5 rounded-full border border-primary-border">
              ✓ Active (min-cash-flow)
            </span>
          </div>
        </div>
      </div>

      {/* Main Dual-Column Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Recent Activity & Group Summaries (Col 7) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Recent Activity Card */}
          <div className="card-base rounded-3xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
              <div>
                <h3 className="font-bold text-base text-[var(--color-text)]">
                  Recent Activity
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Latest expenses and settlements
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('activity')}
                className="text-xs font-bold text-primary hover:underline btn-press"
              >
                View all →
              </button>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center mx-auto text-[var(--color-text-muted)]">
                  <Icon name="receipt" size={24} />
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  No activity recorded yet in this ledger.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddExpense(true)}
                  className="btn-press btn-primary px-4 py-2 font-bold text-xs rounded-xl inline-flex items-center gap-1.5"
                >
                  <Icon name="plus" size={14} />
                  <span>Add First Expense</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-subtle)]">
                {recentTransactions.map((tx, idx) => (
                  <div
                    key={tx.id}
                    onClick={() => {
                      setSelectedActivityId(tx.id)
                      setSelectedActivityIsSettlement(tx.isSettlement)
                    }}
                    className="list-item-enter py-3.5 flex items-center justify-between gap-3 hover:bg-[var(--color-surface-subtle)] -mx-2 px-2.5 rounded-2xl transition-all cursor-pointer group hover:border hover:border-primary/20"
                    style={{ '--stagger-index': idx } as React.CSSProperties}
                    title="Click to view full split breakdown"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-10 h-10 rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                        <CategoryIcon category={tx.emoji} size={20} />
                      </div>
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-sm text-[var(--color-text)] group-hover:text-primary transition-colors truncate">
                            {tx.title}
                          </p>
                          <span className="text-[10px] text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">
                            · View Split →
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                          {store.isMe(tx.paidBy) ? 'You paid' : `${tx.paidByName} paid`} ·{' '}
                          {formatRelativeDate(tx.createdAtMicros)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center justify-end gap-1.5">
                        {tx.currency.code !== currentCurrency.code && (
                          <span className="currency-badge">{tx.currency.code}</span>
                        )}
                        <span
                          className={`font-money text-sm font-bold ${
                            store.isMe(tx.paidBy) ? 'text-owed' : 'text-owe'
                          }`}
                        >
                          {store.isMe(tx.paidBy) ? '+' : '\u2212'}
                          <MoneyDisplay
                            minor={tx.totalMinor}
                            currency={tx.currency}
                            size="sm"
                            showSign={false}
                            showColor={false}
                          />
                        </span>
                      </div>
                      <span className="block text-[10px] font-semibold text-[var(--color-text-muted)] mt-0.5">
                        {store.isMe(tx.paidBy) ? 'you lent' : 'you borrowed'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Groups Showcase (Redesigned Empty & Populated States) */}
          <div className="card-base rounded-3xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
              <div>
                <h3 className="font-bold text-base text-[var(--color-text)]">
                  Your Groups ({ledgerState.groups.length})
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Trips, households, and shared pools
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('groups')}
                className="text-xs font-bold text-primary hover:underline btn-press"
              >
                Manage groups →
              </button>
            </div>

            {ledgerState.groups.length === 0 ? (
              /* Enhanced Empty State: overlapping emoji avatars & suggestion chips */
              <div className="py-10 flex flex-col items-center text-center space-y-4">
                <div className="relative w-24 h-12 my-1">
                  <div className="absolute left-0 w-11 h-11 rounded-2xl bg-[var(--color-primary-subtle)] border-2 border-[var(--color-surface)] flex items-center justify-center text-xl shadow-sm">
                    🏠
                  </div>
                  <div className="absolute left-7 w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border-2 border-[var(--color-surface)] flex items-center justify-center text-xl shadow-sm z-10">
                    ✈️
                  </div>
                  <div className="absolute left-14 w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border-2 border-[var(--color-surface)] flex items-center justify-center text-xl shadow-sm z-20">
                    🍕
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-[var(--color-text)]">
                    Split with your crew
                  </h4>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-xs mx-auto leading-relaxed">
                    Create a shared pool for a vacation, household, or dinner to split expenses seamlessly.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCreateGroup(true)}
                  className="btn-press btn-primary px-5 py-2.5 font-bold text-xs rounded-xl shadow-md inline-flex items-center gap-1.5"
                >
                  <Icon name="plus" size={15} />
                  <span>Create Group</span>
                </button>

                {/* Quick-start suggestion chips */}
                <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                  {[
                    { label: '🏠 Apartment', defaultName: 'Apartment Expenses' },
                    { label: '✈️ Trip', defaultName: 'Weekend Trip' },
                    { label: '🍕 Dinner', defaultName: 'Friday Dinner' },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => setShowCreateGroup(true)}
                      className="btn-press text-[11px] font-semibold px-3 py-1 rounded-full bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-primary hover:border-primary-border transition-colors"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                {ledgerState.groups.map((group) => {
                  const kind = GroupKindInfo[group.kind]
                  const groupExpensesCount = ledgerState.expenses.filter(
                    (e) => !e.isTombstone && e.groupId === group.id && isExpenseParticipant(e, meId, store.isMe)
                  ).length
                  const totalGroupSpendMinor = ledgerState.expenses
                    .filter((e) => !e.isTombstone && e.groupId === group.id && isExpenseParticipant(e, meId, store.isMe))
                    .reduce((acc, e) => acc + e.totalMinor, 0)

                  return (
                    <div
                      key={group.id}
                      onClick={() => onSelectGroup(group.id)}
                      className="p-4 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border-subtle)] border border-[var(--color-border)] rounded-2xl cursor-pointer transition-all card-interactive"
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-9 h-9 rounded-xl bg-primary-subtle text-primary flex items-center justify-center">
                          <CategoryIcon category={kind.emoji} size={20} />
                        </div>
                        <span className="currency-badge">
                          {group.currency.code}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-[var(--color-text)] mt-2.5 truncate">
                        {group.name}
                      </h4>
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                        {group.memberIds.length} members · {groupExpensesCount} expenses
                      </p>
                      <div className="mt-3 pt-2 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs">
                        <span className="text-[11px] text-[var(--color-text-muted)]">Total Pool</span>
                        <span className="font-money font-extrabold text-[var(--color-text)]">
                          {formatMoney(totalGroupSpendMinor, group.currency)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Friends Balances & Smart Settle (Col 5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Friends Balances Card */}
          <div className="card-base rounded-3xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
              <div>
                <h3 className="font-bold text-base text-[var(--color-text)]">
                  Friends ({ledgerState.people.filter((p) => p.id !== meId).length})
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Who owes who with source chips
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('friends')}
                className="text-xs font-bold text-primary hover:underline btn-press"
              >
                All friends →
              </button>
            </div>

            {friendsWithBalances.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center mx-auto text-[var(--color-text-muted)]">
                  <Icon name="users" size={24} />
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  No friends added yet.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('friends')}
                  className="btn-press btn-primary px-3.5 py-1.5 font-bold text-xs rounded-xl shadow-sm inline-flex items-center gap-1.5"
                >
                  <Icon name="plus" size={14} />
                  <span>Add Friend</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-subtle)]">
                {friendsWithBalances.map(({ friend, breakdown }, idx) => (
                  <div
                    key={friend.id}
                    className="list-item-enter py-3.5 space-y-2 group"
                    style={{ '--stagger-index': idx } as React.CSSProperties}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className="flex items-center gap-2.5 overflow-hidden cursor-pointer hover:opacity-85 transition-opacity"
                        onClick={() => setSelectedFriendDetail(friend)}
                        title={`View groupwise & individual split details with ${friend.name}`}
                      >
                        {/* Clear, readable avatar with primary subtle theme */}
                        <div className="w-9 h-9 rounded-full bg-primary-subtle text-primary border border-primary-border font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                          {personInitials(friend.name)}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-semibold text-sm text-[var(--color-text)] truncate">
                            {friend.name}
                          </p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">
                            {breakdown.netMinor === 0
                              ? 'Square / Settled'
                              : breakdown.theyOweYou
                              ? 'Owes you'
                              : 'You owe'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <MoneyDisplay
                          minor={breakdown.netMinor}
                          currency={currentCurrency}
                          size="sm"
                          showSign={true}
                        />
                        {breakdown.netMinor !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleQuickSettle(friend.id, breakdown.netMinor)}
                            className="btn-press px-2.5 py-1 btn-primary font-bold text-[11px] rounded-lg shadow-sm"
                          >
                            Settle
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Source Chips Decomposition (SE-12) */}
                    {breakdown.slices.length > 0 && (
                      <div className="pl-11">
                        <SourceChips
                          slices={breakdown.slices}
                          groups={ledgerState.groups}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Smart Debt Simplification Info Card */}
          <div className="p-5 bg-primary-subtle border border-primary-border rounded-3xl space-y-2.5">
            <div className="flex items-center gap-2">
              <Icon name="lightning" size={18} className="text-primary" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-primary">
                Deterministic Settle Optimization
              </h4>
            </div>
            <p className="text-xs text-[var(--color-text)] opacity-90 leading-relaxed">
              When multiple members spend in a group, SplitPay automatically condenses debts using a greedy min-cash-flow algorithm so you settle in the fewest possible payments.
            </p>
          </div>
        </div>
      </div>

      {/* Sub-modals for Expense & Settle */}
      <ExpenseEditorModal
        isOpen={showAddExpense}
        onClose={() => setShowAddExpense(false)}
      />

      <SettleUpModal
        isOpen={showSettleUp}
        onClose={() => setShowSettleUp(false)}
        initialFriendId={settleFriendId}
        initialAmountMinor={settleAmountMinor}
      />

      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={(groupId) => onSelectGroup(groupId)}
      />

      {/* Activity Split Breakdown Modal */}
      <ActivityDetailModal
        isOpen={Boolean(selectedActivityId)}
        onClose={() => setSelectedActivityId(null)}
        itemId={selectedActivityId}
        isSettlement={selectedActivityIsSettlement}
        onEditExpense={(exp) => setEditingExpense(exp)}
        onSettleUp={(fId, amount) => handleQuickSettle(fId, amount)}
      />

      {/* Friend Groupwise & Individual Breakdown Modal */}
      <FriendDetailModal
        isOpen={Boolean(selectedFriendDetail)}
        onClose={() => setSelectedFriendDetail(null)}
        friend={selectedFriendDetail}
        onOpenSettleUp={(fId, amount) => handleQuickSettle(fId, amount)}
        onNavigateToStatement={(fId) => onSelectFriend(fId)}
        onSelectActivity={(actId, isSet) => {
          setSelectedActivityId(actId)
          setSelectedActivityIsSettlement(isSet)
        }}
      />

      {/* Edit Expense Modal */}
      <ExpenseEditorModal
        isOpen={Boolean(editingExpense)}
        onClose={() => setEditingExpense(null)}
        expenseToEdit={editingExpense}
      />
    </div>
  )
}
