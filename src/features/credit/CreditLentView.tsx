import React, { useState, useMemo } from 'react'
import { useStore } from '../../ui/storeContext'
import { breakdownFor } from '../../domain/balance'
import { BASE_CURRENCY, personInitials, type Person } from '../../domain/entities'
import { formatMoney, formatRelativeDate } from '../../domain/formatMoney'
import { AddLoanCreditModal } from './AddLoanCreditModal'
import { FriendDetailModal } from '../friends/FriendDetailModal'
import { ActivityDetailModal } from '../activity/ActivityDetailModal'
import { SettleUpModal } from '../settle/SettleUpModal'
import { CategoryIcon, Icon } from '../../ui/components/Icon'

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

  const validFriends = useMemo(() => {
    return ledgerState.people.filter(
      (p) =>
        !store.isMe(p.id) &&
        p.name !== 'You' &&
        p.name !== 'SplitPay Friend' &&
        p.name !== 'Guest User' &&
        !p.id.startsWith('invited_') &&
        p.name.trim() !== ''
    )
  }, [ledgerState.people, store])

  // Compute breakdown for each friend
  const friendSummaries = useMemo(() => {
    return validFriends.map((friend) => {
      const breakdown = breakdownFor({
        me: meId,
        friend: friend.id,
        expenses: ledgerState.expenses,
        settlements: ledgerState.settlements,
        isMe: (id) => store.isMe(id),
      })

      // Separate Splitwise shares from Direct Loan shares
      let splitwiseNet = 0
      let directLoanNet = 0

      for (const e of ledgerState.expenses) {
        if (e.isTombstone) continue
        for (const s of e.shares) {
          const isFriendOwesMe = s.owedBy === friend.id && store.isMe(s.owedTo)
          const isMeOwesFriend = store.isMe(s.owedBy) && s.owedTo === friend.id

          if (isFriendOwesMe) {
            if (e.isLoan) directLoanNet += s.amountMinor
            else splitwiseNet += s.amountMinor
          } else if (isMeOwesFriend) {
            if (e.isLoan) directLoanNet -= s.amountMinor
            else splitwiseNet -= s.amountMinor
          }
        }
      }

      // Settlements adjust splitwise first
      for (const st of ledgerState.settlements) {
        if (st.isTombstone) continue
        if (st.from === friend.id && store.isMe(st.to)) {
          splitwiseNet -= st.amountMinor
        } else if (store.isMe(st.from) && st.to === friend.id) {
          splitwiseNet += st.amountMinor
        }
      }

      const activeLoansCount = ledgerState.expenses.filter(
        (e) =>
          !e.isTombstone &&
          e.isLoan &&
          e.shares.some((s) => s.owedBy === friend.id || s.owedTo === friend.id)
      ).length

      const sharedBillsCount = ledgerState.expenses.filter(
        (e) =>
          !e.isTombstone &&
          !e.isLoan &&
          e.shares.some((s) => s.owedBy === friend.id || s.owedTo === friend.id)
      ).length

      return {
        friend,
        breakdown,
        splitwiseNet,
        directLoanNet,
        combinedNet: breakdown.netMinor,
        activeLoansCount,
        sharedBillsCount,
      }
    })
  }, [validFriends, ledgerState.expenses, ledgerState.settlements, meId, store])

  // Overall totals across all friends
  const totals = useMemo(() => {
    let totalLent = 0
    let totalCredit = 0
    let splitwiseTotal = 0
    let directLoanTotal = 0

    for (const item of friendSummaries) {
      if (item.combinedNet > 0) totalLent += item.combinedNet
      else if (item.combinedNet < 0) totalCredit += Math.abs(item.combinedNet)

      if (item.splitwiseNet > 0) splitwiseTotal += item.splitwiseNet
      if (item.directLoanNet > 0) directLoanTotal += item.directLoanNet
    }

    return {
      totalLent,
      totalCredit,
      netPosition: totalLent - totalCredit,
      splitwiseTotal,
      directLoanTotal,
    }
  }, [friendSummaries])

  // Filtered friends
  const filteredSummaries = useMemo(() => {
    return friendSummaries.filter((item) => {
      if (filter === 'lent') return item.combinedNet > 0
      if (filter === 'credit') return item.combinedNet < 0
      if (filter === 'splitwise') return item.splitwiseNet !== 0
      return true
    })
  }, [friendSummaries, filter])

  // Recent Loan & Credit Ledger Entries
  const recentCreditEntries = useMemo(() => {
    return ledgerState.expenses
      .filter((e) => !e.isTombstone)
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
  }, [ledgerState.expenses, currentCurrency, store])

  const handleOpenAddModal = (type: 'lent' | 'borrowed', friendId?: string) => {
    setLoanModalType(type)
    setLoanModalFriendId(friendId || null)
    setShowAddLoanModal(true)
  }

  const handleOpenSettle = (friendId: string, amountMinor: number) => {
    setSettleFriendId(friendId)
    setSettleAmountMinor(amountMinor)
    setShowSettleModal(true)
  }

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
          </div>
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-1 leading-relaxed">
            Track personal money lent to friends, credit borrowed, and Splitwise shared balances for respected individuals
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

      {/* 3 KPI Balance Cards with Glowing Aesthetics */}
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
          <div className="my-2">
            <div className="text-3xl font-extrabold text-owed font-mono">
              +{formatMoney(totals.totalLent, currentCurrency)}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Total money friends owe you (Splitwise + Direct loans)
            </p>
          </div>
          <div className="pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>
              Splitwise: <strong className="text-[var(--color-text)] font-mono">{formatMoney(totals.splitwiseTotal, currentCurrency)}</strong>
            </span>
            <span>
              Loans: <strong className="text-owed font-mono">{formatMoney(totals.directLoanTotal, currentCurrency)}</strong>
            </span>
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
          <div className="my-2">
            <div className="text-3xl font-extrabold text-[var(--color-text)] font-mono">
              {totals.totalCredit > 0 ? '\u2212' : ''}
              {formatMoney(totals.totalCredit, currentCurrency)}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Total money you currently owe to others
            </p>
          </div>
          <div className="pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>Repayment liability across circles</span>
            <span className="font-bold text-[var(--color-text)]">
              {totals.totalCredit === 0 ? 'Clear (No Debt)' : 'Active Debt'}
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
              {currentCurrency.code}
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-extrabold font-mono">
              {totals.netPosition > 0 ? '+' : totals.netPosition < 0 ? '\u2212' : ''}
              {formatMoney(Math.abs(totals.netPosition), currentCurrency)}
            </div>
            <p className="text-xs text-white/80 mt-1">
              {totals.netPosition > 0
                ? 'You are a net creditor (more money lent than borrowed)'
                : totals.netPosition < 0
                ? 'You are a net debtor (more credit taken than lent)'
                : 'All square! Zero net debt.'}
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
            Money Lent ({friendSummaries.filter((f) => f.combinedNet > 0).length})
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
            Credit Taken ({friendSummaries.filter((f) => f.combinedNet < 0).length})
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
            Splitwise Shared ({friendSummaries.filter((f) => f.splitwiseNet !== 0).length})
          </button>
        </div>

        <div className="text-xs text-[var(--color-text-muted)] font-medium">
          Showing dual balance breakdown per individual
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
          {filteredSummaries.map(({ friend, combinedNet, splitwiseNet, directLoanNet, activeLoansCount, sharedBillsCount }) => {
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
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] block">
                        Total Combined Net
                      </span>
                      <span
                        className={`font-mono text-xl font-extrabold ${
                          combinedNet > 0
                            ? 'text-owed'
                            : combinedNet < 0
                            ? 'text-owe'
                            : 'text-[var(--color-text-muted)]'
                        }`}
                      >
                        {combinedNet > 0 ? '+' : combinedNet < 0 ? '\u2212' : ''}
                        {formatMoney(Math.abs(combinedNet), currentCurrency)}
                      </span>
                      <span className="text-[10px] font-semibold text-[var(--color-text-muted)] block">
                        {combinedNet > 0 ? 'owes you' : combinedNet < 0 ? 'you owe' : 'square'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {combinedNet !== 0 && (
                        <button
                          type="button"
                          onClick={() => handleOpenSettle(friend.id, combinedNet)}
                          className="btn-press btn-primary px-3.5 py-2 font-extrabold text-xs rounded-xl shadow-sm cursor-pointer"
                        >
                          Settle / Repay
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedFriendDetail(friend)}
                        className="btn-press px-3 py-2 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)] font-semibold text-xs rounded-xl border border-[var(--color-border)] transition-colors cursor-pointer"
                        title="View Groupwise & Individual details"
                      >
                        Details →
                      </button>
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
                      <span
                        className={`font-mono text-xs font-extrabold ${
                          splitwiseNet > 0
                            ? 'text-owed'
                            : splitwiseNet < 0
                            ? 'text-owe'
                            : 'text-[var(--color-text-muted)]'
                        }`}
                      >
                        {splitwiseNet > 0 ? '+' : splitwiseNet < 0 ? '\u2212' : ''}
                        {formatMoney(Math.abs(splitwiseNet), currentCurrency)}
                      </span>
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

                  {/* Right: Direct Loan / Credit */}
                  <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                        <Icon name="moneyHand" size={15} strokeWidth={2} className="text-primary" />
                        <span>Direct Loan / Credit</span>
                      </span>
                      <span
                        className={`font-mono text-xs font-extrabold ${
                          directLoanNet > 0
                            ? 'text-owed'
                            : directLoanNet < 0
                            ? 'text-owe'
                            : 'text-[var(--color-text-muted)]'
                        }`}
                      >
                        {directLoanNet > 0 ? '+' : directLoanNet < 0 ? '\u2212' : ''}
                        {formatMoney(Math.abs(directLoanNet), currentCurrency)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                      Personal loans given directly to {friend.name} or credit borrowed from them.
                    </p>
                    <div className="pt-2 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                      <span>Active Entries: <strong className="text-[var(--color-text)]">{activeLoansCount}</strong></span>
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

      {/* Recent Entries Timeline */}
      <div className="card-surface rounded-3xl p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
          <h3 className="font-bold text-sm text-[var(--color-text)]">
            Recent Credit & Loan Ledger Entries ({recentCreditEntries.length})
          </h3>
          <span className="text-xs text-[var(--color-text-muted)] font-mono">Real-time sync</span>
        </div>

        {recentCreditEntries.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">
            No entries recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)] text-xs">
            {recentCreditEntries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => {
                  setSelectedActivityId(entry.id)
                  setSelectedActivityIsSettlement(false)
                }}
                className="py-3 px-2 rounded-xl flex items-center justify-between hover:bg-[var(--color-surface-subtle)] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary-subtle text-primary border border-primary-border flex items-center justify-center text-sm shrink-0">
                    <CategoryIcon category={entry.categoryEmoji} size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[var(--color-text)]">{entry.title}</p>
                      {entry.isLoan && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                          {entry.loanType === 'lent' ? 'Loan Given' : 'Credit Taken'}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                      {formatRelativeDate(entry.createdAtMicros)}
                      {entry.dueDateMicros && (
                        <span> · Due {new Date(Math.floor(entry.dueDateMicros / 1000)).toLocaleDateString()}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`font-mono font-bold ${
                      entry.isLent ? 'text-owed' : 'text-owe'
                    }`}
                  >
                    {entry.isLent ? '+' : '\u2212'}
                    {formatMoney(entry.amountMinor, entry.currency)}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] block mt-0.5">
                    {entry.isLent ? 'you lent' : 'you borrowed'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Loan / Credit Modal */}
      <AddLoanCreditModal
        isOpen={showAddLoanModal}
        onClose={() => setShowAddLoanModal(false)}
        initialType={loanModalType}
        initialFriendId={loanModalFriendId}
      />

      {/* Friend Detail Modal */}
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
      />
    </div>
  )
}
