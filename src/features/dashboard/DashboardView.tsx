import React, { useState } from 'react'
import { useStore } from '../../ui/storeContext'
import { calculateOverallBalance, breakdownFor } from '../../domain/balance'
import { MoneyDisplay } from '../../ui/components/MoneyDisplay'
import { SourceChips } from '../../ui/components/SourceChips'
import { BASE_CURRENCY, GroupKindInfo, personInitials } from '../../domain/entities'
import { ExpenseEditorModal } from '../expense/ExpenseEditorModal'
import { SettleUpModal } from '../settle/SettleUpModal'

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
  const { store, ledgerState } = useStore()
  const me = store.me

  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showSettleUp, setShowSettleUp] = useState(false)

  const meId = me?.id || ''
  const friendIds = ledgerState.people.filter((p) => p.id !== meId).map((p) => p.id)

  const overall = calculateOverallBalance({
    me: meId,
    friendIds,
    expenses: ledgerState.expenses,
    settlements: ledgerState.settlements,
  })

  // Recent 6 transactions (expenses + settlements)
  const recentTransactions = [
    ...ledgerState.expenses.filter((e) => !e.isTombstone).map((e) => ({
      id: e.id,
      title: e.description,
      amountMinor: e.totalMinor,
      currency: e.currency,
      date: new Date(Math.floor(e.createdAtMicros / 1000)),
      emoji: e.categoryEmoji,
      isSettlement: false,
    })),
    ...ledgerState.settlements.map((s) => ({
      id: s.id,
      title: s.note ? `Payment: ${s.note}` : 'Payment recorded',
      amountMinor: s.amountMinor,
      currency: s.currency,
      date: new Date(Math.floor(s.createdAtMicros / 1000)),
      emoji: '🤝',
      isSettlement: true,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Balance Summary Header */}
      <section className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div>
            <span className="text-xs font-semibold tracking-wider uppercase text-indigo-200">
              Total Net Balance
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                {overall.netMinor > 0 ? '+' : overall.netMinor < 0 ? '-' : ''}
                {BASE_CURRENCY.symbol}
                {(Math.abs(overall.netMinor) / 100).toFixed(2)}
              </span>
              <span className="text-xs font-medium text-indigo-200">
                {overall.netMinor > 0 ? 'owed to you' : overall.netMinor < 0 ? 'you owe' : 'all settled'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-indigo-500/40">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3">
              <span className="block text-[11px] font-medium text-indigo-200">You are owed</span>
              <span className="text-lg font-bold text-emerald-300">
                +{BASE_CURRENCY.symbol}{(overall.totalOwedToYouMinor / 100).toFixed(2)}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3">
              <span className="block text-[11px] font-medium text-indigo-200">You owe</span>
              <span className="text-lg font-bold text-rose-300">
                -{BASE_CURRENCY.symbol}{(overall.totalYouOweMinor / 100).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setShowAddExpense(true)}
              className="flex-1 py-3 px-4 bg-white text-indigo-700 hover:bg-indigo-50 font-bold rounded-2xl shadow-md text-sm transition-all text-center flex items-center justify-center gap-1.5"
            >
              <span>+</span>
              <span>Add Expense</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSettleUp(true)}
              className="flex-1 py-3 px-4 bg-indigo-500/40 hover:bg-indigo-500/60 border border-white/20 text-white font-bold rounded-2xl text-sm transition-all text-center flex items-center justify-center gap-1.5"
            >
              <span>🤝</span>
              <span>Settle Up</span>
            </button>
          </div>
        </div>
      </section>

      {/* Friends Balance Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--color-text)]">Friends & Balances</h2>
          <button
            type="button"
            onClick={() => onNavigate('friends')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            View all ({friendIds.length})
          </button>
        </div>

        {friendIds.length === 0 ? (
          <div className="p-6 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
            <p className="text-sm text-[var(--color-text-muted)]">No friends added yet.</p>
            <button
              type="button"
              onClick={() => onNavigate('friends')}
              className="mt-3 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-indigo-700 transition-colors"
            >
              + Add a Friend
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {friendIds.slice(0, 4).map((fId) => {
              const friend = ledgerState.people.find((p) => p.id === fId)
              if (!friend) return null

              const breakdown = breakdownFor({
                me: meId,
                friend: fId,
                expenses: ledgerState.expenses,
                settlements: ledgerState.settlements,
              })

              return (
                <div
                  key={fId}
                  onClick={() => onSelectFriend(fId)}
                  className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-indigo-500/50 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-sm">
                        {personInitials(friend.name)}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-[var(--color-text)]">{friend.name}</h3>
                        {friend.handle && (
                          <span className="text-[11px] text-[var(--color-text-muted)]">
                            @{friend.handle}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <MoneyDisplay
                        minor={breakdown.netMinor}
                        currency={BASE_CURRENCY}
                        size="md"
                        showSign={true}
                      />
                      <span className="block text-[10px] text-[var(--color-text-muted)]">
                        {breakdown.netMinor > 0 ? 'owes you' : breakdown.netMinor < 0 ? 'you owe' : 'settled'}
                      </span>
                    </div>
                  </div>

                  {/* Cross-context source chips breakdown */}
                  <SourceChips
                    slices={breakdown.slices}
                    groups={ledgerState.groups}
                  />
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Groups Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--color-text)]">Groups</h2>
          <button
            type="button"
            onClick={() => onNavigate('groups')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            View all ({ledgerState.groups.length})
          </button>
        </div>

        {ledgerState.groups.length === 0 ? (
          <div className="p-6 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
            <p className="text-sm text-[var(--color-text-muted)]">No active groups yet.</p>
            <button
              type="button"
              onClick={() => onNavigate('groups')}
              className="mt-3 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-indigo-700 transition-colors"
            >
              + Create a Group
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ledgerState.groups.slice(0, 4).map((group) => {
              const info = GroupKindInfo[group.kind]
              return (
                <div
                  key={group.id}
                  onClick={() => onSelectGroup(group.id)}
                  className="p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-indigo-500/50 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  <span className="text-2xl mb-1.5 block">{info.emoji}</span>
                  <h3 className="font-bold text-sm text-[var(--color-text)] truncate">{group.name}</h3>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    {group.memberIds.length} members · {group.currency.code}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Recent Activity Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--color-text)]">Recent Activity</h2>
          <button
            type="button"
            onClick={() => onNavigate('activity')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            View full history
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-6 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
            <p className="text-sm text-[var(--color-text-muted)]">No expenses or payments recorded yet.</p>
          </div>
        ) : (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl divide-y divide-[var(--color-border)] overflow-hidden shadow-sm">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="p-3.5 flex items-center justify-between hover:bg-[var(--color-surface-subtle)] transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{tx.emoji}</span>
                  <div>
                    <h4 className="font-semibold text-sm text-[var(--color-text)]">{tx.title}</h4>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      {tx.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
                <MoneyDisplay
                  minor={tx.amountMinor}
                  currency={tx.currency}
                  showSign={false}
                  showColor={false}
                  size="sm"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modals */}
      <ExpenseEditorModal
        isOpen={showAddExpense}
        onClose={() => setShowAddExpense(false)}
      />
      <SettleUpModal
        isOpen={showSettleUp}
        onClose={() => setShowSettleUp(false)}
      />
    </div>
  )
}
