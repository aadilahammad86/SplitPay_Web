import React, { useState } from 'react'
import { Modal } from '../../ui/components/Modal'
import { useStore } from '../../ui/storeContext'
import { BASE_CURRENCY, type LoanType } from '../../domain/entities'
import { Icon } from '../../ui/components/Icon'

interface AddLoanCreditModalProps {
  isOpen: boolean
  onClose: () => void
  initialType?: LoanType
  initialFriendId?: string | null
}

export const AddLoanCreditModal: React.FC<AddLoanCreditModalProps> = ({
  isOpen,
  onClose,
  initialType = 'lent',
  initialFriendId = null,
}) => {
  const { store, ledgerState } = useStore()
  const currentCurrency = ledgerState.defaultCurrency || BASE_CURRENCY

  const [loanType, setLoanType] = useState<LoanType>(initialType)
  const [selectedFriendId, setSelectedFriendId] = useState<string>(initialFriendId || '')
  const [amountStr, setAmountStr] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [dueDateStr, setDueDateStr] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [prevOpen, setPrevOpen] = useState(isOpen)
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen)
    if (isOpen) {
      setLoanType(initialType)
      setSelectedFriendId(initialFriendId || '')
      setError(null)
    }
  }

  const validFriends = ledgerState.people.filter(
    (p) =>
      !store.isMe(p.id) &&
      p.name !== 'You' &&
      p.name !== 'SplitPay Friend' &&
      p.name !== 'Guest User' &&
      !p.id.startsWith('invited_') &&
      p.name.trim() !== ''
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedFriendId) {
      setError('Please select a friend for this entry.')
      return
    }

    const floatVal = parseFloat(amountStr)
    if (isNaN(floatVal) || floatVal <= 0) {
      setError('Please enter a valid positive amount.')
      return
    }

    const scale = currentCurrency.scale || 100
    const amountMinor = Math.round(floatVal * scale)

    let dueDateMicros: number | undefined
    if (dueDateStr) {
      const parsedTime = new Date(dueDateStr).getTime()
      if (!isNaN(parsedTime)) {
        dueDateMicros = parsedTime * 1000
      }
    }

    try {
      setSubmitting(true)
      await store.addLoanCredit({
        type: loanType,
        friendId: selectedFriendId,
        amountMinor,
        currency: currentCurrency,
        description: description.trim() || undefined,
        dueDateMicros,
      })

      // Reset & close
      setAmountStr('')
      setDescription('')
      setDueDateStr('')
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record entry.')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedFriend = validFriends.find((f) => f.id === selectedFriendId)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={loanType === 'lent' ? 'Give a Loan (You Lent Money)' : 'Take Credit (You Borrowed Money)'}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {/* Toggle Loan Given vs Credit Taken */}
        <div className="grid grid-cols-2 p-1 bg-[var(--color-surface-subtle)] rounded-xl border border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => setLoanType('lent')}
            className={`py-2 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              loanType === 'lent'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <span>💸</span>
            <span>I Lent Money (Loan Given)</span>
          </button>
          <button
            type="button"
            onClick={() => setLoanType('borrowed')}
            className={`py-2 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              loanType === 'borrowed'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <span>📥</span>
            <span>I Borrowed (Credit Taken)</span>
          </button>
        </div>

        {/* Informational Callout */}
        <div className="p-3 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text-muted)]">
          {loanType === 'lent' ? (
            <span>
              You gave money directly to{' '}
              <strong className="text-[var(--color-text)]">
                {selectedFriend?.name || 'your friend'}
              </strong>
              . This creates an immediate asset: they owe you this full amount.
            </span>
          ) : (
            <span>
              You borrowed money directly from{' '}
              <strong className="text-[var(--color-text)]">
                {selectedFriend?.name || 'your friend'}
              </strong>
              . This creates an immediate liability: you owe them this full amount.
            </span>
          )}
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Friend Selector */}
        <div>
          <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
            {loanType === 'lent' ? 'Who did you lend money to?' : 'Who did you borrow money from?'}
          </label>
          <select
            value={selectedFriendId}
            onChange={(e) => setSelectedFriendId(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">-- Select a Friend --</option>
            {validFriends.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} {f.handle ? `(@${f.handle})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
            Amount ({currentCurrency.code})
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-sm text-[var(--color-text-muted)]">
              {currentCurrency.symbol}
            </span>
            <input
              type="number"
              step="any"
              required
              min="0.01"
              placeholder="0.00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-base font-bold text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Description / Reason */}
        <div>
          <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
            Note / Purpose (Optional)
          </label>
          <input
            type="text"
            placeholder={loanType === 'lent' ? 'e.g. Rent advance, emergency cash' : 'e.g. Dinner cash borrowed'}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl text-xs font-medium text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Due Date */}
        <div>
          <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
            Repayment Target Due Date (Optional)
          </label>
          <input
            type="date"
            value={dueDateStr}
            onChange={(e) => setDueDateStr(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl text-xs font-medium text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 text-xs font-extrabold text-slate-950 bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-md transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Icon name="check" size={14} />
            <span>{submitting ? 'Saving...' : loanType === 'lent' ? 'Record Loan Given' : 'Record Credit Taken'}</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}
