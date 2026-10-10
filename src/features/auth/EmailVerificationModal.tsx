import React, { useState, useEffect } from 'react'
import { Modal } from '../../ui/components/Modal'
import { Icon } from '../../ui/components/Icon'
import { defaultAuthVerificationService } from '../../services/auth/authVerificationService'
import { useStore } from '../../ui/storeContext'

interface EmailVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  initialEmail?: string
}

export const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
}) => {
  const { store } = useStore()
  const me = store.me

  const [emailInput, setEmailInput] = useState(initialEmail || me?.email || '')
  const [step, setStep] = useState<'input' | 'verify'>('input')
  const [otpInput, setOtpInput] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [remainingAttempts, setRemainingAttempts] = useState<number>(5)

  // Listen for local/dev notifications
  useEffect(() => {
    const unsub = defaultAuthVerificationService.subscribeNotifications((notice) => {
      if (notice.type === 'email' && notice.target.toLowerCase() === emailInput.trim().toLowerCase()) {
        setDevOtp(notice.otp)
      }
    })
    return () => unsub()
  }, [emailInput])

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!emailInput.trim() || !emailInput.includes('@')) {
      setErrorMsg('Please enter a valid email address.')
      return
    }

    setLoading(true)
    setErrorMsg(null)

    const res = await defaultAuthVerificationService.requestEmailOtp(emailInput)
    setLoading(false)

    if (res.success) {
      setStep('verify')
      setCooldown(60)
      setOtpInput('')
      setRemainingAttempts(5)
    } else {
      setErrorMsg(res.error || 'Failed to send verification code.')
      if (res.cooldownSeconds) setCooldown(res.cooldownSeconds)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otpInput.length !== 6) {
      setErrorMsg('Please enter the full 6-digit code.')
      return
    }

    setLoading(true)
    setErrorMsg(null)

    const res = await defaultAuthVerificationService.verifyEmailOtp(otpInput)
    setLoading(false)

    if (res.success) {
      await store.updateLocalProfile({
        email: emailInput.trim().toLowerCase(),
        emailVerified: true,
      })
      onClose()
    } else {
      if (res.error === 'MAX_ATTEMPTS_EXCEEDED') {
        setErrorMsg('Maximum verification attempts exceeded. Please request a new code.')
        setRemainingAttempts(0)
      } else if (res.error === 'EXPIRED') {
        setErrorMsg('The verification code has expired. Please request a new one.')
      } else {
        setErrorMsg(`Invalid verification code. ${res.remainingAttempts} attempt(s) remaining.`)
        setRemainingAttempts(res.remainingAttempts)
      }
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Verify Email Address">
      <div className="space-y-4 text-sm">
        {step === 'input' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Your Email Address
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                  <Icon name="mail" size={16} />
                </span>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="name@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 text-[var(--color-text)]"
                />
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
                We will send a single-use 6-digit security code to verify ownership.
              </p>
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
                disabled={loading}
                className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover disabled:opacity-50 rounded-xl shadow-md transition-all inline-flex items-center gap-1.5 active:scale-95"
              >
                {loading ? <Icon name="reload" size={14} className="animate-spin" /> : <Icon name="send" size={14} />}
                <span>Send Code</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-primary-subtle text-primary border border-primary-border flex items-center justify-center mx-auto shadow-sm">
                <Icon name="mail" size={24} />
              </div>
              <h4 className="font-bold text-sm text-[var(--color-text)]">Check your inbox</h4>
              <p className="text-xs text-[var(--color-text-muted)]">
                We sent a 6-digit code to <span className="font-bold text-[var(--color-text)]">{emailInput}</span>
              </p>
            </div>

            {/* Real Delivery or Dev Simulator Notice */}
            {defaultAuthVerificationService.getEmailProvider().id !== 'stub' ? (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Icon name="mail" size={14} className="text-blue-600 dark:text-blue-400" />
                  <span>Real Email Sent!</span>
                </div>
                <p className="text-[11px] opacity-90">
                  Dispatched to <strong>{emailInput}</strong> via {defaultAuthVerificationService.getEmailProvider().name}. Check your inbox or spam folder!
                </p>
              </div>
            ) : devOtp ? (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs space-y-1 animate-fade-in">
                <div className="flex items-center justify-between font-bold">
                  <span>Simulated Email Notification (Dev Mode)</span>
                  <span className="font-mono text-sm tracking-widest bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded">
                    {devOtp}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setOtpInput(devOtp)}
                  className="text-[11px] underline font-semibold text-emerald-700 dark:text-emerald-300"
                >
                  Click to auto-fill code
                </button>
              </div>
            ) : null}

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1 text-center">
                Enter 6-Digit Code
              </label>
              <input
                type="text"
                required
                autoFocus
                maxLength={6}
                pattern="[0-9]{6}"
                placeholder="••••••"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                className="w-full py-3 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl font-mono text-center text-2xl tracking-[0.4em] font-extrabold focus:outline-none focus:ring-2 focus:ring-primary/20 text-[var(--color-text)]"
              />
              <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)] mt-1.5 px-1">
                <span>Code expires in 10 minutes</span>
                <span>{remainingAttempts} attempt(s) remaining</span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium rounded-xl">
                {errorMsg}
              </div>
            )}

            <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between">
              <button
                type="button"
                disabled={cooldown > 0 || loading}
                onClick={() => handleRequestOtp()}
                className="text-xs font-bold text-primary hover:underline disabled:opacity-50 disabled:no-underline"
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)] transition-colors"
                >
                  Change Email
                </button>
                <button
                  type="submit"
                  disabled={otpInput.length !== 6 || loading}
                  className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover disabled:opacity-50 rounded-xl shadow-md transition-all inline-flex items-center gap-1.5 active:scale-95"
                >
                  <Icon name="check" size={14} />
                  <span>Verify Email</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
