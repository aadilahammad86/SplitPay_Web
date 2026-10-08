import React, { useState, useMemo } from 'react'
import { useStore } from '../../ui/storeContext'
import { MoneyDisplay } from '../../ui/components/MoneyDisplay'
import { BASE_CURRENCY } from '../../domain/entities'

export const ActivityView: React.FC = () => {
  const { store, ledgerState } = useStore()
  const me = store.me
  const meId = me?.id || ''

  const [filter, setFilter] = useState<'all' | 'expenses' | 'settlements'>('all')

  const peopleMap = useMemo(
    () => new Map(ledgerState.people.map((p) => [p.id, p])),
    [ledgerState.people]
  )

  const allItems = useMemo(() => {
    return [
      ...ledgerState.expenses.map((e) => ({
        id: e.id,
        title: e.description,
        amountMinor: e.totalMinor,
        currency: e.currency,
        createdAtMicros: e.createdAtMicros,
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
        createdAtMicros: s.createdAtMicros,
        emoji: '🤝',
        isSettlement: true,
        isTombstone: false,
        paidByName: s.from === meId ? 'You' : peopleMap.get(s.from)?.name || 'Unknown',
        payerId: s.from,
      })),
    ].sort((a, b) => b.createdAtMicros - a.createdAtMicros)
  }, [ledgerState.expenses, ledgerState.settlements, meId, peopleMap])

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (filter === 'expenses') return !item.isSettlement
      if (filter === 'settlements') return item.isSettlement
      return true
    })
  }, [allItems, filter])

  const handleDeleteExpense = async (id: string) => {
    if (confirm('Are you sure you want to delete this expense? (This can be undone)')) {
      await store.deleteExpense(id)
    }
  }

  const handleRestoreExpense = async (id: string) => {
    await store.restoreExpense(id)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header and Filter pills */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--color-text)] tracking-tight">
            Activity Timeline ({filteredItems.length})
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Audit trail of all expenses, splits, and settlement payments
          </p>
        </div>

        <div className="flex gap-1 p-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs self-start sm:self-auto shadow-sm">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            All ({allItems.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('expenses')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filter === 'expenses'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Expenses
          </button>
          <button
            type="button"
            onClick={() => setFilter('settlements')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filter === 'settlements'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Payments
          </button>
        </div>
      </div>

      {/* Activity Timeline List */}
      {filteredItems.length === 0 ? (
        <div className="p-10 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-3xl mx-auto shadow-sm">
            🧾
          </div>
          <h3 className="font-bold text-base text-[var(--color-text)]">No activity recorded yet</h3>
          <p className="text-xs text-[var(--color-text-muted)] max-w-sm mx-auto">
            Transactions and settlement payments will appear here in reverse chronological order.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-all ${
                item.isTombstone ? 'opacity-50 bg-[var(--color-surface-subtle)]' : 'card-hover'
              }`}
            >
              <div className="flex items-center gap-3.5 overflow-hidden">
                <div className="w-11 h-11 rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-xl shrink-0">
                  {item.emoji}
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2">
                    <h4
                      className={`font-bold text-xs sm:text-sm text-[var(--color-text)] truncate ${
                        item.isTombstone ? 'line-through text-rose-500' : ''
                      }`}
                    >
                      {item.title}
                    </h4>
                    {item.isTombstone && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0">
                        Deleted
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--color-text-muted)] block truncate">
                    Paid by {item.paidByName} ·{' '}
                    {new Date(Math.floor(item.createdAtMicros / 1000)).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <MoneyDisplay
                    minor={item.amountMinor}
                    currency={item.currency || BASE_CURRENCY}
                    size="sm"
                    showSign={false}
                    showColor={false}
                  />
                  <span className="block text-[10px] text-[var(--color-text-muted)] font-medium">
                    {item.isSettlement ? 'settled' : 'total'}
                  </span>
                </div>

                {!item.isSettlement && (
                  <div>
                    {item.isTombstone ? (
                      <button
                        type="button"
                        onClick={() => handleRestoreExpense(item.id)}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(item.id)}
                        className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-sm"
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
