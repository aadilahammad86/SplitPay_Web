import React, { useState, useEffect } from 'react'
import { Modal } from '../../ui/components/Modal'
import { Select } from '../../ui/components/Select'
import { Switch } from '../../ui/components/Switch'
import { useStore } from '../../ui/storeContext'
import { useTheme } from '../../ui/themeContext'
import { SupportedCurrencies, type CurrencyCode } from '../../domain/money'
import type { ThemeMode, ColorPaletteId } from '../../ui/theme'
import { Icon } from '../../ui/components/Icon'
import { normalizeToE164 } from '../../domain/phone'
import { defaultAuthService, type UsernameCheckResult } from '../../services/auth/authService'

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const { store } = useStore()
  const { mode, setMode, palette, setPalette, availablePalettes } = useTheme()

  const [step, setStep] = useState<number>(0)
  const [displayName, setDisplayName] = useState(store.me?.name === 'You' ? '' : store.me?.name || '')
  const [username, setUsername] = useState(store.me?.handle || '')
  const [password, setPassword] = useState('')
  const [isGuestMode, setIsGuestMode] = useState(false)
  const [email, setEmail] = useState(store.me?.email || '')
  const [phone, setPhone] = useState(store.me?.phone || '')
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(SupportedCurrencies[0])
  const [submitting, setSubmitting] = useState(false)
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheckResult>({
    available: true,
    status: 'idle',
    message: '',
  })
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)

  // Real-time username check on onboarding
  useEffect(() => {
    if (isGuestMode) {
      setUsernameCheck({ available: true, status: 'idle', message: '' })
      setIsCheckingUsername(false)
      return
    }
    const clean = username.trim().toLowerCase().replace(/^@/, '')
    if (!clean) {
      setUsernameCheck({ available: true, status: 'idle', message: '' })
      setIsCheckingUsername(false)
      return
    }

    setIsCheckingUsername(true)
    const timer = setTimeout(async () => {
      const res = await defaultAuthService.checkUsernameAvailability(
        clean,
        store.me?.id,
        store.knownMeIds
      )
      setUsernameCheck(res)
      setIsCheckingUsername(false)
    }, 350)

    return () => clearTimeout(timer)
  }, [username, isGuestMode, store.me?.id, store.knownMeIds])

  const handleFinish = async () => {
    setSubmitting(true)
    try {
      let normalizedPhone: string | undefined
      if (phone.trim()) {
        const norm = normalizeToE164(phone.trim())
        if (norm.valid) normalizedPhone = norm.e164
      }

      if (isGuestMode) {
        await defaultAuthService.loginAsGuest(displayName.trim() || 'Guest')
      } else if (password.trim() && username.trim()) {
        await defaultAuthService.register({
          name: displayName.trim() || 'You',
          username: username.trim(),
          password: password.trim(),
          email: email.trim() || undefined,
          phone: normalizedPhone,
          isGuest: false,
        })
      }

      await store.updateLocalProfile({
        name: displayName.trim() || (isGuestMode ? 'Guest' : 'You'),
        handle: isGuestMode ? undefined : (username.trim() ? username.trim().replace(/^@/, '') : undefined),
        email: email.trim() || undefined,
        phone: normalizedPhone,
        phoneVerified: !!normalizedPhone,
        discoverableByPhone: true,
      })

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('splitpay_onboarding_completed', 'true')
      }
      onClose()
    } catch (err) {
      console.error('Failed to complete onboarding:', err)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleSkip = () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('splitpay_onboarding_completed', 'true')
    }
    onClose()
  }

  const stepsCount = 4

  return (
    <Modal isOpen={isOpen} onClose={handleSkip} title="" maxWidth="max-w-xl">
      <div className="space-y-6 pt-1 text-sm animate-fade-in">
        {/* Step Indicator & Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-primary text-white font-extrabold flex items-center justify-center text-sm shadow-sm">
              <Icon name="rupee" size={20} />
            </span>
            <div>
              <h2 className="font-extrabold text-sm text-[var(--color-text)]">
                Welcome to SplitPay
              </h2>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Step {step + 1} of {stepsCount}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-semibold transition-colors inline-flex items-center gap-1"
          >
            <span>Skip Tour</span>
            <Icon name="close" size={14} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[var(--color-surface-subtle)] h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300"
            style={{ width: `${((step + 1) / stepsCount) * 100}%` }}
          />
        </div>

        {/* STEP 0: Value-First Preview */}
        {step === 0 && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center space-y-1">
              <h3 className="text-lg sm:text-xl font-extrabold text-[var(--color-text)] tracking-tight">
                Splitting expenses without awkwardness or math errors
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] max-w-md mx-auto">
                SplitPay is designed from first principles with deterministic minor-unit math and local-first durability.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl space-y-1.5">
                <Icon name="lightning" size={24} className="text-primary" />
                <h4 className="font-bold text-xs text-[var(--color-text)]">Works Offline First</h4>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Every split saves safely to device IndexedDB first. Never lose pending changes.
                </p>
              </div>

              <div className="p-3.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl space-y-1.5">
                <Icon name="moneyHand" size={24} className="text-primary" />
                <h4 className="font-bold text-xs text-[var(--color-text)]">Smart Debt Settle</h4>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Solves debts in minimal transfers with exact source breakdowns across groups.
                </p>
              </div>

              <div className="p-3.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl space-y-1.5">
                <Icon name="smartphone" size={24} className="text-primary" />
                <h4 className="font-bold text-xs text-[var(--color-text)]">Multi-Device Sync</h4>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Installable PWA for iPhone, Android, Mac, and PC with real-time shared ledgers.
                </p>
              </div>
            </div>

            {/* Interactive Preview Teaser Card */}
            <div className="p-4 bg-primary-subtle border border-primary-border rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center">
                  <Icon name="beach" size={20} />
                </div>
                <div>
                  <p className="font-bold text-xs text-[var(--color-text)]">Weekend Getaway</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">₹12,000.00 split equally among friends</p>
                </div>
              </div>
              <span className="font-extrabold text-xs text-primary px-3 py-1 bg-[var(--color-surface)] border border-primary-border rounded-xl">
                ₹3,000.00 / person
              </span>
            </div>
          </div>
        )}

        {/* STEP 1: Personal Profile Setup */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h3 className="text-lg font-extrabold text-[var(--color-text)] tracking-tight">
                Set up your personal identity
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Tell us how you would like to appear on bills and statements.
              </p>
            </div>

            <div className="space-y-3.5 pt-1">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                  What should friends call you? (Display Name)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Rivera"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-medium text-sm text-[var(--color-text)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                  Unique Username / Handle
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-[var(--color-text-muted)] font-mono text-sm">
                    @
                  </span>
                  <input
                    type="text"
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={`w-full pl-8 pr-10 py-2.5 bg-[var(--color-surface-subtle)] border rounded-xl font-mono text-sm text-[var(--color-text)] focus:outline-none transition-colors ${
                      usernameCheck.status === 'unavailable' || usernameCheck.status === 'invalid'
                        ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                        : usernameCheck.status === 'available' && username.trim()
                          ? 'border-emerald-500/80 focus:ring-1 focus:ring-emerald-500'
                          : 'border-[var(--color-border)] focus:border-primary'
                    }`}
                  />
                  <div className="absolute right-3.5 top-2.5 flex items-center">
                    {isCheckingUsername ? (
                      <Icon name="reload" size={16} className="text-[var(--color-text-muted)] animate-spin" />
                    ) : usernameCheck.status === 'available' && username.trim() ? (
                      <Icon name="check" size={16} className="text-emerald-500" />
                    ) : usernameCheck.status === 'unavailable' ? (
                      <Icon name="close" size={16} className="text-rose-500" />
                    ) : usernameCheck.status === 'invalid' ? (
                      <Icon name="alert" size={16} className="text-amber-500" />
                    ) : null}
                  </div>
                </div>
                {/* Availability status message */}
                <div className="mt-1 min-h-[16px]">
                  {isCheckingUsername ? (
                    <p className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1 animate-pulse">
                      <span>Checking availability...</span>
                    </p>
                  ) : usernameCheck.message && !isGuestMode ? (
                    <p
                      className={`text-[11px] font-medium flex items-center gap-1 animate-fade-in ${
                        usernameCheck.status === 'available'
                          ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                          : usernameCheck.status === 'unavailable'
                            ? 'text-rose-600 dark:text-rose-400 font-semibold'
                            : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      <span>{usernameCheck.message}</span>
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Account Security / Password / Guest Mode Toggle */}
              <div className="p-3 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[var(--color-text)] block">Account Security</span>
                    <span className="text-[11px] text-[var(--color-text-muted)] block">Continue as guest without password</span>
                  </div>
                  <Switch
                    checked={isGuestMode}
                    onChange={setIsGuestMode}
                    size="sm"
                    ariaLabel="Continue as Guest"
                  />
                </div>

                {!isGuestMode ? (
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] mb-1">
                      Account Password
                    </label>
                    <input
                      type="password"
                      placeholder="Enter password (min 4 characters)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] focus:outline-none"
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    Guest mode active. No password required — data is saved to offline local storage.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-medium text-sm text-[var(--color-text)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                    Mobile Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-sm text-[var(--color-text)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                  Preferred Default Currency
                </label>
                <Select
                  value={selectedCurrency.code}
                  onChange={(val) => {
                    const c = SupportedCurrencies.find((curr) => curr.code === val)
                    if (c) setSelectedCurrency(c)
                  }}
                  options={SupportedCurrencies.map((c) => ({
                    value: c.code,
                    label: `${c.code} (${c.symbol})`,
                  }))}
                  ariaLabel="Preferred Default Currency"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Aesthetic Theme & Palette Picker */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h3 className="text-lg font-extrabold text-[var(--color-text)] tracking-tight">
                Tailor your aesthetic theme
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Every palette is designed to look gorgeous and accessible in both Light and Dark modes.
              </p>
            </div>

            {/* Light / Dark Mode selector */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                Mode
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['system', 'light', 'dark', 'amoled'] as ThemeMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`py-2 px-1 text-xs font-bold rounded-xl border capitalize transition-all flex items-center justify-center gap-1.5 ${
                      mode === m
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-[var(--color-surface-subtle)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    <Icon
                      name={m === 'system' ? 'monitor' : m === 'light' ? 'sun' : 'moon'}
                      size={14}
                    />
                    <span>{m === 'amoled' ? 'OLED' : m}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Color Palette Picker */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                Color Palette Accent
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {availablePalettes.map((p) => {
                  const isSelected = palette === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPalette(p.id as ColorPaletteId)}
                      className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/20 bg-primary-subtle'
                          : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)] hover:border-[var(--color-text-muted)]'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-full shrink-0 shadow-sm border border-white/20 flex items-center justify-center"
                        style={{ backgroundColor: p.swatchHex }}
                      >
                        {isSelected && <Icon name="check" size={11} className="text-white" />}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-bold text-xs text-[var(--color-text)] truncate">{p.name}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] capitalize">{p.id}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Live Interactive Preview Box */}
            <div className="p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Live Preview
              </span>
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-primary">Active Palette Applied</span>
                <span className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-xl shadow-sm">
                  Primary Button
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Ready to Start */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in text-center py-2">
            <div className="w-16 h-16 rounded-3xl bg-primary-subtle text-primary border border-primary-border flex items-center justify-center text-3xl mx-auto shadow-sm">
              <Icon name="check" size={32} />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-[var(--color-text)] tracking-tight">
                You're all set!
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] max-w-sm mx-auto leading-relaxed">
                Your personal SplitPay ledger is ready with deterministic minor-unit math and real-time cloud sync. Start adding your real friends, roommates, and expenses.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleFinish}
                disabled={submitting}
                className="w-full py-3.5 px-6 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-extrabold text-sm rounded-2xl shadow-lg transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <Icon name="reload" size={16} className="animate-spin" />
                ) : (
                  <Icon name="lightning" size={16} />
                )}
                <span>{submitting ? 'Setting up...' : 'Get Started →'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] transition-colors"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}

          {step < stepsCount - 1 ? (
            <button
              type="button"
              disabled={
                step === 1 &&
                !isGuestMode &&
                ((!usernameCheck.available && usernameCheck.status !== 'idle') || isCheckingUsername)
              }
              onClick={() => setStep(step + 1)}
              className="px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md transition-all press-bounce cursor-pointer"
            >
              Next →
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
