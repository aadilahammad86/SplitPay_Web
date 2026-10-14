import React, { useState, useEffect } from 'react'
import { Modal } from '../../ui/components/Modal'
import { Select } from '../../ui/components/Select'
import { useStore } from '../../ui/storeContext'
import type { CurrencyCode } from '../../domain/money'
import { SupportedCurrencies } from '../../domain/money'
import { BASE_CURRENCY } from '../../domain/entities'
import { Icon } from '../../ui/components/Icon'
import { SettleSuccess } from './SettleSuccess'

interface SettleUpModalProps {
  isOpen: boolean
  onClose: () => void
  initialFriendId?: string | null
  initialAmountMinor?: number
  initialGroupId?: string | null
  initialFromId?: string | null
  initialToId?: string | null
}

export const SettleUpModal: React.FC<SettleUpModalProps> = ({
  isOpen,
  onClose,
  initialFriendId = null,
  initialAmountMinor = 0,
  initialGroupId = null,
  initialFromId = null,
  initialToId = null,
}) => {
  const { store, ledgerState } = useStore()
  const me = store.me

  const meId = ledgerState.localPersonId || ''

  const [from, setFrom] = useState(() => {
    if (initialFromId) return initialFromId
    if (initialFriendId) {
      return initialAmountMinor < 0 ? meId : initialFriendId
    }
    return meId
  })

  const [to, setTo] = useState(() => {
    if (initialToId) return initialToId
    if (initialFriendId) {
      return initialAmountMinor < 0 ? initialFriendId : meId
    }
    const other = ledgerState.people.find((p) => p.id !== meId)
    return other?.id || ''
  })

  const [amountStr, setAmountStr] = useState(() => {
    if (initialAmountMinor !== 0) {
      return (Math.abs(initialAmountMinor) / 100).toFixed(2)
    }
    return ''
  })

  const [currency, setCurrency] = useState<CurrencyCode>(
    () => ledgerState.defaultCurrency || BASE_CURRENCY
  )
  const [groupId, setGroupId] = useState<string | null>(initialGroupId)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [settledInfo, setSettledInfo] = useState<{
    amountMinor: number
    currency: CurrencyCode
    friendName: string
  } | null>(null)

  const handleModalClose = () => {
    onClose()
  }

  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setSettledInfo(null)
        setError(null)
      }, 250)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const totalMinor = Math.round((parseFloat(amountStr) || 0) * currency.scale)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!from || !to) {
      setError('Please select both payer and payee.')
      return
    }
    if (from === to) {
      setError('Payer and payee cannot be the same person.')
      return
    }
    if (isNaN(totalMinor) || totalMinor <= 0) {
      setError('Please enter a valid payment amount.')
      return
    }

    try {
      await store.addSettlement({
        from,
        to,
        amountMinor: totalMinor,
        currency,
        groupId,
        note: note.trim(),
      })
      const otherPersonId = from === meId ? to : from
      const otherPerson = ledgerState.people.find((p) => p.id === otherPersonId)
      setSettledInfo({
        amountMinor: totalMinor,
        currency,
        friendName: otherPerson?.name || 'Friend',
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (settledInfo) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleModalClose}
        title={
          <span className="flex items-center gap-2">
            <Icon name="check" size={18} className="text-emerald-500" />
            <span>Settled Up</span>
          </span>
        }
      >
        <SettleSuccess
          amountMinor={settledInfo.amountMinor}
          currency={settledInfo.currency}
          friendName={settledInfo.friendName}
          onDone={handleModalClose}
        />
      </Modal>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title={
        <span className="flex items-center gap-2">
          <Icon name="moneyHand" size={20} className="text-emerald-500" />
          <span>Settle Up</span>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Payer and Payee */}
        <div className="grid grid-cols-2 gap-3 items-center">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Who paid?
            </label>
            <Select
              value={from}
              onChange={(val) => setFrom(val)}
              options={ledgerState.people.map((p) => ({
                value: p.id,
                label: p.id === me?.id ? 'You' : p.name,
              }))}
              ariaLabel="Who paid?"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Who received?
            </label>
            <Select
              value={to}
              onChange={(val) => setTo(val)}
              options={ledgerState.people.map((p) => ({
                value: p.id,
                label: p.id === me?.id ? 'You' : p.name,
              }))}
              ariaLabel="Who received?"
            />
          </div>
        </div>

        {/* Amount and Currency */}
        <div className="flex gap-2">
          <div className="w-32 shrink-0">
            <Select
              value={currency.code}
              onChange={(val) => {
                const found = SupportedCurrencies.find((c) => c.code === val)
                if (found) setCurrency(found)
              }}
              options={SupportedCurrencies.map((c) => ({
                value: c.code,
                label: `${c.code} (${c.symbol})`,
              }))}
              ariaLabel="Currency"
            />
          </div>
          <div className="relative flex-1">
            <input
              type="number"
              inputMode="decimal"
              step={currency.digits === 0 ? '1' : currency.digits === 3 ? '0.001' : '0.01'}
              min="0"
              required
              placeholder="0.00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="font-money w-full px-3.5 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl text-lg font-bold text-[var(--color-owed)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
        </div>

        {/* Optional Group */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
            Apply to Group (Optional)
          </label>
          <Select
            value={groupId ?? ''}
            onChange={(val) => setGroupId(val || null)}
            options={[
              { value: '', label: 'Direct settlement (reduces direct balance)' },
              ...ledgerState.groups.map((g) => ({
                value: g.id,
                label: g.name,
              })),
            ]}
            ariaLabel="Apply to Group (Optional)"
          />
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
            Payment Note (e.g. UPI, cash, bank transfer)
          </label>
          <input
            type="text"
            placeholder="e.g. Paid via Google Pay"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-medium"
          />
        </div>

        {/* Submit */}
        <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleModalClose}
            className="btn-press px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-press btn-primary px-5 py-2 text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
          >
            <Icon name="check" size={14} />
            <span>Record Payment</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}
