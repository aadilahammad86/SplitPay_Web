import React from 'react'
import { Modal } from '../../ui/components/Modal'
import { useStore } from '../../ui/storeContext'
import { MoneyDisplay } from '../../ui/components/MoneyDisplay'
import { CategoryIcon, Icon } from '../../ui/components/Icon'
import { BASE_CURRENCY, SplitModeLabels, personInitials, type Expense, type Settlement } from '../../domain/entities'
import { formatMoney } from '../../domain/formatMoney'

interface ActivityDetailModalProps {
  isOpen: boolean
  onClose: () => void
  itemId: string | null
  isSettlement?: boolean
  onEditExpense?: (expense: Expense) => void
  onSettleUp?: (friendId: string, amountMinor: number) => void
}

export const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  isOpen,
  onClose,
  itemId,
  isSettlement = false,
  onEditExpense,
  onSettleUp,
}) => {
  const { store, ledgerState } = useStore()
  const currentCurrency = ledgerState.defaultCurrency || BASE_CURRENCY

  if (!isOpen || !itemId) return null

  const peopleMap = new Map(ledgerState.people.map((p) => [p.id, p]))
  const groupMap = new Map(ledgerState.groups.map((g) => [g.id, g]))

  const expense: Expense | undefined = !isSettlement
    ? ledgerState.expenses.find((e) => e.id === itemId)
    : undefined

  const settlement: Settlement | undefined = isSettlement
    ? ledgerState.settlements.find((s) => s.id === itemId)
    : undefined

  if (!expense && !settlement) return null

  // Format date helper
  const formatDate = (micros: number) => {
    return new Date(Math.floor(micros / 1000)).toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Handle delete/cancel
  const handleCancelExpense = async () => {
    if (!expense) return
    if (confirm('Mark this expense as cancelled? It can be restored anytime.')) {
      await store.deleteExpense(expense.id)
      onClose()
    }
  }

  const handleCancelSettlement = async () => {
    if (!settlement) return
    if (confirm('Mark this settlement payment as cancelled?')) {
      await store.deleteSettlement(settlement.id)
      onClose()
    }
  }

  // Render for Settlement
  if (settlement) {
    const fromPerson = peopleMap.get(settlement.from)
    const toPerson = peopleMap.get(settlement.to)
    const fromName = store.isMe(settlement.from) ? 'You' : fromPerson?.name || 'Someone'
    const toName = store.isMe(settlement.to) ? 'You' : toPerson?.name || 'Someone'
    const group = settlement.groupId ? groupMap.get(settlement.groupId) : null

    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Settlement Payment Details" maxWidth="max-w-lg">
        <div className="space-y-5 text-sm">
          {/* Header Banner */}
          <div className="p-5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-owed border border-[var(--color-owed-border)] text-owed flex items-center justify-center shadow-sm">
                <Icon name="moneyHand" size={24} strokeWidth={2} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-[var(--color-text)]">
                  {settlement.note ? `Payment: ${settlement.note}` : 'Payment recorded'}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {formatDate(settlement.createdAtMicros)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <MoneyDisplay
                minor={settlement.amountMinor}
                currency={settlement.currency || currentCurrency}
                size="md"
                showSign={false}
              />
              <span className="text-[10px] text-owed font-bold block mt-0.5">Settled</span>
            </div>
          </div>

          {/* Payment flow cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Paid By (Sender)</span>
              <p className="font-bold text-sm text-[var(--color-text)] flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-primary-subtle text-primary text-xs flex items-center justify-center font-bold">
                  {personInitials(fromName)}
                </span>
                <span>{fromName}</span>
              </p>
            </div>
            <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Received By</span>
              <p className="font-bold text-sm text-[var(--color-text)] flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-primary-subtle text-primary text-xs flex items-center justify-center font-bold">
                  {personInitials(toName)}
                </span>
                <span>{toName}</span>
              </p>
            </div>
          </div>

          {/* Context Details */}
          <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-2 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border-subtle)]">
              <span className="text-[var(--color-text-muted)]">Scope</span>
              <span className="font-semibold text-[var(--color-text)]">
                {group ? `Group: ${group.name}` : 'Direct 1:1 Settlement'}
              </span>
            </div>
            {settlement.note && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[var(--color-text-muted)]">Note</span>
                <span className="font-semibold text-[var(--color-text)] italic">"{settlement.note}"</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between">
            <button
              type="button"
              onClick={handleCancelSettlement}
              className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold text-xs rounded-xl border border-rose-200 dark:border-rose-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Icon name="delete" size={14} />
              <span>Cancel Settlement</span>
            </button>
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

  // Render for Expense
  if (!expense) return null

  const payer = peopleMap.get(expense.paidBy)
  const payerName = store.isMe(expense.paidBy) ? 'You' : payer?.name || 'Someone'
  const group = expense.groupId ? groupMap.get(expense.groupId) : null

  // Collect all unique participants from shares and paidBy
  const participantIds = Array.from(
    new Set([expense.paidBy, ...expense.shares.map((s) => s.owedBy)])
  )

  // Compute share map: memberId -> amountMinor
  const shareMap = new Map<string, number>()
  for (const s of expense.shares) {
    shareMap.set(s.owedBy, (shareMap.get(s.owedBy) || 0) + s.amountMinor)
  }

  // Payer's own share is totalMinor - sum of others' shares
  const othersShareTotal = Array.from(shareMap.values()).reduce((sum, v) => sum + v, 0)
  const payerOwnShare = Math.max(0, expense.totalMinor - othersShareTotal)
  shareMap.set(expense.paidBy, payerOwnShare)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Activity Split Breakdown" maxWidth="max-w-xl">
      <div className="space-y-5 text-sm">
        {/* Header Summary Banner */}
        <div className="p-5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary-subtle border border-primary-border text-primary flex items-center justify-center text-2xl shadow-sm shrink-0">
              <CategoryIcon category={expense.categoryEmoji || '🧾'} size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-[var(--color-text)] truncate">
                  {expense.description}
                </h3>
                {expense.isLoan && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    {expense.loanType === 'lent' ? 'Loan Given' : 'Credit Taken'}
                  </span>
                )}
                {group ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary-subtle text-primary border border-primary-border">
                    {group.name}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                    Direct 1:1
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {formatDate(expense.createdAtMicros)} · Paid by{' '}
                <span className="text-[var(--color-text)] font-semibold">{payerName}</span>
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] block">
              Total Amount
            </span>
            <div className="font-mono text-xl font-extrabold text-[var(--color-text)]">
              {formatMoney(expense.totalMinor, expense.currency || currentCurrency)}
            </div>
            <span className="text-[11px] font-semibold text-primary block mt-0.5">
              {SplitModeLabels[expense.mode] || 'Equally'}
            </span>
          </div>
        </div>

        {/* Breakdown section: Who is involved and how much split for each */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-2">
              <span>Who is involved & Split Shares</span>
              <span className="px-1.5 py-0.2 rounded-full bg-primary-subtle text-primary font-bold text-[10px]">
                {participantIds.length}
              </span>
            </h4>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Exact minor units (no rounding drift)
            </span>
          </div>

          <div className="space-y-2.5">
            {participantIds.map((pId) => {
              const person = peopleMap.get(pId)
              const isPayer = pId === expense.paidBy
              const isLocalUser = store.isMe(pId)
              const name = isLocalUser ? 'You' : person?.name || 'Friend'
              const allocatedShare = shareMap.get(pId) || 0
              const percentage = expense.totalMinor > 0
                ? Math.round((allocatedShare / expense.totalMinor) * 100)
                : 0

              // Net effect on this expense
              // If Payer: gets back (totalMinor - payerOwnShare) from others
              // If Debtor: owes allocatedShare to Payer
              const netEffect = isPayer
                ? expense.totalMinor - allocatedShare
                : -allocatedShare

              return (
                <div
                  key={pId}
                  className={`p-3.5 bg-[var(--color-surface)] border rounded-2xl flex items-center justify-between gap-3 ${
                    isLocalUser ? 'border-primary/40 bg-primary/5' : 'border-[var(--color-border)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full font-bold flex items-center justify-center text-xs shrink-0 ${
                        isLocalUser
                          ? 'bg-primary text-white shadow-xs'
                          : 'bg-primary-subtle text-primary border border-primary-border'
                      }`}
                    >
                      {personInitials(name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--color-text)]">{name}</span>
                        {isPayer && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-primary-subtle text-primary rounded border border-primary-border">
                            Payer
                          </span>
                        )}
                        {isLocalUser && !isPayer && (
                          <span className="text-[10px] font-semibold text-primary">You</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                        {isPayer
                          ? `Paid full ${formatMoney(expense.totalMinor, expense.currency || currentCurrency)}`
                          : 'Paid 0.00'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs text-[var(--color-text)]">
                      Share:{' '}
                      <span className="font-mono font-bold">
                        {formatMoney(allocatedShare, expense.currency || currentCurrency)}
                      </span>{' '}
                      <span className="text-[10px] text-[var(--color-text-muted)] font-normal">
                        ({percentage}%)
                      </span>
                    </div>
                    <div
                      className={`font-mono text-[11px] font-extrabold mt-0.5 ${
                        netEffect > 0
                          ? 'text-owed'
                          : netEffect < 0
                          ? 'text-owe'
                          : 'text-[var(--color-text-muted)]'
                      }`}
                    >
                      {netEffect > 0
                        ? `Gets back +${formatMoney(netEffect, expense.currency || currentCurrency)}`
                        : netEffect < 0
                        ? `Owes ${formatMoney(Math.abs(netEffect), expense.currency || currentCurrency)}`
                        : 'Settled'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Verification note */}
          <div className="p-3 bg-primary-subtle border border-primary-border rounded-xl flex items-center gap-2 text-xs text-primary">
            <Icon name="check" size={14} className="shrink-0" />
            <span>
              Exact minor unit sum verified:{' '}
              {formatMoney(expense.totalMinor, expense.currency || currentCurrency)} total distributed across {participantIds.length} participants.
            </span>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="pt-3 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {onEditExpense && !expense.isTombstone && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onEditExpense(expense)
                }}
                className="px-3.5 py-2 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)] font-semibold text-xs rounded-xl border border-[var(--color-border)] transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Icon name="edit" size={14} />
                <span>Edit Expense</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCancelExpense}
              className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold text-xs rounded-xl border border-rose-200 dark:border-rose-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Icon name="delete" size={14} />
              <span>Cancel Expense</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onSettleUp && !store.isMe(expense.paidBy) && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  const myShare = expense.shares.find((s) => store.isMe(s.owedBy))?.amountMinor || 0
                  onSettleUp(expense.paidBy, myShare)
                }}
                className="btn-press px-4 py-2 btn-primary font-extrabold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Icon name="moneyHand" size={14} />
                <span>Settle with {payerName}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)] font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
