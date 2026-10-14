import React from 'react'
import type { CurrencyCode } from '../../domain/money'
import { formatMoney } from '../../domain/formatMoney'

interface SettleSuccessProps {
  amountMinor: number
  currency: CurrencyCode
  friendName: string
  onDone: () => void
}

/**
 * Full-card success state after a settle-up is confirmed.
 * Animated checkmark draws in via CSS, amount and friend name
 * fade up. Designed to replace the modal content, not overlay it.
 */
export const SettleSuccess: React.FC<SettleSuccessProps> = ({
  amountMinor,
  currency,
  friendName,
  onDone,
}) => (
  <div className="flex flex-col items-center justify-center py-10 space-y-5 animate-fade-in">
    {/* Animated checkmark circle */}
    <div
      className="w-20 h-20 rounded-full bg-[var(--color-owed-bg,var(--color-positive-bg))]
                  border-2 border-[var(--color-owed,var(--color-positive))]
                  flex items-center justify-center animate-check-pop"
    >
      <svg
        className="w-10 h-10 text-[var(--color-owed,var(--color-positive))]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 13l4 4L19 7" className="animate-check-draw" />
      </svg>
    </div>

    {/* Confirmation text */}
    <h3 className="text-xl font-bold text-[var(--color-text)]">Settled!</h3>
    <p className="text-sm text-[var(--color-text-muted)] text-center max-w-xs leading-relaxed">
      <span className="font-money font-bold text-[var(--color-text)]">
        {formatMoney(amountMinor, currency)}
      </span>{' '}
      payment with{' '}
      <span className="font-semibold text-[var(--color-text)]">{friendName}</span>{' '}
      recorded in the ledger
    </p>

    {/* Done button */}
    <button
      type="button"
      onClick={onDone}
      className="btn-press px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]
                 text-[var(--color-primary-text,#fff)] text-sm font-bold rounded-xl
                 shadow-[var(--shadow-sm)] transition-all"
    >
      Done
    </button>
  </div>
)
