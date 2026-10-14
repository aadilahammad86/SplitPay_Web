import React, { useState, useEffect, useCallback } from 'react'
import { useStore } from '../../ui/storeContext'
import { useTheme } from '../../ui/themeContext'
import type { ThemeMode, ColorPaletteId } from '../../ui/theme'
import { EmailVerificationModal } from '../auth/EmailVerificationModal'
import { PhoneLinkingModal } from '../auth/PhoneLinkingModal'
import { ContactSyncModal } from '../contacts/ContactSyncModal'
import { formatE164Display } from '../../domain/phone'
import { Icon, type IconName } from '../../ui/components/Icon'
import { Switch } from '../../ui/components/Switch'
import { defaultAuthService, type UsernameCheckResult, type UserAccount } from '../../services/auth/authService'
import { defaultDeviceService, type UserDevice } from '../../services/device/deviceService'
import { generateTotpSecret, formatSecretForDisplay, generateOtpAuthUri } from '../../domain/totp'
import { SupportedCurrencies, type CurrencyCode } from '../../domain/money'
import {
  defaultNotificationService,
  type NotificationPermissionStatus,
} from '../../services/notifications/notificationService'

interface SettingsViewProps {
  onOpenAdmin?: () => void
}

const CURRENCY_LABELS: Record<string, string> = {
  INR: 'Indian Rupee',
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  AED: 'UAE Dirham',
  JPY: 'Japanese Yen',
  KWD: 'Kuwaiti Dinar',
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenAdmin }) => {
  const {
    store,
    ledgerState,
  } = useStore()

  const { mode, setMode, palette, setPalette, availablePalettes } = useTheme()
  const me = store.me
  const [currentSession, setCurrentSession] = useState<UserAccount | null>(() =>
    defaultAuthService.getCurrentSession()
  )

  useEffect(() => {
    return defaultAuthService.subscribe((sess) => {
      setCurrentSession(sess)
    })
  }, [])

  // Multi-Device Management State (Strict 3-device limit)
  const [devices, setDevices] = useState<UserDevice[]>([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [deviceActionMsg, setDeviceActionMsg] = useState<string | null>(null)

  const loadDevices = useCallback(async () => {
    if (!currentSession?.id) return
    setDevicesLoading(true)
    try {
      const list = await defaultDeviceService.getRegisteredDevices(currentSession.id)
      setDevices(list)
    } catch {
      // ignore
    } finally {
      setDevicesLoading(false)
    }
  }, [currentSession])

  useEffect(() => {
    if (!currentSession?.id) return
    let active = true
    defaultDeviceService.getRegisteredDevices(currentSession.id).then((list) => {
      if (active) setDevices(list)
    }).catch(() => {})
    return () => {
      active = false
    }
  }, [currentSession?.id])

  const handleRevokeDevice = async (deviceId: string) => {
    if (!currentSession?.id) return
    if (confirm('Disconnect this device from your account? It will be required to log in again.')) {
      const success = await defaultDeviceService.revokeDevice(currentSession.id, deviceId)
      if (success) {
        setDeviceActionMsg('✓ Device disconnected successfully.')
        await loadDevices()
      } else {
        setDeviceActionMsg('Failed to disconnect device.')
      }
      setTimeout(() => setDeviceActionMsg(null), 3500)
    }
  }

  // Google Authenticator 2FA State
  const [showTotpSetup, setShowTotpSetup] = useState(false)
  const [totpSecret, setTotpSecret] = useState('')
  const [totpVerifyCode, setTotpVerifyCode] = useState('')
  const [totpError, setTotpError] = useState<string | null>(null)
  const [totpSuccessMsg, setTotpSuccessMsg] = useState<string | null>(null)
  const [totpCopyMsg, setTotpCopyMsg] = useState<string | null>(null)
  const [showTotpDisable, setShowTotpDisable] = useState(false)
  const [totpDisableCode, setTotpDisableCode] = useState('')

  const handleStartTotpSetup = () => {
    const sec = generateTotpSecret()
    setTotpSecret(sec)
    setTotpVerifyCode('')
    setTotpError(null)
    setShowTotpSetup(true)
  }

  const handleConfirmTotp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentSession?.id || !totpSecret) return
    setTotpError(null)

    const res = await defaultAuthService.enableTotp(
      currentSession.id,
      totpSecret,
      totpVerifyCode.trim()
    )

    if (!res.success) {
      setTotpError(res.error || 'Invalid 6-digit code. Please check your app and try again.')
      return
    }

    setShowTotpSetup(false)
    setTotpSecret('')
    setTotpVerifyCode('')
    setTotpSuccessMsg('✓ Google Authenticator 2FA activated successfully!')
    setTimeout(() => setTotpSuccessMsg(null), 4000)
  }

  const handleDisableTotp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentSession?.id) return
    setTotpError(null)

    const res = await defaultAuthService.disableTotp(
      currentSession.id,
      totpDisableCode.trim()
    )

    if (!res.success) {
      setTotpError(res.error || 'Invalid 6-digit code. Please try again.')
      return
    }

    setShowTotpDisable(false)
    setTotpDisableCode('')
    setTotpSuccessMsg('✓ Two-Factor Authentication disabled.')
    setTimeout(() => setTotpSuccessMsg(null), 4000)
  }

  const handleCopyTotpSecret = () => {
    if (!totpSecret) return
    navigator.clipboard.writeText(totpSecret)
    setTotpCopyMsg('Copied secret key to clipboard!')
    setTimeout(() => setTotpCopyMsg(null), 3000)
  }

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out of SplitPay?')) {
      defaultAuthService.logout()
    }
  }

  // Profile & Username
  const [profileName, setProfileName] = useState(me?.name || '')
  const [profileHandle, setProfileHandle] = useState(me?.handle || '')
  const [savedProfileMsg, setSavedProfileMsg] = useState(false)

  // Email & Phone Verification Modals
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [showContactsModal, setShowContactsModal] = useState(false)

  // Security / App Passcode
  const [hasPasscode, setHasPasscode] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return !!localStorage.getItem('splitpay_app_passcode')
    }
    return false
  })
  const [passcodeVal, setPasscodeVal] = useState('')
  const [confirmPasscodeVal, setConfirmPasscodeVal] = useState('')
  const [passcodeMsg, setPasscodeMsg] = useState<string | null>(null)
  const [showPasscodeForm, setShowPasscodeForm] = useState(false)

  // Username Availability Checking
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheckResult>({
    available: true,
    status: 'idle',
    message: '',
  })
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)

  // Backup & Restore
  const [backupMsg, setBackupMsg] = useState<string | null>(null)

  // Danger Zone / Data Clearing
  const [dataActionMsg, setDataActionMsg] = useState<string | null>(null)

  // Default Currency State
  const [currencyMsg, setCurrencyMsg] = useState<string | null>(null)

  const handleSelectCurrency = async (curr: CurrencyCode) => {
    await store.setDefaultCurrency(curr)
    setCurrencyMsg(`✓ Default currency updated to ${curr.code} (${curr.symbol})`)
    setTimeout(() => setCurrencyMsg(null), 3000)
  }

  // Notifications State
  const [notifEnabled, setNotifEnabled] = useState(() => defaultNotificationService.isEnabled())
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionStatus>(() =>
    defaultNotificationService.getPermission()
  )
  const [notifMsg, setNotifMsg] = useState<string | null>(null)

  const handleToggleNotifications = (val: boolean) => {
    setNotifEnabled(val)
    defaultNotificationService.setEnabled(val)
    setNotifMsg(val ? '✓ In-app and browser notifications enabled' : 'Notifications disabled')
    setTimeout(() => setNotifMsg(null), 3000)
  }

  const handleRequestPermission = async () => {
    const granted = await defaultNotificationService.requestPermission()
    setNotifPermission(defaultNotificationService.getPermission())
    if (granted) {
      setNotifMsg('✓ Browser notifications permitted!')
      defaultNotificationService.notify('Notifications Activated', {
        body: 'You will receive real-time updates when splits and payments arrive.',
        type: 'success',
      })
    } else {
      setNotifMsg('Notification permission was not granted by browser.')
    }
    setTimeout(() => setNotifMsg(null), 4000)
  }

  const handleSendTestNotification = () => {
    defaultNotificationService.notify('SplitPay Test Alert', {
      body: 'Notifications are working! New peer transactions will show up here.',
      type: 'info',
    })
    setNotifMsg('✓ Test notification dispatched!')
    setTimeout(() => setNotifMsg(null), 3000)
  }

  const handleClearTransactions = async () => {
    if (confirm('Are you sure you want to clear all expenses and settlements? Your balance sheet will reset to zero, while groups and friends will remain.')) {
      await store.clearExpensesAndSettlements()
      setDataActionMsg('✓ All expenses and settlements cleared.')
      setTimeout(() => setDataActionMsg(null), 3000)
    }
  }

  const handleClearAllLedgerData = async () => {
    if (confirm('Are you sure you want to clear ALL ledger data (expenses, settlements, groups, and friends)? Your personal account profile will be preserved.')) {
      await store.clearLedgerData(true)
      setDataActionMsg('✓ All ledger data, groups, and friends cleared.')
      setTimeout(() => setDataActionMsg(null), 3000)
    }
  }

  const handleFactoryReset = async () => {
    if (confirm('DANGER: Are you sure you want to perform a factory reset? This will erase all local databases, saved accounts, offline caches, and log you out. This action cannot be undone.')) {
      await store.factoryReset()
    }
  }

  // Debounce username availability check against local accounts and Supabase profiles
  useEffect(() => {
    const clean = profileHandle.trim().toLowerCase().replace(/^@/, '')
    if (!clean) {
      const resetTimer = setTimeout(() => {
        setUsernameCheck({ available: true, status: 'idle', message: '' })
        setIsCheckingUsername(false)
      }, 0)
      return () => clearTimeout(resetTimer)
    }

    const timer = setTimeout(async () => {
      setIsCheckingUsername(true)
      const res = await defaultAuthService.checkUsernameAvailability(
        clean,
        currentSession?.id || me?.id,
        store.knownMeIds
      )
      setUsernameCheck(res)
      setIsCheckingUsername(false)
    }, 350)

    return () => clearTimeout(timer)
  }, [profileHandle, currentSession?.id, me?.id, store.knownMeIds])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileName.trim()) return
    const clean = profileHandle.trim().toLowerCase().replace(/^@/, '')

    if (clean) {
      if (usernameCheck.status === 'unavailable' || usernameCheck.status === 'invalid') {
        return
      }
      // Re-verify synchronously in case user submits while typing
      const check = await defaultAuthService.checkUsernameAvailability(
        clean,
        currentSession?.id || me?.id,
        store.knownMeIds
      )
      if (!check.available) {
        setUsernameCheck(check)
        return
      }
    }

    await store.updateLocalProfile({
      name: profileName.trim(),
      handle: clean || undefined,
    })
    setSavedProfileMsg(true)
    setTimeout(() => setSavedProfileMsg(false), 2500)
  }

  const handleSetPasscode = (e: React.FormEvent) => {
    e.preventDefault()
    setPasscodeMsg(null)

    if (passcodeVal.length < 4) {
      setPasscodeMsg('Passcode must be at least 4 characters/digits.')
      return
    }
    if (passcodeVal !== confirmPasscodeVal) {
      setPasscodeMsg('Passcodes do not match.')
      return
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('splitpay_app_passcode', passcodeVal)
      setHasPasscode(true)
      setPasscodeVal('')
      setConfirmPasscodeVal('')
      setShowPasscodeForm(false)
      setPasscodeMsg('✓ App Passcode successfully set!')
      setTimeout(() => setPasscodeMsg(null), 3000)
    }
  }

  const handleRemovePasscode = () => {
    if (confirm('Are you sure you want to remove the App Passcode lock?')) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('splitpay_app_passcode')
        setHasPasscode(false)
        setPasscodeMsg('✓ App Passcode removed.')
        setTimeout(() => setPasscodeMsg(null), 3000)
      }
    }
  }

  const handleExportBackup = async () => {
    const jsonStr = await store.exportBackup()
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `splitpay_backup_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setBackupMsg('Backup downloaded successfully.')
  }

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        await store.importBackup(text)
        setBackupMsg('✓ Ledger restored successfully!')
      } catch (err: unknown) {
        setBackupMsg(`Failed to import backup: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    reader.readAsText(file)
  }

  const themeModes: { id: ThemeMode; label: string; iconName: IconName; previewClass: string }[] = [
    { id: 'system', label: 'System', iconName: 'monitor', previewClass: 'bg-slate-500 text-white' },
    { id: 'light', label: 'Light', iconName: 'sun', previewClass: 'bg-white text-amber-500 border-slate-300' },
    { id: 'dark', label: 'Dark', iconName: 'moon', previewClass: 'bg-slate-900 text-indigo-300 border-slate-700' },
    { id: 'amoled', label: 'AMOLED', iconName: 'moon', previewClass: 'bg-black text-white border-slate-800' },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--color-text)] tracking-tight">
          Settings & Identity
        </h2>
        <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">
          Personal profile, color palettes, password security, and shared ledger sync.
        </p>
      </div>

      {/* Account & Session Status Section */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-subtle text-primary border border-primary-border flex items-center justify-center text-lg font-bold shadow-sm">
              <Icon name="user" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-[var(--color-text)]">
                  {currentSession?.name || profileName || 'You'}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  currentSession?.isGuest
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                }`}>
                  {currentSession?.isGuest ? 'Guest Mode' : 'Secured Account'}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 font-mono">
                {currentSession?.username ? `@${currentSession.username}` : '@you'} · {currentSession?.isGuest ? 'Local Offline Storage' : 'Password & Cloud Synced'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-xl transition-all self-start sm:self-auto inline-flex items-center gap-1.5 shadow-sm"
          >
            <Icon name="logout" size={14} />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* Profile & Username Section */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary text-white font-extrabold flex items-center justify-center text-lg shadow-sm">
            {profileName.trim().charAt(0).toUpperCase() || 'Y'}
          </div>
          <div>
            <h3 className="font-bold text-sm text-[var(--color-text)]">
              Your Profile & Username
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Identifies you when creating expenses, splitting debts, and settling balances
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-medium text-sm text-[var(--color-text)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                Username / Handle
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-[var(--color-text-muted)] font-mono text-sm">
                  @
                </span>
                <input
                  type="text"
                  value={profileHandle}
                  onChange={(e) => setProfileHandle(e.target.value)}
                  placeholder="username"
                  className={`w-full pl-8 pr-10 py-2.5 bg-[var(--color-surface-subtle)] border rounded-xl font-mono text-sm text-[var(--color-text)] focus:outline-none transition-colors ${
                    usernameCheck.status === 'unavailable' || usernameCheck.status === 'invalid'
                      ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : usernameCheck.status === 'available' && profileHandle.trim()
                        ? 'border-emerald-500/80 focus:ring-1 focus:ring-emerald-500'
                        : 'border-[var(--color-border)] focus:border-primary'
                  }`}
                />
                <div className="absolute right-3.5 top-2.5 flex items-center">
                  {isCheckingUsername ? (
                    <Icon name="reload" size={16} className="text-[var(--color-text-muted)] animate-spin" />
                  ) : usernameCheck.status === 'available' && profileHandle.trim() ? (
                    <Icon name="check" size={16} className="text-emerald-500" />
                  ) : usernameCheck.status === 'unavailable' ? (
                    <Icon name="close" size={16} className="text-rose-500" />
                  ) : usernameCheck.status === 'invalid' ? (
                    <Icon name="alert" size={16} className="text-amber-500" />
                  ) : null}
                </div>
              </div>
              {/* Availability Status Message */}
              <div className="mt-1.5 min-h-[16px]">
                {isCheckingUsername ? (
                  <p className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1.5 animate-pulse">
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
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-[var(--color-text-muted)]">
              {savedProfileMsg && (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold animate-fade-in">
                  ✓ Profile updated successfully!
                </span>
              )}
            </span>
            <button
              type="submit"
              disabled={(!usernameCheck.available && usernameCheck.status !== 'idle') || isCheckingUsername}
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer press-bounce"
            >
              Save Profile
            </button>
          </div>

          <div className="p-3 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-0 text-[11px] text-[var(--color-text-muted)]">
            <span>Device ID: <code className="font-mono text-[var(--color-text)]">{ledgerState.deviceId.slice(0, 10)}...</code></span>
            <span>Local User ID: <code className="font-mono text-[var(--color-text)]">{ledgerState.localPersonId?.slice(0, 10)}...</code></span>
          </div>
        </form>
      </div>

      {/* Verification & Contact Matching Section */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-[var(--color-text)]">
              Verification & Contact Sync
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Verify email and phone ownership to enable secure contact matching and friend discovery.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowContactsModal(true)}
            className="px-3.5 py-2 bg-primary-subtle text-primary border border-primary-border font-bold text-xs rounded-xl hover:bg-primary hover:text-white transition-all self-start sm:self-auto inline-flex items-center gap-1.5 shadow-sm"
          >
            <Icon name="users" size={14} />
            <span>Find from Contacts</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Email verification card */}
          <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-text-muted)] flex items-center gap-1.5">
                  <Icon name="mail" size={14} />
                  <span>Email Verification</span>
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    me?.emailVerified
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {me?.emailVerified ? '✓ Verified' : 'Unverified'}
                </span>
              </div>
              <p className="text-xs font-bold text-[var(--color-text)] truncate">
                {me?.email || 'No email attached'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowEmailModal(true)}
              className="w-full py-2 px-3 text-xs font-bold rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-[var(--color-text)] border border-[var(--color-border)] transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Icon name="mail" size={13} />
              <span>{me?.emailVerified ? 'Change Email' : 'Verify Email Address'}</span>
            </button>
          </div>

          {/* Phone linking card */}
          <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-text-muted)] flex items-center gap-1.5">
                  <Icon name="phone" size={14} />
                  <span>Phone Number</span>
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    me?.phoneVerified
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-500/10 text-slate-500'
                  }`}
                >
                  {me?.phoneVerified ? '✓ Linked' : 'Not linked'}
                </span>
              </div>
              <p className="text-xs font-bold text-[var(--color-text)] truncate font-mono">
                {me?.phone ? formatE164Display(me.phone) : 'No phone linked'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowPhoneModal(true)}
              className="w-full py-2 px-3 text-xs font-bold rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-[var(--color-text)] border border-[var(--color-border)] transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Icon name="phone" size={13} />
              <span>{me?.phoneVerified ? 'Change Phone' : 'Link Phone Number'}</span>
            </button>
          </div>
        </div>

        {/* Discoverability switch */}
        <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[var(--color-text)] block">
              Discoverable by Phone Number
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)] block">
              Allow verified friends to find you when syncing their address book
            </span>
          </div>

          <Switch
            checked={me?.discoverableByPhone ?? false}
            disabled={!me?.phoneVerified}
            onChange={async (val) => {
              await store.updateLocalProfile({ discoverableByPhone: val })
            }}
            ariaLabel="Discoverable by Phone Number"
          />
        </div>
      </div>

      {/* Aesthetic Appearance & Color Palette Picker */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-5">
        <div>
          <h3 className="font-bold text-sm text-[var(--color-text)]">
            Appearance & Aesthetic Color Palette
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Personalize your look. Every color palette dynamically pairs with Light, Dark, and OLED modes.
          </p>
        </div>

        {/* Theme Mode Grid */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-2">
            Display Mode
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {themeModes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMode(t.id)}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                  mode === t.id
                    ? 'border-primary ring-2 ring-primary/20 bg-primary-subtle text-primary font-bold shadow-sm'
                    : 'bg-[var(--color-surface-subtle)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-medium'
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-sm border ${t.previewClass}`}>
                  <Icon name={t.iconName} size={15} />
                </div>
                <span className="text-xs capitalize">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Color Palette Grid */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-2">
            Curated Color Palette
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
                      ? 'border-primary ring-2 ring-primary/25 bg-primary-subtle shadow-sm'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)] hover:border-[var(--color-text-muted)]'
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-xl shrink-0 shadow-sm border border-white/20 flex items-center justify-center"
                    style={{ backgroundColor: p.swatchHex }}
                  >
                    {isSelected && <Icon name="check" size={13} className="text-white" />}
                  </div>
                  <div className="overflow-hidden">
                    <p className={`text-xs truncate ${isSelected ? 'font-bold text-primary' : 'font-semibold text-[var(--color-text)]'}`}>
                      {p.name}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)] capitalize">
                      {p.id}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Default Global Currency Section */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-sm text-[var(--color-text)] flex items-center gap-2">
            <Icon name="coins" size={18} className="text-primary" />
            <span>Default Currency</span>
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Select your preferred default currency. This will automatically apply across all dashboard balance summaries, expenses, settlements, statements, and friends.
          </p>
        </div>

        {currencyMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold animate-fade-in">
            {currencyMsg}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {SupportedCurrencies.map((curr) => {
            const isSelected = (ledgerState.defaultCurrency?.code || 'INR') === curr.code
            return (
              <button
                key={curr.code}
                type="button"
                onClick={() => handleSelectCurrency(curr)}
                className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20 bg-primary-subtle text-primary shadow-sm'
                    : 'bg-[var(--color-surface-subtle)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-extrabold">{curr.symbol}</span>
                  {isSelected && <Icon name="check" size={14} className="text-primary" />}
                </div>
                <div className="mt-2">
                  <p
                    className={`text-xs font-bold ${
                      isSelected ? 'text-primary' : 'text-[var(--color-text)]'
                    }`}
                  >
                    {curr.code}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                    {CURRENCY_LABELS[curr.code] || curr.code}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Real-time Notifications & Web Alerts Section */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-[var(--color-text)] flex items-center gap-2">
              <Icon name="bell" size={18} className="text-primary" />
              <span>Real-Time Notifications & Alerts</span>
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Receive browser alerts and in-app toasts when friends add expenses, record settlements, or sync shared ledgers.
            </p>
          </div>

          <Switch
            checked={notifEnabled}
            onChange={handleToggleNotifications}
            ariaLabel="Real-Time Notifications & Alerts"
            className="self-start sm:self-auto"
          />
        </div>

        {notifMsg && (
          <div className="p-3 bg-primary-subtle border border-primary-border text-primary rounded-xl text-xs font-semibold animate-fade-in">
            {notifMsg}
          </div>
        )}

        <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--color-text)]">
                Browser Web Notification Permission:
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  notifPermission === 'granted'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : notifPermission === 'denied'
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}
              >
                {notifPermission === 'granted'
                  ? '✓ Allowed'
                  : notifPermission === 'denied'
                  ? 'Blocked in Browser'
                  : 'Action Needed'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {notifPermission === 'granted'
                ? 'Desktop & mobile system banners will appear when tabs are active or backgrounded.'
                : notifPermission === 'denied'
                ? 'Notifications are blocked in your browser settings. You can re-enable them in site permissions.'
                : 'Grant browser permission to receive desktop & mobile notification banners.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {notifPermission !== 'granted' && (
              <button
                type="button"
                onClick={handleRequestPermission}
                className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-sm transition-all whitespace-nowrap cursor-pointer"
              >
                Allow Notifications
              </button>
            )}
            <button
              type="button"
              onClick={handleSendTestNotification}
              disabled={!notifEnabled}
              className="px-3 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-[var(--color-text)] border border-[var(--color-border)] text-xs font-semibold rounded-xl transition-all whitespace-nowrap disabled:opacity-40 cursor-pointer"
            >
              Send Test Alert
            </button>
          </div>
        </div>
      </div>

      {/* Password & Security Section */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-[var(--color-text)]">
              App Passcode & Password Lock
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Secure your local SplitPay ledger with a private device passcode or password.
            </p>
          </div>
          <span
            className={`px-3 py-1 text-xs font-bold rounded-xl border flex items-center gap-1.5 ${
              hasPasscode
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] border-[var(--color-border)]'
            }`}
          >
            <Icon name={hasPasscode ? 'lock' : 'unlock'} size={13} />
            <span>{hasPasscode ? 'Protected' : 'Unlocked'}</span>
          </span>
        </div>

        {passcodeMsg && (
          <div className="p-3 bg-primary-subtle border border-primary-border text-primary rounded-xl text-xs font-semibold animate-fade-in">
            {passcodeMsg}
          </div>
        )}

        <div className="pt-1 flex flex-wrap gap-2">
          {!hasPasscode ? (
            <button
              type="button"
              onClick={() => setShowPasscodeForm(!showPasscodeForm)}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-md transition-all"
            >
              {showPasscodeForm ? 'Cancel' : 'Set App Passcode'}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPasscodeForm(!showPasscodeForm)}
                className="px-4 py-2 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-bold rounded-xl transition-all"
              >
                {showPasscodeForm ? 'Cancel' : 'Change Passcode'}
              </button>
              <button
                type="button"
                onClick={handleRemovePasscode}
                className="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-bold rounded-xl transition-all"
              >
                Remove Lock
              </button>
            </div>
          )}
        </div>

        {showPasscodeForm && (
          <form onSubmit={handleSetPasscode} className="space-y-3 pt-2 border-t border-[var(--color-border)] animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                  New Passcode / Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Min 4 characters or digits"
                  value={passcodeVal}
                  onChange={(e) => setPasscodeVal(e.target.value)}
                  className="w-full px-4 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-sm text-[var(--color-text)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                  Confirm Passcode
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter passcode"
                  value={confirmPasscodeVal}
                  onChange={(e) => setConfirmPasscodeVal(e.target.value)}
                  className="w-full px-4 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-sm text-[var(--color-text)] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-md transition-all"
              >
                Confirm & Lock
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Google Authenticator (TOTP 2FA) Section */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-[var(--color-text)] flex items-center gap-2">
              <Icon name="shield" size={18} className="text-primary" />
              <span>Google Authenticator (2FA)</span>
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Secure your account with 6-digit Time-Based One-Time Passwords (RFC 6238). Required for adding a 4th device or approving device swaps.
            </p>
          </div>

          <span
            className={`self-start sm:self-auto px-3 py-1 text-xs font-bold rounded-xl border flex items-center gap-1.5 ${
              currentSession?.totpEnabled
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] border-[var(--color-border)]'
            }`}
          >
            <Icon name={currentSession?.totpEnabled ? 'check' : 'shield'} size={13} />
            <span>{currentSession?.totpEnabled ? '2FA Active' : '2FA Disabled'}</span>
          </span>
        </div>

        {totpSuccessMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold animate-fade-in flex items-center gap-2">
            <Icon name="check" size={14} className="shrink-0" />
            <span>{totpSuccessMsg}</span>
          </div>
        )}

        {totpError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold animate-fade-in flex items-center gap-2">
            <Icon name="close" size={14} className="shrink-0" />
            <span>{totpError}</span>
          </div>
        )}

        {!currentSession?.totpEnabled ? (
          <div>
            {!showTotpSetup ? (
              <button
                type="button"
                onClick={handleStartTotpSetup}
                className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer press-bounce"
              >
                <Icon name="shield" size={14} />
                <span>Set Up Google Authenticator</span>
              </button>
            ) : (
              <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl space-y-4 animate-fade-in">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-[var(--color-text)]">
                    Step 1: Add to Google Authenticator
                  </h4>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    Open Google Authenticator on your mobile device, tap <strong className="text-[var(--color-text)]">+</strong>, select <strong className="text-[var(--color-text)]">Enter a setup key</strong>, and input this private key:
                  </p>
                </div>

                {/* Secret Key Display & Copy */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl font-mono text-xs font-bold text-primary tracking-widest select-all">
                    {formatSecretForDisplay(totpSecret)}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyTotpSecret}
                    className="px-3 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Icon name="clipboard" size={14} />
                    <span>{totpCopyMsg || 'Copy Key'}</span>
                  </button>
                  <a
                    href={generateOtpAuthUri({
                      username: currentSession?.username || 'user',
                      secret: totpSecret,
                      issuer: 'SplitPay',
                    })}
                    className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Icon name="link" size={14} />
                    <span>Open App Link</span>
                  </a>
                </div>

                {/* Verification Code Form */}
                <form onSubmit={handleConfirmTotp} className="space-y-3 pt-2 border-t border-[var(--color-border)]">
                  <div>
                    <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                      Step 2: Enter 6-Digit Code from App to Confirm
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      maxLength={6}
                      placeholder="000 000"
                      value={totpVerifyCode}
                      onChange={(e) => setTotpVerifyCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full sm:w-48 text-center tracking-[0.4em] font-mono text-base py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:border-primary font-bold"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={totpVerifyCode.trim().length !== 6}
                      className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer press-bounce"
                    >
                      Confirm & Activate 2FA
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTotpSetup(false)
                        setTotpSecret('')
                        setTotpError(null)
                      }}
                      className="px-3 py-2 text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
              <Icon name="shield" size={18} className="shrink-0 text-emerald-600" />
              <span>
                Your account is protected with Google Authenticator. New sign-ins and device revocations require your 6-digit TOTP code.
              </span>
            </div>

            {!showTotpDisable ? (
              <button
                type="button"
                onClick={() => {
                  setShowTotpDisable(true)
                  setTotpDisableCode('')
                  setTotpError(null)
                }}
                className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Disable Google Authenticator
              </button>
            ) : (
              <form onSubmit={handleDisableTotp} className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl space-y-3 animate-fade-in">
                <label className="block text-xs font-bold text-[var(--color-text)]">
                  Enter 6-Digit Google Authenticator Code to Disable:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={6}
                    placeholder="000 000"
                    value={totpDisableCode}
                    onChange={(e) => setTotpDisableCode(e.target.value.replace(/\D/g, ''))}
                    className="w-40 text-center tracking-[0.3em] font-mono text-sm py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:border-rose-500 font-bold"
                  />
                  <button
                    type="submit"
                    disabled={totpDisableCode.trim().length !== 6}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    Confirm Disable
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTotpDisable(false)
                      setTotpDisableCode('')
                      setTotpError(null)
                    }}
                    className="px-3 py-2 text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Connected Devices (Max 3 Devices) Section */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-[var(--color-text)] flex items-center gap-2">
              <Icon name="smartphone" size={18} className="text-primary" />
              <span>Connected Devices</span>
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Strict device quota: Only up to 3 devices can be connected at a time. Connecting a 4th device requires verification via Google Authenticator.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 text-xs font-bold rounded-xl border flex items-center gap-1.5 ${
                devices.length >= 3
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  : 'bg-primary-subtle text-primary border-primary-border'
              }`}
            >
              <span>{devices.length} / 3 Connected</span>
            </span>
            <button
              type="button"
              onClick={loadDevices}
              disabled={devicesLoading}
              className="p-1.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
              title="Refresh Devices"
            >
              <Icon name="reload" size={14} className={devicesLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {deviceActionMsg && (
          <div className="p-3 bg-primary-subtle border border-primary-border text-primary rounded-xl text-xs font-semibold animate-fade-in flex items-center gap-2">
            <Icon name="check" size={14} className="shrink-0" />
            <span>{deviceActionMsg}</span>
          </div>
        )}

        <div className="space-y-2">
          {devices.length === 0 ? (
            <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl text-center text-xs text-[var(--color-text-muted)]">
              {devicesLoading ? 'Loading connected devices...' : 'This device is currently connected.'}
            </div>
          ) : (
            devices.map((dev) => (
              <div
                key={dev.deviceId}
                className="p-3.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-primary shrink-0">
                    <Icon
                      name={
                        dev.deviceName.toLowerCase().includes('phone') ||
                        dev.deviceName.toLowerCase().includes('android') ||
                        dev.deviceName.toLowerCase().includes('ios')
                          ? 'smartphone'
                          : 'monitor'
                      }
                      size={18}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--color-text)] truncate">
                        {dev.deviceName}
                      </span>
                      {dev.isCurrent && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white">
                          This Device
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted)]">
                      Active: {new Date(dev.lastActiveAt).toLocaleDateString()} at {new Date(dev.lastActiveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                {!dev.isCurrent && (
                  <button
                    type="button"
                    onClick={() => handleRevokeDevice(dev.deviceId)}
                    className="px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl transition-colors cursor-pointer shrink-0"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Local JSON Backup & Restore */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-sm text-[var(--color-text)]">
            Local Ledger Data Backup & Restore
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Export a full JSON backup of your offline IndexedDB ledger or restore from an existing file.
          </p>
        </div>

        {backupMsg && (
          <div className="p-3 bg-primary-subtle border border-primary-border text-primary rounded-xl text-xs font-semibold animate-fade-in">
            {backupMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleExportBackup}
            className="w-full sm:w-auto px-4 py-2.5 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-bold rounded-xl shadow-sm transition-all inline-flex items-center justify-center gap-1.5"
          >
            <Icon name="save" size={15} />
            <span>Export JSON Backup</span>
          </button>

          <label className="w-full sm:w-auto px-4 py-2.5 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer inline-flex items-center justify-center gap-1.5">
            <Icon name="cloud" size={15} />
            <span>Import JSON Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Danger Zone: Data Clearing & Reset */}
      <div className="p-6 bg-[var(--color-surface)] border border-rose-200 dark:border-rose-900/60 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
          <Icon name="alert" size={20} />
          <h3 className="font-extrabold text-sm tracking-tight text-[var(--color-text)]">
            Danger Zone & Data Management
          </h3>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] -mt-2">
          Reset specific subsets of your ledger or perform a full factory reset.
        </p>

        {dataActionMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold animate-fade-in">
            {dataActionMsg}
          </div>
        )}

        <div className="space-y-3 pt-1">
          {/* Action 1: Clear Transactions */}
          <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-xs text-[var(--color-text)]">Clear All Expenses & Balances</h4>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                Deletes all recorded expenses and settlements. Resets balances to zero, keeping your groups and friends list.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearTransactions}
              className="px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl transition-all shrink-0 cursor-pointer"
            >
              Clear Transactions
            </button>
          </div>

          {/* Action 2: Clear Ledger Data */}
          <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-xs text-[var(--color-text)]">Clear All Ledger Data</h4>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                Wipes expenses, settlements, groups, and friends. Keeps your personal account and password profile intact.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearAllLedgerData}
              className="px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl transition-all shrink-0 cursor-pointer"
            >
              Clear Ledger Data
            </button>
          </div>

          {/* Action 3: Factory Reset */}
          <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-xs text-rose-700 dark:text-rose-400">Factory Reset & Wipe All Data</h4>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                Completely deletes the offline IndexedDB database, clears stored credentials and cache, and restarts the app.
              </p>
            </div>
            <button
              type="button"
              onClick={handleFactoryReset}
              className="px-4 py-2 text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
            >
              Factory Reset
            </button>
          </div>
        </div>
      </div>

      {/* Footer System Administration Link (Super Admin Access) */}
      <div className="pt-4 border-t border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
        <span>SplitPay Web &middot; Local-First Architecture</span>
        {onOpenAdmin && (
          <button
            type="button"
            onClick={onOpenAdmin}
            className="hover:text-[var(--color-text)] font-semibold inline-flex items-center gap-1.5 transition-colors text-[11px] py-1 px-2.5 rounded-lg hover:bg-[var(--color-surface-subtle)] border border-transparent hover:border-[var(--color-border)] self-start sm:self-auto"
          >
            <Icon name="lock" size={13} className="text-amber-500" />
            <span>Super Admin Console</span>
          </button>
        )}
      </div>

      {/* Email Verification Modal */}
      <EmailVerificationModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        initialEmail={me?.email || ''}
      />

      {/* Phone Linking Modal */}
      <PhoneLinkingModal
        isOpen={showPhoneModal}
        onClose={() => setShowPhoneModal(false)}
        onOpenEmailModal={() => setShowEmailModal(true)}
      />

      {/* Contact Picker & Sync Modal */}
      <ContactSyncModal
        isOpen={showContactsModal}
        onClose={() => setShowContactsModal(false)}
      />
    </div>
  )
}
