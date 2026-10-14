import React, { useState, useEffect } from 'react'
import { defaultAuthService, type UserAccount, type UsernameCheckResult } from '../../services/auth/authService'
import { SupportedCurrencies, type CurrencyCode } from '../../domain/money'
import { Icon } from '../../ui/components/Icon'
import { Select } from '../../ui/components/Select'

interface AuthScreenProps {
  onAuthenticated: (account: UserAccount, currency?: CurrencyCode) => void
}

type AuthMode = 'login' | 'signup' | 'guest'

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<AuthMode>('login')

  // Form Fields
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(SupportedCurrencies[0])

  // Status & Feedback
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheckResult>({
    available: true,
    status: 'idle',
    message: '',
  })
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)

  // Real-time username check on signup
  useEffect(() => {
    if (mode !== 'signup') return
    const clean = username.trim().toLowerCase().replace(/^@/, '')
    if (!clean) {
      setUsernameCheck({ available: true, status: 'idle', message: '' })
      setIsCheckingUsername(false)
      return
    }

    setIsCheckingUsername(true)
    const timer = setTimeout(async () => {
      const res = await defaultAuthService.checkUsernameAvailability(clean)
      setUsernameCheck(res)
      setIsCheckingUsername(false)
    }, 350)

    return () => clearTimeout(timer)
  }, [username, mode])

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setLoading(true)

    try {
      const res = await defaultAuthService.login(username, password)
      if (!res.success || !res.account) {
        setErrorMessage(res.error || 'Failed to log in.')
        return
      }
      onAuthenticated(res.account)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const clean = username.trim().toLowerCase().replace(/^@/, '')
    if (clean) {
      if (usernameCheck.status === 'unavailable' || usernameCheck.status === 'invalid') {
        setErrorMessage(usernameCheck.message || 'Please choose an available username.')
        return
      }
      const check = await defaultAuthService.checkUsernameAvailability(clean)
      if (!check.available) {
        setUsernameCheck(check)
        setErrorMessage(check.message)
        return
      }
    }

    setLoading(true)

    try {
      const res = await defaultAuthService.register({
        name: displayName.trim() || 'You',
        username: clean,
        password: password,
      })
      if (!res.success || !res.account) {
        setErrorMessage(res.error || 'Registration failed.')
        return
      }
      onAuthenticated(res.account, selectedCurrency)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setLoading(true)

    try {
      const res = await defaultAuthService.loginAsGuest(displayName.trim() || 'Guest User')
      onAuthenticated(res.account, selectedCurrency)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Guest setup failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[var(--color-bg)] text-[var(--color-text)] animate-fade-in">
      <div className="w-full max-w-md p-6 sm:p-8 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl hero-gradient text-white flex items-center justify-center mx-auto shadow-md">
            <Icon name="rupee" size={30} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">
            SplitPay
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] max-w-xs mx-auto">
            Local-first shared expense splitting, group ledger & instant debt settlement
          </p>
        </div>

        {/* Mode Navigation Tabs */}
        <div className="flex p-1 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setErrorMessage(null)
            }}
            className={`flex-1 py-2 rounded-xl transition-all ${
              mode === 'login'
                ? 'bg-primary text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup')
              setErrorMessage(null)
            }}
            className={`flex-1 py-2 rounded-xl transition-all ${
              mode === 'signup'
                ? 'bg-primary text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('guest')
              setErrorMessage(null)
            }}
            className={`flex-1 py-2 rounded-xl transition-all ${
              mode === 'guest'
                ? 'bg-primary text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Guest Mode
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-fade-in">
            <Icon name="close" size={14} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* TAB 1: LOG IN */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Username or Handle
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-[var(--color-text-muted)] font-mono text-sm">
                  @
                </span>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-sm text-[var(--color-text)] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs font-medium"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-md transition-all inline-flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Icon name="reload" size={16} className="animate-spin" />
                  <span>Logging In...</span>
                </>
              ) : (
                <>
                  <Icon name="check" size={16} />
                  <span>Log In to SplitPay</span>
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setMode('guest')}
                className="text-xs text-[var(--color-text-muted)] hover:text-primary font-semibold transition-colors"
              >
                Or continue instantly as Guest →
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: SIGN UP */}
        {mode === 'signup' && (
          <form onSubmit={handleSignupSubmit} className="space-y-3.5 animate-fade-in">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Your Name (Display Name)
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
                Unique Username
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-[var(--color-text-muted)] font-mono text-sm">
                  @
                </span>
                <input
                  type="text"
                  required
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
              {/* Availability Message */}
              <div className="mt-1 min-h-[16px]">
                {isCheckingUsername ? (
                  <p className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1 animate-pulse">
                    <span>Checking availability...</span>
                  </p>
                ) : usernameCheck.message ? (
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

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Create Password (min. 4 characters)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs font-medium"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Primary Currency
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

            <button
              type="submit"
              disabled={loading || (!usernameCheck.available && usernameCheck.status !== 'idle') || isCheckingUsername}
              className="w-full py-3 bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-2xl shadow-md transition-all inline-flex items-center justify-center gap-2 mt-2 press-bounce cursor-pointer"
            >
              {loading ? (
                <>
                  <Icon name="reload" size={16} className="animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <Icon name="check" size={16} />
                  <span>Create Account & Get Started</span>
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setMode('guest')}
                className="text-xs text-[var(--color-text-muted)] hover:text-primary font-semibold transition-colors"
              >
                Or continue as Guest without password →
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: GUEST MODE */}
        {mode === 'guest' && (
          <form onSubmit={handleGuestSubmit} className="space-y-4 animate-fade-in">
            <div className="p-4 bg-primary-subtle border border-primary-border rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <Icon name="smartphone" size={16} />
                <span>Instant Guest Mode</span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                No username or password required. All data is saved safely to your device&apos;s IndexedDB offline storage. You can secure your account anytime later in Settings.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Your Nickname (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Traveler / You"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-medium text-sm text-[var(--color-text)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Preferred Currency
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-md transition-all inline-flex items-center justify-center gap-2"
            >
              <Icon name="check" size={16} />
              <span>Start Using SplitPay as Guest</span>
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-xs text-[var(--color-text-muted)] hover:text-primary font-semibold transition-colors"
              >
                Already have an account? Log In →
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
