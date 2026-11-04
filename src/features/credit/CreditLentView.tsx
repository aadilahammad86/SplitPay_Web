import React, { useState, useMemo } from 'react'
import { useStore } from '../../ui/storeContext'
import { multiCurrencyBreakdownFor } from '../../domain/balance'
import { BASE_CURRENCY, personInitials, type Person } from '../../domain/entities'
import { formatMoney, formatRelativeDate } from '../../domain/formatMoney'
import { AddLoanCreditModal } from './AddLoanCreditModal'
import { FriendDetailModal } from '../friends/FriendDetailModal'
import { ActivityDetailModal } from '../activity/ActivityDetailModal'
import { SettleUpModal } from '../settle/SettleUpModal'
import { CategoryIcon, Icon } from '../../ui/components/Icon'
import { isExpenseParticipant, isFriendOfUser } from '../../domain/privacy'
import type { CurrencyCode } from '../../domain/money'

interface CreditLentViewProps {
  onNavigateToStatement: (friendId: string) => void
}

export const CreditLentView: React.FC<CreditLentViewProps> = ({ onNavigateToStatement }) => {
  const { store, ledgerState } = useStore()
  const me = store.me
  const meId = me?.id || ''
  const currentCurrency = ledgerState.defaultCurrency || BASE_CURRENCY

  const [filter, setFilter] = useState<'all' | 'lent' | 'credit' | 'splitwise'>('all')
  const [showAddLoanModal, setShowAddLoanModal] = useState(false)
  const [loanModalType, setLoanModalType] = useState<'lent' | 'borrowed'>('lent')
  const [loanModalFriendId, setLoanModalFriendId] = useState<string | null>(null)

  const [selectedFriendDetail, setSelectedFriendDetail] = useState<Person | null>(null)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [selectedActivityIsSettlement, setSelectedActivityIsSettlement] = useState(false)

  const [showSettleModal, setShowSettleModal] = useState(false)
  const [settleFriendId, setSettleFriendId] = useState<string | null>(null)
  const [settleAmountMinor, setSettleAmountMinor] = useState(0)
  const [settleCurrency, setSettleCurrency] = useState<CurrencyCode | undefined>(undefined)

  const validFriends = useMemo(() => {
    return ledgerState.people.filter((p) =>
      isFriendOfUser({
        person: p,
        meId,
        expenses: ledgerState.expenses,
        settlements: ledgerState.settlements,
        groups: ledgerState.groups,
        isMe: (id) => store.isMe(id),
      })
    )
  }, [ledgerState.people, ledgerState.expenses, ledgerState.settlements, ledgerState.groups, meId, store])

  // Compute multi-currency breakdown for each friend
  const friendSummaries = useMemo(() => {
    return validFriends.map((friend) => {
      const currMap = multiCurrencyBreakdownFor({
        me: meId,
        friend: friend.id,
        expenses: ledgerState.expenses,
        settlements: ledgerState.settlements,
        isMe: (id) => store.isMe(id),
      })

      const balances = Array.from(currMap.values())
      const activeLoansCount = ledgerState.expenses.filter(
        (e) =>
          !e.isTombstone &&
          e.isLoan &&
          e.shares.some(
            (s) =>
              (s.owedBy === friend.id && store.isMe(s.owedTo)) ||
              (store.isMe(s.owedBy) && s.owedTo === friend.id)
          )
      ).length

      const sharedBillsCount = ledgerState.expenses.filter(
        (e) =>
          !e.isTombstone &&
          !e.isLoan &&
          e.shares.some(
            (s) =>
              (s.owedBy === friend.id && store.isMe(s.owedTo)) ||
              (store.isMe(s.owedBy) && s.owedTo === friend.id)
          )
      ).length

      return {
        friend,
        currMap,
        balances,
        activeLoansCount,
        sharedBillsCount,
      }
    })
  }, [validFriends, ledgerState.expenses, ledgerState.settlements, meId, store])

  // Overall totals grouped strictly by currency (never illegally adding cross-currency minor units)
  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, {
      currency: CurrencyCode
      totalLent: number
      totalCredit: number
      netPosition: number
      splitwiseTotal: number
      directLoanTotal: number
    }>()

    for (const item of friendSummaries) {
      for (const b of item.balances) {
        let entry = map.get(b.currency.code)
        if (!entry) {
          entry = {
            currency: b.currency,
            totalLent: 0,
            totalCredit: 0,
            netPosition: 0,
            splitwiseTotal: 0,
            directLoanTotal: 0,
          }
          map.set(b.currency.code, entry)
        }

        if (b.netMinor > 0) entry.totalLent += b.netMinor
        else if (b.netMinor < 0) entry.totalCredit += Math.abs(b.netMinor)

        if (b.splitwiseNet > 0) entry.splitwiseTotal += b.splitwiseNet
        if (b.directLoanNet > 0) entry.directLoanTotal += b.directLoanNet

        entry.netPosition = entry.totalLent - entry.totalCredit
      }
    }

    // Ensure default currency is represented even if 0
    if (!map.has(currentCurrency.code)) {
      map.set(currentCurrency.code, {
        currency: currentCurrency,
        totalLent: 0,
        totalCredit: 0,
        netPosition: 0,
        splitwiseTotal: 0,
        directLoanTotal: 0,
      })
    }

    const list = Array.from(map.values())
    list.sort((a, b) => {
      if (a.currency.code === currentCurrency.code) return -1
      if (b.currency.code === currentCurrency.code) return 1
      return a.currency.code.localeCompare(b.currency.code)
    })

    return { map, list }
  }, [friendSummaries, currentCurrency])

  // Filtered friends
  const filteredSummaries = useMemo(() => {
    return friendSummaries.filter((item) => {
      const anyLent = item.balances.some((b) => b.netMinor > 0)
      const anyCredit = item.balances.some((b) => b.netMinor < 0)
      const anySplitwise = item.balances.some((b) => b.splitwiseNet !== 0)

      if (filter === 'lent') return anyLent
      if (filter === 'credit') return anyCredit
      if (filter === 'splitwise') return anySplitwise
      return true
    })
  }, [friendSummaries, filter])

  // Recent Loan & Credit Ledger Entries
  const recentCreditEntries = useMemo(() => {
    return ledgerState.expenses
      .filter((e) => !e.isTombstone && isExpenseParticipant(e, meId, (id) => store.isMe(id)))
      .map((e) => {
        const isLent = store.isMe(e.paidBy)
        return {
          id: e.id,
          title: e.description,
          amountMinor: e.totalMinor,
          currency: e.currency || currentCurrency,
          createdAtMicros: e.createdAtMicros,
          isLoan: Boolean(e.isLoan),
          loanType: e.loanType,
          isLent,
          categoryEmoji: e.categoryEmoji || (e.isLoan ? '💸' : '🧾'),
          dueDateMicros: e.dueDateMicros,
        }
      })
      .sort((a, b) => b.createdAtMicros - a.createdAtMicros)
      .slice(0, 8)
  }, [ledgerState.expenses, currentCurrency, store, meId])

  const handleOpenAddModal = (type: 'lent' | 'borrowed', friendId?: string) => {
    setLoanModalType(type)
    setLoanModalFriendId(friendId || null)
    setShowAddLoanModal(true)
  }

  const handleOpenSettle = (friendId: string, amountMinor: number, currency?: CurrencyCode) => {
    setSettleFriendId(friendId)
    setSettleAmountMinor(amountMinor)
    setSettleCurrency(currency)
    setShowSettleModal(true)
  }

  // Check if multiple currencies exist in the ledger
  const activeCurrenciesWithTotals = totalsByCurrency.list.filter(
    (c) => c.totalLent > 0 || c.totalCredit > 0 || c.currency.code === currentCurrency.code
  )
  const isMultiCurrency = totalsByCurrency.list.filter((c) => c.totalLent > 0 || c.totalCredit > 0).length > 1

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Top Header & Left-Aligned Hero Action Buttons */}
      <div className="space-y-4 pb-2">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-text)]">
              Lent & Credit
            </h1>
            <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary-subtle text-primary border border-primary-border">
              Loans & Credit Ledger
            </span>
            {isMultiCurrency && (
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Multi-Currency Active
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-1 leading-relaxed">
            Track personal money lent to friends, credit borrowed, and Splitwise shared balances isolated by currency.
          </p>
        </div>

        {/* Big, Left-Aligned Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-3.5 pt-1">
          <button
            type="button"
            onClick={() => handleOpenAddModal('lent')}
            className="btn-press btn-glow px-6 py-3.5 font-extrabold text-sm rounded-2xl flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02]"
          >
            <Icon name="moneyHand" size={22} strokeWidth={2} />
            <div className="text-left">
              <span className="block leading-none text-white font-extrabold">+ Give Loan (Lent)</span>
              <span className="text-[10px] text-white/90 font-medium block mt-1">Record money lent to a friend</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleOpenAddModal('borrowed')}
            className="btn-press card-glow px-6 py-3.5 text-[var(--color-text)] font-extrabold text-sm rounded-2xl flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02]"
          >
            <Icon name="creditcardHand" size={22} strokeWidth={2} />
            <div className="text-left">
              <span className="block leading-none">+ Take Credit (Borrowed)</span>
              <span className="text-[10px] text-[var(--color-text-muted)] font-medium block mt-1">Record money borrowed from someone</span>
            </div>
          </button>
        </div>
      </div>

      {/* 3 KPI Balance Cards with Multi-Currency Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Total Lent (Receivables) */}
        <div className="card-glow rounded-3xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-owed">
              Total Money Lent (Given)
            </span>
            <div className="w-8 h-8 rounded-xl bg-owed text-owed border border-[var(--color-owed-border)] flex items-center justify-center">
              <Icon name="arrowUp" size={16} strokeWidth={2} />
            </div>
          </div>
          <div className="my-2 space-y-1.5">
            {activeCurrenciesWithTotals.map((c) => (
              <div key={c.currency.code} className="flex items-baseline justify-between">
                <div className="text-2xl sm:text-3xl font-extrabold text-owed font-mono">
                  +{formatMoney(c.totalLent, c.currency)}
                </div>
                {activeCurrenciesWithTotals.length > 1 && (
                  <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase">
                    {c.currency.code}
                  </span>
                )}
              </div>
            ))}
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Total money friends owe you (Splitwise + Direct loans)
            </p>
          </div>
          <div className="pt-3 border-t border-[var(--color-border-subtle)] space-y-1 text-xs text-[var(--color-text-muted)]">
            {activeCurrenciesWithTotals.map((c) => (
              <div key={c.currency.code} className="flex items-center justify-between">
                <span>
                  Splitwise: <strong className="text-[var(--color-text)] font-mono">{formatMoney(c.splitwiseTotal, c.currency)}</strong>
                </span>
                <span>
                  Loans: <strong className="text-owed font-mono">{formatMoney(c.directLoanTotal, c.currency)}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Total Credit Taken (Payables) */}
        <div className="card-glow rounded-3xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-owe">
              Total Credit (Borrowed)
            </span>
            <div className="w-8 h-8 rounded-xl bg-owe text-owe border border-[var(--color-owe-border)] flex items-center justify-center">
              <Icon name="arrowDown" size={16} strokeWidth={2} />
            </div>
          </div>
          <div className="my-2 space-y-1.5">
            {activeCurrenciesWithTotals.map((c) => (
              <div key={c.currency.code} className="flex items-baseline justify-between">
                <div className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text)] font-mono">
                  {c.totalCredit > 0 ? '\u2212' : ''}
                  {formatMoney(c.totalCredit, c.currency)}
                </div>
                {activeCurrenciesWithTotals.length > 1 && (
                  <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase">
                    {c.currency.code}
                  </span>
                )}
              </div>
            ))}
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Total money you currently owe to others
            </p>
          </div>
          <div className="pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>Repayment liability across circles</span>
            <span className="font-bold text-[var(--color-text)]">
              {activeCurrenciesWithTotals.every((c) => c.totalCredit === 0) ? 'Clear (No Debt)' : 'Active Debt'}
            </span>
          </div>
        </div>

        {/* Card 3: Net Credit Position (Hero Glowing Card) */}
        <div className="card-hero-glow rounded-3xl p-6 text-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">
              Net Credit Standing
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20">
              {isMultiCurrency ? 'Multi-Currency' : currentCurrency.code}
            </span>
          </div>
          <div className="my-2 space-y-1.5">
            {activeCurrenciesWithTotals.map((c) => (
              <div key={c.currency.code} className="flex items-baseline justify-between">
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                  {c.netPosition > 0 ? '+' : c.netPosition < 0 ? '\u2212' : ''}
                  {formatMoney(Math.abs(c.netPosition), c.currency)}
                </div>
                {activeCurrenciesWithTotals.length > 1 && (
                  <span className="text-xs font-bold text-white/80 uppercase">
                    {c.currency.code}
                  </span>
                )}
              </div>
            ))}
            <p className="text-xs text-white/80 mt-1">
              Isolated per currency without cross-currency addition.
            </p>
          </div>
          <div className="pt-3 border-t border-white/20 flex items-center justify-between text-xs text-white/90">
            <span>{validFriends.length} respected {validFriends.length === 1 ? 'individual' : 'individuals'}</span>
            <span className="font-bold">100% Repayable</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 p-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl text-xs font-bold shadow-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl cursor-pointer transition-all ${
              filter === 'all'
                ? 'btn-glow font-extrabold'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Respected Individuals ({validFriends.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('lent')}
            className={`px-3.5 py-1.5 rounded-xl cursor-pointer transition-all ${
              filter === 'lent'
                ? 'btn-glow font-extrabold'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Money Lent ({friendSummaries.filter((f) => f.balances.some((b) => b.netMinor > 0)).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('credit')}
            className={`px-3.5 py-1.5 rounded-xl cursor-pointer transition-all ${
              filter === 'credit'
                ? 'btn-glow font-extrabold'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Credit Taken ({friendSummaries.filter((f) => f.balances.some((b) => b.netMinor < 0)).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('splitwise')}
            className={`px-3.5 py-1.5 rounded-xl cursor-pointer transition-all ${
              filter === 'splitwise'
                ? 'btn-glow font-extrabold'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Splitwise Shared ({friendSummaries.filter((f) => f.balances.some((b) => b.splitwiseNet !== 0)).length})
          </button>
        </div>

        <div className="text-xs text-[var(--color-text-muted)] font-medium">
          Showing dual balance breakdown per individual & currency
        </div>
      </div>

      {/* Respected Individuals Directory (Cards) */}
      {filteredSummaries.length === 0 ? (
        <div className="p-12 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary-subtle text-primary flex items-center justify-center mx-auto shadow-sm">
            <Icon name="creditcard" size={28} strokeWidth={2} />
          </div>
          <h3 className="font-bold text-base text-[var(--color-text)]">No entries matching this filter</h3>
          <p className="text-xs text-[var(--color-text-muted)] max-w-sm mx-auto">
            Give a personal loan or take credit to see entries organized by respected individual.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSummaries.map(({ friend, balances, activeLoansCount, sharedBillsCount }) => {
            // Non-zero balances
            const activeBalances = balances.filter((b) => b.netMinor !== 0)
            const displayBalances = activeBalances.length > 0 ? activeBalances : balances.slice(0, 1)

            return (
              <div
                key={friend.id}
                className="card-surface rounded-3xl p-5 sm:p-6 shadow-sm border-[var(--color-border)] space-y-4 hover:border-primary/40 transition-all card-hover"
              >
                {/* Individual Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-border)]">
                  <div
                    className="flex items-center gap-3.5 cursor-pointer hover:opacity-85 transition-opacity"
                    onClick={() => setSelectedFriendDetail(friend)}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-primary-subtle border border-primary-border text-primary font-black flex items-center justify-center text-lg shadow-sm shrink-0">
                      {personInitials(friend.name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-base text-[var(--color-text)]">
                          {friend.name}
                        </h3>
                        {friend.handle && (
                          <span className="text-xs text-[var(--color-text-muted)]">@{friend.handle}</span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-subtle text-primary border border-primary-border">
                          Respected Individual
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {activeLoansCount} direct {activeLoansCount === 1 ? 'loan' : 'loans'} · {sharedBillsCount} shared bills
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="text-right space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] block">
                        Net Balance {displayBalances.length > 1 ? '(Multi-Currency)' : ''}
                      </span>
                      {displayBalances.length === 0 ? (
                        <span className="font-mono text-xl font-extrabold text-[var(--color-text-muted)]">
                          {formatMoney(0, currentCurrency)}
                        </span>
                      ) : (
                        displayBalances.map((b) => (
                          <div key={b.currency.code} className="flex items-center justify-end gap-1.5">
                            <span
                              className={`font-mono text-lg font-extrabold ${
                                b.netMinor > 0
                                  ? 'text-owed'
                                  : b.netMinor < 0
                                  ? 'text-owe'
                                  : 'text-[var(--color-text-muted)]'
                              }`}
                            >
                              {b.netMinor > 0 ? '+' : b.netMinor < 0 ? '\u2212' : ''}
                              {formatMoney(Math.abs(b.netMinor), b.currency)}
                            </span>
                            <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">
                              ({b.netMinor > 0 ? 'owes you' : b.netMinor < 0 ? 'you owe' : 'square'})
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-1.5">
                      {activeBalances.map((b) => (
                        <button
                          key={b.currency.code}
                          type="button"
                          onClick={() => handleOpenSettle(friend.id, b.netMinor, b.currency)}
                          className="btn-press btn-primary px-3 py-1.5 font-extrabold text-xs rounded-xl shadow-sm cursor-pointer whitespace-nowrap"
                          title={`Settle ${b.currency.code} balance`}
                        >
                          Settle {b.currency.code}
                        </button>
                      ))}
                      {activeBalances.length === 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedFriendDetail(friend)}
                          className="btn-press px-3 py-1.5 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)] font-semibold text-xs rounded-xl border border-[var(--color-border)] transition-colors cursor-pointer"
                        >
                          Details →
                        </button>
                      )}
                      {activeBalances.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedFriendDetail(friend)}
                          className="btn-press px-3 py-1.5 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)] font-semibold text-xs rounded-xl border border-[var(--color-border)] transition-colors cursor-pointer"
                          title="View Groupwise & Individual details"
                        >
                          Details →
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dual Breakdown Columns (Splitwise vs Direct Loan) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Splitwise Amounts */}
                  <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                        <Icon name="receipt" size={15} strokeWidth={2} className="text-primary" />
                        <span>Splitwise Amounts</span>
                      </span>
                    </div>

                    {/* Render Splitwise balance per currency */}
                    <div className="space-y-1">
                      {balances.filter((b) => b.splitwiseNet !== 0).length === 0 ? (
                        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-mono">
                          <span>All Shared Bills Settled</span>
                          <span className="font-bold">0.00</span>
                        </div>
                      ) : (
                        balances
                          .filter((b) => b.splitwiseNet !== 0)
                          .map((b) => (
                            <div key={b.currency.code} className="flex items-center justify-between">
                              <span className="text-xs text-[var(--color-text-muted)] uppercase font-semibold">
                                {b.currency.code} Shared:
                              </span>
                              <span
                                className={`font-mono text-xs font-extrabold ${
                                  b.splitwiseNet > 0
                                    ? 'text-owed'
                                    : b.splitwiseNet < 0
                                    ? 'text-owe'
                                    : 'text-[var(--color-text-muted)]'
                                }`}
                              >
                                {b.splitwiseNet > 0 ? '+' : b.splitwiseNet < 0 ? '\u2212' : ''}
                                {formatMoney(Math.abs(b.splitwiseNet), b.currency)}
                              </span>
                            </div>
                          ))
                      )}
                    </div>

                    <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                      Generated from shared meals, dining, trips, and group split bills.
                    </p>
                    <div className="pt-2 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                      <span>Shared Bills: <strong className="text-[var(--color-text)]">{sharedBillsCount}</strong></span>
                      <span
                        className="text-primary font-semibold hover:underline cursor-pointer"
                        onClick={() => onNavigateToStatement(friend.id)}
                      >
                        View Statement →
                      </span>
                    </div>
                  </div>

                  {/* Right: Direct Loan Amounts */}
                  <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                        <Icon name="moneyHand" size={15} strokeWidth={2} className="text-owed" />
                        <span>Direct Loans & Credit</span>
                      </span>
                    </div>

                    {/* Render Direct Loan balance per currency */}
                    <div className="space-y-1">
                      {balances.filter((b) => b.directLoanNet !== 0).length === 0 ? (
                        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-mono">
                          <span>No Active Loans</span>
                          <span className="font-bold">0.00</span>
                        </div>
                      ) : (
                        balances
                          .filter((b) => b.directLoanNet !== 0)
                          .map((b) => (
                            <div key={b.currency.code} className="flex items-center justify-between">
                              <span className="text-xs text-[var(--color-text-muted)] uppercase font-semibold">
                                {b.currency.code} Direct:
                              </span>
                              <span
                                className={`font-mono text-xs font-extrabold ${
                                  b.directLoanNet > 0
                                    ? 'text-owed'
                                    : b.directLoanNet < 0
                                    ? 'text-owe'
                                    : 'text-[var(--color-text-muted)]'
                                }`}
                              >
                                {b.directLoanNet > 0 ? '+' : b.directLoanNet < 0 ? '\u2212' : ''}
                                {formatMoney(Math.abs(b.directLoanNet), b.currency)}
                              </span>
                            </div>
                          ))
                      )}
                    </div>

                    <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                      Direct personal loans lent or credit borrowed without group bill splitting.
                    </p>
                    <div className="pt-2 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                      <span>Direct Loans: <strong className="text-[var(--color-text)]">{activeLoansCount}</strong></span>
                      <div className="flex gap-2">
                        <span
                          className="text-primary font-bold hover:underline cursor-pointer"
                          onClick={() => handleOpenAddModal('lent', friend.id)}
                        >
                          + Give Loan
                        </span>
                        <span>·</span>
                        <span
                          className="text-primary font-bold hover:underline cursor-pointer"
                          onClick={() => handleOpenAddModal('borrowed', friend.id)}
                        >
                          + Take Credit
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recent Activity Log for Loans & Credit */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[var(--color-text)]">
            Recent Loan & Credit Ledger Activity
          </h2>
          <span className="text-xs text-[var(--color-text-muted)]">
            Last {recentCreditEntries.length} records
          </span>
        </div>

        {recentCreditEntries.length === 0 ? (
          <div className="p-8 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl text-xs text-[var(--color-text-muted)]">
            No loan or shared bill transactions recorded yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {recentCreditEntries.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedActivityId(item.id)
                  setSelectedActivityIsSettlement(false)
                }}
                className="card-surface rounded-2xl p-4 border-[var(--color-border)] space-y-2.5 cursor-pointer hover:border-primary/50 transition-all card-hover"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <CategoryIcon category={item.categoryEmoji} size={30} />
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-[var(--color-text)] truncate">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {formatRelativeDate(item.createdAtMicros)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${
                      item.isLoan
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-primary-subtle text-primary border border-primary-border'
                    }`}
                  >
                    {item.isLoan ? (item.loanType === 'borrowed' ? 'Credit' : 'Loan') : 'Bill'}
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-1 border-t border-[var(--color-border-subtle)]">
                  <span className="text-[10px] text-[var(--color-text-muted)] font-medium">
                    {item.isLent ? 'Lent / Paid' : 'Borrowed'}
                  </span>
                  <span
                    className={`font-mono text-sm font-extrabold ${
                      item.isLent ? 'text-owed' : 'text-owe'
                    }`}
                  >
                    {item.isLent ? '+' : '\u2212'}
                    {formatMoney(item.amountMinor, item.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Give Loan / Take Credit Modal */}
      <AddLoanCreditModal
        isOpen={showAddLoanModal}
        onClose={() => setShowAddLoanModal(false)}
        initialType={loanModalType}
        initialFriendId={loanModalFriendId}
      />

      {/* Friend Detail Modal (Dual Column Breakdown) */}
      <FriendDetailModal
        isOpen={Boolean(selectedFriendDetail)}
        onClose={() => setSelectedFriendDetail(null)}
        friend={selectedFriendDetail}
        onOpenSettleUp={(fId, amount) => handleOpenSettle(fId, amount)}
        onNavigateToStatement={(fId) => onNavigateToStatement(fId)}
        onSelectActivity={(actId, isSet) => {
          setSelectedActivityId(actId)
          setSelectedActivityIsSettlement(isSet)
        }}
      />

      {/* Activity Detail Modal */}
      <ActivityDetailModal
        isOpen={Boolean(selectedActivityId)}
        onClose={() => setSelectedActivityId(null)}
        itemId={selectedActivityId}
        isSettlement={selectedActivityIsSettlement}
        onSettleUp={(fId, amount) => handleOpenSettle(fId, amount)}
      />

      {/* Settle Up Modal */}
      <SettleUpModal
        isOpen={showSettleModal}
        onClose={() => setShowSettleModal(false)}
        initialFriendId={settleFriendId}
        initialAmountMinor={settleAmountMinor}
        initialCurrency={settleCurrency}
      />
    </div>
  )
}
