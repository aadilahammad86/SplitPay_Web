import React, { useState, useMemo } from 'react'
import { useStore } from '../../ui/storeContext'
import {
  buildFriendStatement,
  buildGroupStatement,
  generateStatementCsv,
} from '../../domain/statement'
import { BASE_CURRENCY } from '../../domain/entities'
import { Icon } from '../../ui/components/Icon'

interface StatementsViewProps {
  initialSubjectId?: string | null
}

export const StatementsView: React.FC<StatementsViewProps> = ({ initialSubjectId = null }) => {
  const { store, ledgerState } = useStore()
  const me = store.me
  const meId = me?.id || ''

  const [subjectType, setSubjectType] = useState<'friend' | 'group'>('friend')
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (initialSubjectId) return initialSubjectId
    const firstFriend = ledgerState.people.find((p) => p.id !== meId)
    return firstFriend?.id || ''
  })

  const [dateFilter, setDateFilter] = useState<'all' | 'month' | 'custom'>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const friends = ledgerState.people.filter((p) => p.id !== meId)
  const groups = ledgerState.groups

  const [currentDate] = useState(() => new Date())

  // Determine dates
  const { startDate, endDate } = useMemo(() => {
    let start: Date | undefined
    let end: Date | undefined

    if (dateFilter === 'month') {
      start = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000)
      end = new Date(currentDate.getTime())
    } else if (dateFilter === 'custom') {
      if (customStart) start = new Date(customStart)
      if (customEnd) end = new Date(customEnd)
    }
    return { startDate: start, endDate: end }
  }, [dateFilter, customStart, customEnd, currentDate])

  // Generate statement
  const statement = useMemo(() => {
    if (!me || !selectedId) return null
    if (subjectType === 'friend') {
      const friend = ledgerState.people.find((p) => p.id === selectedId)
      if (friend) {
        return buildFriendStatement({
          me,
          friend,
          expenses: ledgerState.expenses,
          settlements: ledgerState.settlements,
          startDate,
          endDate,
        })
      }
    } else if (subjectType === 'group') {
      const group = ledgerState.groups.find((g) => g.id === selectedId)
      if (group) {
        return buildGroupStatement({
          me,
          group,
          people: ledgerState.people,
          expenses: ledgerState.expenses,
          settlements: ledgerState.settlements,
          startDate,
          endDate,
        })
      }
    }
    return null
  }, [me, selectedId, subjectType, ledgerState.people, ledgerState.groups, ledgerState.expenses, ledgerState.settlements, startDate, endDate])

  const handleDownloadCsv = () => {
    if (!statement) return
    const csvData = generateStatementCsv(statement, BASE_CURRENCY.code)
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${statement.title.replace(/\s+/g, '_')}_statement.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in text-sm">
      {/* Title & Download CSV action */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--color-text)] tracking-tight">
            Statements & Export
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Generate and export RFC 4180 CSV statements for any friend or group.
          </p>
        </div>

        {statement && statement.items.length > 0 && (
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Icon name="document" size={16} />
            <span>Download CSV</span>
          </button>
        )}
      </div>

      {/* Selectors card */}
      <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Friend or Group Switch */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Statement Type
            </label>
            <div className="flex gap-1.5 p-1 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setSubjectType('friend')
                  setSelectedId(friends[0]?.id || '')
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all inline-flex items-center justify-center gap-1.5 ${
                  subjectType === 'friend' ? 'bg-primary text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <Icon name="users" size={14} />
                <span>Friend</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubjectType('group')
                  setSelectedId(groups[0]?.id || '')
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all inline-flex items-center justify-center gap-1.5 ${
                  subjectType === 'group' ? 'bg-primary text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <Icon name="beach" size={14} />
                <span>Group</span>
              </button>
            </div>
          </div>

          {/* Subject Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              {subjectType === 'friend' ? 'Choose Friend' : 'Choose Group'}
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-bold cursor-pointer"
            >
              {subjectType === 'friend' ? (
                friends.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))
              ) : (
                groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Date Filter */}
        <div className="pt-2 border-t border-[var(--color-border)] flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">Date Range:</span>
          <div className="flex gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                dateFilter === 'all'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]'
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('month')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                dateFilter === 'month'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]'
              }`}
            >
              Past 30 Days
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('custom')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                dateFilter === 'custom'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]'
              }`}
            >
              Custom
            </button>
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 mt-2 sm:mt-0 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-1 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-lg"
              />
              <span>to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-1 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-lg"
              />
            </div>
          )}
        </div>
      </div>

      {/* Statement Preview Table */}
      {!statement || statement.items.length === 0 ? (
        <div className="p-8 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
          <p className="text-sm text-[var(--color-text-muted)]">
            No transactions found for the selected subject and period.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-[var(--color-text)]">{statement.title}</h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                {statement.totalExpenseCount} expenses · {statement.totalSettlementCount} payments
              </p>
            </div>
            {subjectType === 'friend' && (
              <div className="text-right">
                <span className="block text-[10px] text-[var(--color-text-muted)]">Net Balance</span>
                <span
                  className={`font-bold text-sm ${
                    statement.netBalanceMinor > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : statement.netBalanceMinor < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-[var(--color-text)]'
                  }`}
                >
                  {BASE_CURRENCY.symbol}{(statement.netBalanceMinor / 100).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-surface-subtle)] border-b border-[var(--color-border)] text-[var(--color-text-muted)] uppercase">
                <tr>
                  <th className="py-2.5 px-3.5">Date</th>
                  <th className="py-2.5 px-3.5">Type</th>
                  <th className="py-2.5 px-3.5">Description</th>
                  <th className="py-2.5 px-3.5 text-right">Total</th>
                  <th className="py-2.5 px-3.5 text-right">Your Share</th>
                  <th className="py-2.5 px-3.5">Paid By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {statement.items.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--color-surface-subtle)]/50 transition-colors">
                    <td className="py-2.5 px-3.5 whitespace-nowrap text-[var(--color-text-muted)]">
                      {item.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="py-2.5 px-3.5 font-semibold">
                      {item.isSettlement ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <Icon name="moneyHand" size={14} />
                          <span>Payment</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-primary">
                          <Icon name="receipt" size={14} />
                          <span>Expense</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 font-medium text-[var(--color-text)]">
                      {item.description}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-semibold">
                      {BASE_CURRENCY.symbol}{(item.totalMinor / 100).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-bold text-primary">
                      {BASE_CURRENCY.symbol}{(item.yourShareMinor / 100).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3.5 text-[var(--color-text-muted)]">
                      {item.paidByName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
