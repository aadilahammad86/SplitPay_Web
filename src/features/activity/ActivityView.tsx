import React, { useState, useMemo } from 'react'
import { useStore } from '../../ui/storeContext'
import { MoneyDisplay } from '../../ui/components/MoneyDisplay'
import { BASE_CURRENCY } from '../../domain/entities'
import { Icon, CategoryIcon } from '../../ui/components/Icon'

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

  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())

  const handleToggleSelect = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedItemIds.size === filteredItems.length) {
      setSelectedItemIds(new Set())
    } else {
      setSelectedItemIds(new Set(filteredItems.map((item) => item.id)))
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (confirm('Are you sure you want to delete this expense? (This can be undone)')) {
      await store.deleteExpense(id)
    }
  }

  const handleDeleteSettlement = async (id: string) => {
    if (confirm('Are you sure you want to delete this settlement payment record?')) {
      await store.deleteSettlement(id)
    }
  }

  const handleRestoreExpense = async (id: string) => {
    await store.restoreExpense(id)
  }

  const handleClearSelected = async () => {
    if (selectedItemIds.size === 0) return
    if (confirm(`Are you sure you want to delete/clear ${selectedItemIds.size} selected item(s)?`)) {
      const selectedList = allItems.filter((i) => selectedItemIds.has(i.id))
      const expIds = selectedList.filter((i) => !i.isSettlement).map((i) => i.id)
      const setIds = selectedList.filter((i) => i.isSettlement).map((i) => i.id)

      if (expIds.length > 0) await store.deleteExpenses(expIds)
      if (setIds.length > 0) await store.deleteSettlements(setIds)

      setSelectedItemIds(new Set())
      setIsSelectMode(false)
    }
  }

  const handleClearAllActivity = async () => {
    if (allItems.length === 0) return
    if (confirm('Are you sure you want to clear all expenses and settlements? This will reset your active timeline.')) {
      await store.clearExpensesAndSettlements()
      setSelectedItemIds(new Set())
      setIsSelectMode(false)
    }
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

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <div className="flex gap-1 p-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs shadow-sm">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              All ({allItems.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('expenses')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filter === 'expenses'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              Expenses
            </button>
            <button
              type="button"
              onClick={() => setFilter('settlements')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filter === 'settlements'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              Payments
            </button>
          </div>

          {allItems.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsSelectMode(!isSelectMode)
                  setSelectedItemIds(new Set())
                }}
                className={`px-3 py-2 font-bold text-xs rounded-xl border transition-all flex items-center gap-1.5 active:scale-95 shrink-0 cursor-pointer ${
                  isSelectMode
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-border)]'
                }`}
              >
                <Icon name="check" size={14} />
                <span>{isSelectMode ? 'Done' : 'Select'}</span>
              </button>

              <button
                type="button"
                onClick={handleClearAllActivity}
                className="px-2.5 py-2 font-bold text-xs rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                title="Clear all activity transactions"
              >
                <Icon name="delete" size={14} />
                <span className="hidden sm:inline">Clear All</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Batch Action Toolbar */}
      {isSelectMode && (
        <div className="p-3 bg-[var(--color-surface)] border-2 border-primary/40 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <span>{selectedItemIds.size === filteredItems.length && filteredItems.length > 0 ? 'Deselect All' : 'Select All'}</span>
            </button>
            <span className="text-xs text-[var(--color-text-muted)] font-semibold">
              {selectedItemIds.size} of {filteredItems.length} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={selectedItemIds.size === 0}
              onClick={handleClearSelected}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Icon name="delete" size={14} />
              <span>Clear Selected ({selectedItemIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Activity Timeline List */}
      {filteredItems.length === 0 ? (
        <div className="p-10 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-primary-subtle text-primary flex items-center justify-center text-3xl mx-auto shadow-sm">
            <Icon name="receipt" size={32} />
          </div>
          <h3 className="font-bold text-base text-[var(--color-text)]">No activity recorded yet</h3>
          <p className="text-xs text-[var(--color-text-muted)] max-w-sm mx-auto">
            Transactions and settlement payments will appear here in reverse chronological order.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isSelected = selectedItemIds.has(item.id)

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isSelectMode) {
                    handleToggleSelect(item.id)
                  }
                }}
                className={`p-4 bg-[var(--color-surface)] border rounded-2xl flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-all ${
                  item.isTombstone ? 'opacity-50 bg-[var(--color-surface-subtle)]' : 'card-hover'
                } ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                    : 'border-[var(--color-border)]'
                } ${isSelectMode ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-center gap-3.5 overflow-hidden">
                  {isSelectMode && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded text-primary focus:ring-primary shrink-0 cursor-pointer"
                    />
                  )}
                  <div className="w-11 h-11 rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-primary shrink-0">
                    <CategoryIcon category={item.emoji} size={20} />
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

                  {item.isSettlement ? (
                    <div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSettlement(item.id)
                        }}
                        className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Delete settlement"
                        aria-label="Delete settlement"
                      >
                        <Icon name="delete" size={16} />
                      </button>
                    </div>
                  ) : (
                    <div>
                      {item.isTombstone ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRestoreExpense(item.id)
                          }}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-primary-subtle text-primary hover:bg-primary hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Icon name="reload" size={13} />
                          <span>Restore</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteExpense(item.id)
                          }}
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Delete expense"
                          aria-label="Delete expense"
                        >
                          <Icon name="delete" size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
