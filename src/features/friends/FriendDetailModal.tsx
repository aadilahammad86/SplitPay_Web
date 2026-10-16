import React from 'react'
import { Modal } from '../../ui/components/Modal'
import { useStore } from '../../ui/storeContext'
import { breakdownFor } from '../../domain/balance'
import { MoneyDisplay } from '../../ui/components/MoneyDisplay'
import { CategoryIcon, Icon } from '../../ui/components/Icon'
import { BASE_CURRENCY, GroupKindInfo, personInitials, type Person } from '../../domain/entities'
import { formatMoney } from '../../domain/formatMoney'

interface FriendDetailModalProps {
  isOpen: boolean
  onClose: () => void
  friend: Person | null
  onOpenSettleUp: (friendId: string, amountMinor: number) => void
  onNavigateToStatement: (friendId: string) => void
  onEditFriend?: (friend: Person) => void
  onRemoveFriend?: (friend: Person) => void
  onSelectActivity?: (activityId: string, isSettlement: boolean) => void
}

export const FriendDetailModal: React.FC<FriendDetailModalProps> = ({
  isOpen,
  onClose,
  friend,
  onOpenSettleUp,
  onNavigateToStatement,
  onEditFriend,
  onRemoveFriend,
  onSelectActivity,
}) => {
  const { store, ledgerState } = useStore()
  const me = store.me
  const meId = me?.id || ''
  const currentCurrency = ledgerState.defaultCurrency || BASE_CURRENCY

  if (!isOpen || !friend) return null

  const breakdown = breakdownFor({
    me: meId,
    friend: friend.id,
    expenses: ledgerState.expenses,
    settlements: ledgerState.settlements,
    isMe: (id) => store.isMe(id),
  })

  // 1. Individual Splits: Non-group direct 1:1 transactions
  const directExpenses = ledgerState.expenses.filter(
    (e) =>
      !e.isTombstone &&
      e.groupId === null &&
      e.shares.some(
        (s) =>
          (s.owedBy === friend.id && store.isMe(s.owedTo)) ||
          (store.isMe(s.owedBy) && s.owedTo === friend.id)
      )
  )

  const directBills = directExpenses.filter((e) => !e.isLoan)
  const directLoans = directExpenses.filter((e) => e.isLoan)

  // Direct bills net
  let directBillsNet = 0
  for (const e of directBills) {
    for (const s of e.shares) {
      if (s.owedBy === friend.id && store.isMe(s.owedTo)) directBillsNet += s.amountMinor
      if (store.isMe(s.owedBy) && s.owedTo === friend.id) directBillsNet -= s.amountMinor
    }
  }

  // Direct loans net
  let directLoansNet = 0
  for (const e of directLoans) {
    for (const s of e.shares) {
      if (s.owedBy === friend.id && store.isMe(s.owedTo)) directLoansNet += s.amountMinor
      if (store.isMe(s.owedBy) && s.owedTo === friend.id) directLoansNet -= s.amountMinor
    }
  }

  // Direct settlements
  const directSettlements = ledgerState.settlements.filter(
    (s) =>
      !s.isTombstone &&
      s.groupId === null &&
      ((store.isMe(s.from) && s.to === friend.id) ||
        (s.from === friend.id && store.isMe(s.to)))
  )
  for (const st of directSettlements) {
    if (st.from === friend.id && store.isMe(st.to)) directBillsNet -= st.amountMinor
    if (store.isMe(st.from) && st.to === friend.id) directBillsNet += st.amountMinor
  }

  const directTotalNet = breakdown.direct?.amountMinor ?? (directBillsNet + directLoansNet)

  // 2. Groupwise Splits: Shared groups between me and this friend
  const sharedGroups = ledgerState.groups.filter((g) =>
    g.memberIds.includes(friend.id) ||
    breakdown.groupSlices.some((s) => s.groupId === g.id)
  )

  // 3. Mutual Transactions History (Reverse chronological)
  const mutualTransactions = [
    ...ledgerState.expenses
      .filter(
        (e) =>
          !e.isTombstone &&
          e.shares.some(
            (s) =>
              (s.owedBy === friend.id && store.isMe(s.owedTo)) ||
              (store.isMe(s.owedBy) && s.owedTo === friend.id)
          )
      )
      .map((e) => {
        const friendShare = e.shares.find((s) => s.owedBy === friend.id)?.amountMinor ?? 0
        const myShare = e.shares.find((s) => store.isMe(s.owedBy))?.amountMinor ?? 0
        const isPayer = store.isMe(e.paidBy)
        return {
          id: e.id,
          title: e.description,
          totalMinor: e.totalMinor,
          relevantMinor: isPayer ? friendShare : myShare,
          currency: e.currency,
          createdAtMicros: e.createdAtMicros,
          emoji: e.categoryEmoji || '🧾',
          isSettlement: false,
          isLoan: e.isLoan,
          paidByMe: isPayer,
          groupId: e.groupId,
        }
      }),
    ...ledgerState.settlements
      .filter(
        (s) =>
          !s.isTombstone &&
          ((store.isMe(s.from) && s.to === friend.id) ||
            (s.from === friend.id && store.isMe(s.to)))
      )
      .map((s) => ({
        id: s.id,
        title: store.isMe(s.from) ? `Payment to ${friend.name}` : `Payment from ${friend.name}`,
        totalMinor: s.amountMinor,
        relevantMinor: s.amountMinor,
        currency: s.currency,
        createdAtMicros: s.createdAtMicros,
        emoji: '🤝',
        isSettlement: true,
        isLoan: false,
        paidByMe: store.isMe(s.from),
        groupId: s.groupId,
      })),
  ].sort((a, b) => b.createdAtMicros - a.createdAtMicros)

  const handleSendReminder = () => {
    const text = breakdown.netMinor > 0
      ? `Hey ${friend.name}, just a friendly reminder from SplitPay: you owe ${formatMoney(breakdown.netMinor, currentCurrency)}. You can settle up anytime!`
      : `Hey ${friend.name}, according to SplitPay I owe you ${formatMoney(Math.abs(breakdown.netMinor), currentCurrency)}. Let me know your payment details to settle up!`

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert('Reminder copied to clipboard!')
      }).catch(() => {})
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Financial Standing with ${friend.name}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6 text-sm">
        {/* Top Friend & Net Summary Banner */}
        <div className="p-5 bg-gradient-to-r from-[var(--color-surface-subtle)] to-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-primary-subtle border border-primary-border text-primary font-black flex items-center justify-center text-lg shadow-sm shrink-0">
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
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-mono text-2xl font-black">
                  <MoneyDisplay
                    minor={breakdown.netMinor}
                    currency={currentCurrency}
                    size="lg"
                    showSign={true}
                  />
                </span>
                <span
                  className={`text-xs font-bold ${
                    breakdown.netMinor > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : breakdown.netMinor < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-[var(--color-text-muted)]'
                  }`}
                >
                  {breakdown.netMinor > 0
                    ? 'owes you overall'
                    : breakdown.netMinor < 0
                    ? 'you owe overall'
                    : 'all settled square'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {breakdown.netMinor !== 0 && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenSettleUp(friend.id, breakdown.netMinor)
                }}
                className="btn-press px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Icon name="moneyHand" size={15} />
                <span>Settle Up</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSendReminder}
              className="btn-press px-3.5 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold text-xs rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
              title="Copy friendly payment reminder"
            >
              <Icon name="send" size={14} />
              <span>Remind</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose()
                onNavigateToStatement(friend.id)
              }}
              className="btn-press px-3.5 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold text-xs rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Icon name="chart" size={14} />
              <span>Statement</span>
            </button>
          </div>
        </div>

        {/* SECTION 1: INDIVIDUAL SPLITS (DIRECT 1:1) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs sm:text-sm text-[var(--color-text)]">
                1. Individual Splits (Direct 1:1)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-subtle text-primary border border-primary-border">
                Non-Group
              </span>
            </div>
            <span
              className={`font-mono text-sm font-extrabold ${
                directTotalNet > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : directTotalNet < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-[var(--color-text-muted)]'
              }`}
            >
              {directTotalNet > 0 ? '+' : ''}
              {formatMoney(directTotalNet, currentCurrency)}
            </span>
          </div>

          <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-[var(--color-border-subtle)]">
              <div className="flex items-center gap-2">
                <Icon name="receipt" size={15} strokeWidth={2} className="text-primary" />
                <span className="text-[var(--color-text)] font-medium">
                  Direct 1:1 Shared Bills ({directBills.length} items)
                </span>
              </div>
              <span
                className={`font-mono font-bold ${
                  directBillsNet > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : directBillsNet < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-[var(--color-text-muted)]'
                }`}
              >
                {directBillsNet > 0 ? '+' : ''}
                {formatMoney(directBillsNet, currentCurrency)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pb-2 border-b border-[var(--color-border-subtle)]">
              <div className="flex items-center gap-2">
                <Icon name="moneyHand" size={15} strokeWidth={2} className="text-emerald-400" />
                <span className="text-[var(--color-text)] font-medium">
                  Direct Personal Loans & Credit ({directLoans.length} entries)
                </span>
              </div>
              <span
                className={`font-mono font-bold ${
                  directLoansNet > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : directLoansNet < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-[var(--color-text-muted)]'
                }`}
              >
                {directLoansNet > 0 ? '+' : ''}
                {formatMoney(directLoansNet, currentCurrency)}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)] pt-1">
              <span>Subtotal from Individual Non-Group Transactions:</span>
              <span className="font-mono font-extrabold text-[var(--color-text)]">
                {directTotalNet > 0 ? '+' : ''}
                {formatMoney(directTotalNet, currentCurrency)}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: GROUPWISE SPLITS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs sm:text-sm text-[var(--color-text)]">
                2. Groupwise Splits (Shared Groups)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                {sharedGroups.length} {sharedGroups.length === 1 ? 'Group' : 'Groups'} Shared
              </span>
            </div>
          </div>

          {sharedGroups.length === 0 ? (
            <div className="p-5 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl text-xs text-[var(--color-text-muted)]">
              No shared groups yet with {friend.name}. Add them to a group to track pooled expenses.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sharedGroups.map((group) => {
                const kind = GroupKindInfo[group.kind]
                const slice = breakdown.groupSlices.find((s) => s.groupId === group.id)
                const groupSliceAmount = slice?.amountMinor ?? 0
                const totalGroupSpend = ledgerState.expenses
                  .filter((e) => !e.isTombstone && e.groupId === group.id)
                  .reduce((sum, e) => sum + e.totalMinor, 0)

                return (
                  <div
                    key={group.id}
                    className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl flex flex-col justify-between space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-base">{kind?.emoji || '👥'}</span>
                        <h4 className="font-bold text-xs text-[var(--color-text)] truncate">
                          {group.name}
                        </h4>
                      </div>
                      <span className="currency-badge">{group.currency.code}</span>
                    </div>

                    <div className="pt-2 border-t border-[var(--color-border-subtle)] flex items-baseline justify-between text-xs">
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        Mutual Group Slice:
                      </span>
                      <span
                        className={`font-mono font-bold text-xs ${
                          groupSliceAmount > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : groupSliceAmount < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-[var(--color-text-muted)]'
                        }`}
                      >
                        {groupSliceAmount > 0 ? '+' : ''}
                        {formatMoney(groupSliceAmount, group.currency)}
                        {groupSliceAmount === 0 && ' (All Square)'}
                      </span>
                    </div>

                    <div className="text-[10px] text-[var(--color-text-muted)]">
                      Total Group Pool: {formatMoney(totalGroupSpend, group.currency)} · {group.memberIds.length} members
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* SECTION 3: SHARED TRANSACTIONS HISTORY */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-text-muted)]">
              Shared Transactions ({mutualTransactions.length})
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Click any transaction for split shares
            </span>
          </div>

          {mutualTransactions.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] py-4 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
              No mutual transactions recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-[var(--color-border-subtle)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-h-60 overflow-y-auto">
              {mutualTransactions.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => onSelectActivity && onSelectActivity(tx.id, tx.isSettlement)}
                  className="p-3.5 flex items-center justify-between text-xs hover:bg-[var(--color-surface-subtle)] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-primary text-sm shrink-0">
                      <CategoryIcon category={tx.emoji} size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-[var(--color-text)]">{tx.title}</p>
                        {tx.isLoan && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                            Loan
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                        {new Date(Math.floor(tx.createdAtMicros / 1000)).toLocaleDateString()} ·{' '}
                        {tx.paidByMe ? 'You paid' : `${friend.name} paid`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`font-mono font-bold ${
                        tx.paidByMe
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {tx.paidByMe ? '+' : '\u2212'}
                      {formatMoney(tx.relevantMinor, tx.currency)}
                    </span>
                    <span className="block text-[10px] text-[var(--color-text-muted)]">
                      {tx.paidByMe ? 'they owe' : 'you owe'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onEditFriend && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onEditFriend(friend)
                }}
                className="px-3 py-1.5 bg-[var(--color-surface)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Edit Profile
              </button>
            )}
            {onRemoveFriend && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onRemoveFriend(friend)
                }}
                className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold text-xs rounded-xl border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
              >
                Remove
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)] font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
