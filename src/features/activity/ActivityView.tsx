import React, { useState } from 'react'
import { useStore } from '../../ui/storeContext'
import { MoneyDisplay } from '../../ui/components/MoneyDisplay'
import { BASE_CURRENCY } from '../../domain/entities'

export const ActivityView: React.FC = () => {
  const { store, ledgerState } = useStore()
  const me = store.me
  const meId = me?.id || ''

  const [filter, setFilter] = useState<'all' | 'expenses' | 'settlements'>('all')

  const peopleMap = new Map(ledgerState.people.map((p) => [p.id, p]))

  const allItems = [
    ...ledgerState.expenses.map((e) => ({
      id: e.id,
      title: e.description,
      amountMinor: e.totalMinor,
      currency: e.currency,
      date: new Date(Math.floor(e.createdAtMicros / 1000)),
      emoji: e.categoryEmoji,
      isSettlement: false,
      isTombstone: e.isTombstone,
      paidByName: e.paidBy === meId ? 'You' : peopleMap.get(e.paidBy)?.name || 'Unknown',
      payerId: e.paidBy,
    })),
    ...ledgerState.settlements.map((s) => ({
      id: s.id,
      title: s.note ? `Payment: ${s.note}` : 'Settlement payment',
      amountMinor: s.amountMinor,
      currency: s.currency,
      date: new Date(Math.floor(s.createdAtMicros / 1000)),
      emoji: '🤝',
      isSettlement: true,
      isTombstone: false,
      paidByName: s.from === meId ? 'You' : peopleMap.get(s.from)?.name || 'Unknown',
      payerId: s.from,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  const filteredItems = allItems.filter((item) => {
    if (filter === 'expenses') return !item.isSettlement
    if (filter === 'settlements') return item.isSettlement
    return true
  })

  const handleDeleteExpense = async (id: string) => {
    if (confirm('Are you sure you want to delete this expense? (This can be undone)')) {
      await store.deleteExpense(id)
    }
  }

  const handleRestoreExpense = async (id: string) => {
    await store.restoreExpense(id)
  }

  return (
    <div className="space-y-4">
      {/* Header and Filter pills */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-[var(--color-text)]">
          Activity Feed ({filteredItems.length})
        </h2>
        <div className="flex gap-1 p-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter('expenses')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
              filter === 'expenses'
                ? 'bg-indigo-600 text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Expenses
          </button>
          <button
            type="button"
            onClick={() => setFilter('settlements')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
              filter === 'settlements'
                ? 'bg-indigo-600 text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Payments
          </button>
        </div>
      </div>

      {/* Activity Timeline List */}
      {filteredItems.length === 0 ? (
        <div className="p-8 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
          <p className="text-sm text-[var(--color-text-muted)]">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl flex items-center justify-between gap-3 shadow-sm transition-all ${
                item.isTombstone ? 'opacity-60 bg-[var(--color-surface-subtle)]' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h4
                      className={`font-semibold text-sm text-[var(--color-text)] ${
                        item.isTombstone ? 'line-through' : ''
                      }`}
                    >
                      {item.title}
                    </h4>
                    {item.isTombstone && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400">
                        Deleted
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    Paid by {item.paidByName} ·{' '}
                    {item.date.toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <MoneyDisplay
                    minor={item.amountMinor}
                    currency={item.currency || BASE_CURRENCY}
                    size="sm"
                    showSign={false}
                    showColor={false}
                  />
                </div>

                {!item.isSettlement && (
                  <div>
                    {item.isTombstone ? (
                      <button
                        type="button"
                        onClick={() => handleRestoreExpense(item.id)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(item.id)}
                        className="p-1 text-xs text-[var(--color-text-muted)] hover:text-rose-600 transition-colors"
                        title="Delete expense"
                        aria-label="Delete expense"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
