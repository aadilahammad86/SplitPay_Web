import React, { useState } from 'react'
import { useStore } from '../../ui/storeContext'
import { calculateOverallBalance, breakdownFor } from '../../domain/balance'
import { MoneyDisplay } from '../../ui/components/MoneyDisplay'
import { SourceChips } from '../../ui/components/SourceChips'
import { BASE_CURRENCY, GroupKindInfo, personInitials } from '../../domain/entities'
import { ExpenseEditorModal } from '../expense/ExpenseEditorModal'
import { SettleUpModal } from '../settle/SettleUpModal'
import { CreateGroupModal } from '../groups/CreateGroupModal'
import { Icon, CategoryIcon } from '../../ui/components/Icon'

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

  const friendIds = ledgerState.people.filter((p) => p.id !== meId).map((p) => p.id)

  const overall = calculateOverallBalance({
    me: meId,
    friendIds,
    expenses: ledgerState.expenses,
    settlements: ledgerState.settlements,
  })

  // Calculate total spending this month
  const totalSpentMinor = ledgerState.expenses
    .filter((e) => !e.isTombstone && e.paidBy === meId)
    .reduce((sum, e) => sum + e.totalMinor, 0)

  // Recent transactions (expenses + settlements combined, reverse chronological)
  const recentTransactions = [
    ...ledgerState.expenses.filter((e) => !e.isTombstone).map((e) => ({
      id: e.id,
      title: e.description,
      totalMinor: e.totalMinor,
      currency: e.currency,
      paidBy: e.paidBy,
      paidByName: ledgerState.people.find((p) => p.id === e.paidBy)?.name || 'Someone',
      myShareMinor: e.shares.find((s) => s.owedBy === meId)?.amountMinor || 0,
      createdAtMicros: e.createdAtMicros,
      emoji: e.categoryEmoji || '🧾',
      isSettlement: false,
      groupId: e.groupId,
    })),
    ...ledgerState.settlements.map((s) => ({
      id: s.id,
      title: s.note ? `Payment: ${s.note}` : 'Payment recorded',
      totalMinor: s.amountMinor,
      currency: s.currency,
      paidBy: s.from,
      paidByName: ledgerState.people.find((p) => p.id === s.from)?.name || 'Someone',
      myShareMinor: 0,
      createdAtMicros: s.createdAtMicros,
      emoji: '🤝',
      isSettlement: true,
      groupId: s.groupId,
    })),
  ].sort((a, b) => b.createdAtMicros - a.createdAtMicros).slice(0, 6)

  // Friends breakdown with non-zero balances
  const friendsWithBalances = ledgerState.people
    .filter((p) => p.id !== meId)
    .map((friend) => {
      const breakdown = breakdownFor({
        me: meId,
        friend: friend.id,
        expenses: ledgerState.expenses,
        settlements: ledgerState.settlements,
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
            <Icon name="star" size={22} className="text-amber-500 animate-pulse" />
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {sharedLedgerId ? `Shared Ledger: ${sharedLedgerId}` : 'Local-first offline ledger active'} · All calculations verified in integer minor units
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddExpense(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Icon name="plus" size={16} />
            <span>Add Expense</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSettleFriendId(null)
              setSettleAmountMinor(0)
              setShowSettleUp(true)
            }}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)] text-[var(--color-text)] border border-[var(--color-border)] font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Icon name="moneyHand" size={16} />
            <span>Settle Up</span>
          </button>
        </div>
      </div>

      {/* Top 3 Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Net Balance Hero Card */}
        <div className="hero-gradient rounded-3xl p-6 text-white shadow-xl relative overflow-hidden card-hover sm:col-span-2 lg:col-span-1">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider uppercase text-white/80">
                Your Net Balance
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm">
                {overall.netMinor > 0 ? 'In Credit' : overall.netMinor < 0 ? 'In Debt' : 'Settled'}
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                  {overall.netMinor > 0 ? '+' : overall.netMinor < 0 ? '-' : ''}
                  {BASE_CURRENCY.symbol}
                  {(Math.abs(overall.netMinor) / 100).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-white/80 mt-1">
                {overall.netMinor > 0
                  ? 'Total amount friends owe you overall'
                  : overall.netMinor < 0
                  ? 'Total amount you owe to friends overall'
                  : 'You are completely settled with everyone!'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/20 text-xs">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5">
                <span className="block text-[10px] text-white/80">You are owed</span>
                <span className="text-sm font-extrabold text-emerald-300">
                  +{BASE_CURRENCY.symbol}{(overall.totalOwedToYouMinor / 100).toFixed(2)}
                </span>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5">
                <span className="block text-[10px] text-white/80">You owe</span>
                <span className="text-sm font-extrabold text-rose-300">
                  -{BASE_CURRENCY.symbol}{(overall.totalYouOweMinor / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Total Spending & Out of Pocket */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm card-hover flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                You Paid Out
              </span>
              <Icon name="creditcard" size={22} className="text-primary" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text)]">
              {BASE_CURRENCY.symbol}{(totalSpentMinor / 100).toFixed(2)}
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Total expenses where you were the initial payer
            </p>
          </div>

          <div className="pt-4 border-t border-[var(--color-border)] mt-4">
            <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mb-1.5">
              <span>Ledger Activity</span>
              <span className="font-bold text-[var(--color-text)]">
                {ledgerState.expenses.filter((e) => !e.isTombstone).length} expenses
              </span>
            </div>
            <div className="w-full bg-[var(--color-surface-subtle)] h-2 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(15, (ledgerState.expenses.filter((e) => !e.isTombstone).length / 20) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Groups & Collaboration Status */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm card-hover flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Your Circle
              </span>
              <Icon name="users" size={22} className="text-primary" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text)]">
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

          <div className="pt-4 border-t border-[var(--color-border)] mt-4 flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">Debt Simplification</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
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
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-6 shadow-sm">
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
                className="text-xs font-bold text-primary hover:underline"
              >
                View all →
              </button>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <Icon name="receipt" size={40} className="mx-auto text-[var(--color-text-muted)] opacity-60" />
                <p className="text-xs text-[var(--color-text-muted)]">
                  No activity recorded yet in this ledger.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddExpense(true)}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-1.5"
                >
                  <Icon name="plus" size={14} />
                  <span>Add First Expense</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="py-3.5 flex items-center justify-between gap-3 hover:bg-[var(--color-surface-subtle)] -mx-2 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-10 h-10 rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-primary shrink-0">
                        <CategoryIcon category={tx.emoji} size={20} />
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-bold text-xs text-[var(--color-text)] truncate">
                          {tx.title}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                          {tx.paidBy === meId ? 'You paid' : `${tx.paidByName} paid`} ·{' '}
                          {new Date(Math.floor(tx.createdAtMicros / 1000)).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <MoneyDisplay
                        minor={tx.totalMinor}
                        currency={tx.currency}
                        size="sm"
                        showSign={false}
                      />
                      {tx.paidBy === meId ? (
                        <span className="block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          you lent
                        </span>
                      ) : (
                        <span className="block text-[10px] font-semibold text-rose-500 dark:text-rose-400">
                          you borrowed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Groups Showcase */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-6 shadow-sm">
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
                className="text-xs font-bold text-primary hover:underline"
              >
                Manage groups →
              </button>
            </div>

            {ledgerState.groups.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-primary-subtle text-primary border border-primary-border flex items-center justify-center mx-auto shadow-sm">
                  <Icon name="users" size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[var(--color-text)]">
                    No groups created yet
                  </h4>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 max-w-xs mx-auto">
                    Create a shared pool for a vacation, household, or dinner to split with multiple people.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(true)}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all inline-flex items-center gap-1.5 active:scale-95"
                >
                  <Icon name="plus" size={14} />
                  <span>Create Group</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                {ledgerState.groups.map((group) => {
                  const kind = GroupKindInfo[group.kind]
                  const groupExpensesCount = ledgerState.expenses.filter(
                    (e) => !e.isTombstone && e.groupId === group.id
                  ).length
                  const totalGroupSpendMinor = ledgerState.expenses
                    .filter((e) => !e.isTombstone && e.groupId === group.id)
                    .reduce((acc, e) => acc + e.totalMinor, 0)

                  return (
                    <div
                      key={group.id}
                      onClick={() => onSelectGroup(group.id)}
                      className="p-4 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] border border-[var(--color-border)] rounded-2xl cursor-pointer transition-all card-hover"
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-9 h-9 rounded-xl bg-primary-subtle text-primary flex items-center justify-center">
                          <CategoryIcon category={kind.emoji} size={20} />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                          {group.currency.code}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-[var(--color-text)] mt-2 truncate">
                        {group.name}
                      </h4>
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                        {group.memberIds.length} members · {groupExpensesCount} expenses
                      </p>
                      <div className="mt-3 pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-xs">
                        <span className="text-[11px] text-[var(--color-text-muted)]">Total Pool</span>
                        <span className="font-extrabold text-[var(--color-text)]">
                          {group.currency.symbol}{(totalGroupSpendMinor / group.currency.scale).toFixed(2)}
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
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-6 shadow-sm">
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
                className="text-xs font-bold text-primary hover:underline"
              >
                All friends →
              </button>
            </div>

            {friendsWithBalances.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Icon name="users" size={36} className="mx-auto text-[var(--color-text-muted)] opacity-60" />
                <p className="text-xs text-[var(--color-text-muted)]">
                  No friends added yet.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('friends')}
                  className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5"
                >
                  <Icon name="plus" size={14} />
                  <span>Add Friend</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {friendsWithBalances.map(({ friend, breakdown }) => (
                  <div key={friend.id} className="py-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className="flex items-center gap-2.5 overflow-hidden cursor-pointer hover:opacity-85 transition-opacity"
                        onClick={() => onSelectFriend(friend.id)}
                        title={`View statement with ${friend.name}`}
                      >
                        <div className="w-8 h-8 rounded-full hero-gradient text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                          {personInitials(friend.name)}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-bold text-xs text-[var(--color-text)] truncate">
                            {friend.name}
                          </p>
                          <p className="text-[10px] text-[var(--color-text-muted)]">
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
                          currency={BASE_CURRENCY}
                          size="sm"
                          showSign={true}
                        />
                        {breakdown.netMinor !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleQuickSettle(friend.id, breakdown.netMinor)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-sm transition-all active:scale-95"
                          >
                            Settle
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Source Chips Decomposition (SE-12) */}
                    {breakdown.slices.length > 0 && (
                      <div className="pl-10">
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
      {showAddExpense && (
        <ExpenseEditorModal
          isOpen={showAddExpense}
          onClose={() => setShowAddExpense(false)}
        />
      )}

      {showSettleUp && (
        <SettleUpModal
          isOpen={showSettleUp}
          onClose={() => setShowSettleUp(false)}
          initialFriendId={settleFriendId}
          initialAmountMinor={settleAmountMinor}
        />
      )}

      {showCreateGroup && (
        <CreateGroupModal
          isOpen={showCreateGroup}
          onClose={() => setShowCreateGroup(false)}
          onCreated={(groupId) => onSelectGroup(groupId)}
        />
      )}
    </div>
  )
}
