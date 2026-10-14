import React, { useState } from 'react'
import { Modal } from '../../ui/components/Modal'
import { Icon } from '../../ui/components/Icon'
import { Select } from '../../ui/components/Select'
import { normalizeToE164, formatE164Display } from '../../domain/phone'
import { useStore } from '../../ui/storeContext'

interface PhoneLinkingModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenEmailModal?: () => void
}

const COUNTRY_CODES = [
  { code: '+91', label: 'India (+91)' },
  { code: '+1', label: 'United States (+1)' },
  { code: '+44', label: 'United Kingdom (+44)' },
  { code: '+971', label: 'UAE (+971)' },
  { code: '+65', label: 'Singapore (+65)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+49', label: 'Germany (+49)' },
]

export const PhoneLinkingModal: React.FC<PhoneLinkingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { store, ledgerState } = useStore()
  const me = store.me

  const [countryPrefix, setCountryPrefix] = useState('+91')
  const [phoneNumber, setPhoneNumber] = useState(
    me?.phone ? me.phone.replace(/^\+\d{1,4}/, '') : ''
  )
  const [discoverable, setDiscoverable] = useState(me?.discoverableByPhone ?? true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const normalized = normalizeToE164(phoneNumber, countryPrefix)
    if (!normalized.valid) {
      setErrorMsg(normalized.error || 'Please enter a valid international phone number.')
      return
    }

    // Unique check: verify no other user in directory has this verified number
    const existing = ledgerState.people.find(
      (p) => p.id !== me?.id && p.phone === normalized.e164 && p.phoneVerified === true
    )
    if (existing) {
      setErrorMsg('This phone number is already registered to another account.')
      return
    }

    setLoading(true)
    try {
      await store.updateLocalProfile({
        phone: normalized.e164,
        phoneVerified: true,
        discoverableByPhone: discoverable,
      })
      onClose()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save phone number.')
    } finally {
      setLoading(false)
    }
  }

  const currentNormalized = normalizeToE164(phoneNumber, countryPrefix)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Link Phone Number">
      <form onSubmit={handleSavePhone} className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs text-[var(--color-text-muted)]">
            Register your mobile number so friends can recognize and discover you when syncing contacts.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
            Country & Phone Number
          </label>
          <div className="flex gap-2">
            <div className="w-40 shrink-0">
              <Select
                value={countryPrefix}
                onChange={(val) => setCountryPrefix(val)}
                options={COUNTRY_CODES.map((c) => ({
                  value: c.code,
                  label: c.label,
                }))}
              />
            </div>

            <div className="relative flex-1">
              <span className="absolute left-3 top-2.5 text-[var(--color-text-muted)]">
                <Icon name="phone" size={15} />
              </span>
              <input
                type="tel"
                autoFocus
                placeholder="9876543210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d\s\-()]/g, ''))}
                className="w-full pl-9 pr-3 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 text-[var(--color-text)]"
              />
            </div>
          </div>

          {currentNormalized.valid && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1 font-mono">
              <Icon name="check" size={12} />
              <span>International E.164: {formatE164Display(currentNormalized.e164)}</span>
            </p>
          )}
        </div>

        {/* Discoverability consent toggle */}
        <div className="p-3.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-[var(--color-text)] block">
              Allow friends to find me
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)] block leading-relaxed">
              When friends import their contacts, show my name so they can connect and split expenses. You can toggle this anytime in Settings.
            </span>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={discoverable}
              onChange={(e) => setDiscoverable(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-[var(--color-border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
          </label>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium rounded-xl">
            {errorMsg}
          </div>
        )}

        <div className="pt-2 border-t border-[var(--color-border)] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !currentNormalized.valid}
            className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover disabled:opacity-50 rounded-xl shadow-md transition-all inline-flex items-center gap-1.5"
          >
            {loading ? <Icon name="reload" size={14} className="animate-spin" /> : <Icon name="check" size={14} />}
            <span>Save Phone Number</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}
