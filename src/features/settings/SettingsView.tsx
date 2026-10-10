import React, { useState } from 'react'
import { useStore } from '../../ui/storeContext'
import { useTheme } from '../../ui/themeContext'
import type { ThemeMode, ColorPaletteId } from '../../ui/theme'
import { OnboardingModal } from '../onboarding/OnboardingModal'
import { Icon, type IconName } from '../../ui/components/Icon'

export const SettingsView: React.FC = () => {
  const {
    store,
    syncEngine,
    syncState,
    ledgerState,
    sharedLedgerId,
    setSharedLedgerId,
    connectSupabase,
  } = useStore()

  const { mode, setMode, palette, setPalette, availablePalettes } = useTheme()
  const me = store.me

  // Profile & Username
  const [profileName, setProfileName] = useState(me?.name || '')
  const [profileHandle, setProfileHandle] = useState(me?.handle || '')
  const [savedProfileMsg, setSavedProfileMsg] = useState(false)

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

  // Onboarding Replay
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Shared Ledger ID
  const [ledgerInput, setLedgerInput] = useState(sharedLedgerId || 'default_ledger')
  const [savedLedgerMsg, setSavedLedgerMsg] = useState(false)
  const [copiedLedger, setCopiedLedger] = useState(false)

  // Supabase Config
  const [supabaseUrl, setSupabaseUrl] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('splitpay_supabase_url') || ''
    }
    return ''
  })
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('splitpay_supabase_anon_key') || ''
    }
    return ''
  })
  const [supabaseStatusMsg, setSupabaseStatusMsg] = useState<string | null>(null)
  const [showCloudConfig, setShowCloudConfig] = useState(false)

  // Backup & Restore
  const [backupMsg, setBackupMsg] = useState<string | null>(null)

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileName.trim()) return
    await store.updateLocalProfile({
      name: profileName.trim(),
      handle: profileHandle.trim() ? profileHandle.trim().replace(/^@/, '') : undefined,
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

  const handleSaveLedgerId = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ledgerInput.trim()) return
    await setSharedLedgerId(ledgerInput.trim())
    setSavedLedgerMsg(true)
    setTimeout(() => setSavedLedgerMsg(false), 2500)
  }

  const handleCopyLedgerId = () => {
    if (navigator.clipboard && ledgerInput) {
      navigator.clipboard.writeText(ledgerInput)
      setCopiedLedger(true)
      setTimeout(() => setCopiedLedger(false), 2000)
    }
  }

  const handleConnectSupabase = async (e: React.FormEvent) => {
    e.preventDefault()
    setSupabaseStatusMsg(null)
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setSupabaseStatusMsg('Please enter both Supabase URL and publishable Anon Key.')
      return
    }

    try {
      await connectSupabase({ url: supabaseUrl.trim(), anonKey: supabaseAnonKey.trim() })
      setSupabaseStatusMsg('✓ Connected successfully! Sync is now active.')
    } catch (err: unknown) {
      setSupabaseStatusMsg(`Connection failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleManualSync = async () => {
    if (syncEngine) {
      await syncEngine.syncNow()
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
      {/* Header & Tour trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--color-text)] tracking-tight">
            Settings & Identity
          </h2>
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">
            Personal profile, color palettes, password security, and shared ledger sync.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowOnboarding(true)}
          className="px-4 py-2 bg-primary-subtle border border-primary-border text-primary font-bold text-xs rounded-xl hover:bg-primary hover:text-white transition-all self-start sm:self-auto shadow-sm inline-flex items-center gap-1.5"
        >
          <Icon name="star" size={14} className="text-amber-500" />
          <span>Replay Setup Wizard</span>
        </button>
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
                  className="w-full pl-8 pr-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-sm text-[var(--color-text)] focus:outline-none"
                />
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
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
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

      {/* Shared Ledger (Multi-User Collaboration) */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-sm text-[var(--color-text)]">
            Shared Ledger Collaboration
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Two or more users on separate devices (Wi-Fi or cellular) sync together by sharing the same Ledger ID.
          </p>
        </div>

        <form onSubmit={handleSaveLedgerId} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
              Active Ledger ID
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                required
                value={ledgerInput}
                onChange={(e) => setLedgerInput(e.target.value)}
                className="w-full flex-1 px-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-xs text-[var(--color-text)] focus:outline-none min-w-0"
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyLedgerId}
                  className="flex-1 sm:flex-none px-3.5 py-2.5 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 shrink-0"
                  title="Copy Ledger ID"
                >
                  <Icon name={copiedLedger ? 'check' : 'clipboard'} size={14} />
                  <span>{copiedLedger ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 shrink-0 whitespace-nowrap text-center"
                >
                  Set Ledger
                </button>
              </div>
            </div>
            {savedLedgerMsg && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-2 block animate-fade-in">
                ✓ Ledger ID switched to {ledgerInput}!
              </span>
            )}
          </div>
        </form>

        {/* Sync Status Card */}
        <div className="pt-2">
          <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    syncState?.status === 'syncing'
                      ? 'bg-blue-500 animate-pulse'
                      : !syncState?.isOnline
                      ? 'bg-amber-500'
                      : syncState?.status === 'error'
                      ? 'bg-rose-500'
                      : 'bg-emerald-500'
                  }`}
                />
                <span className="font-bold text-xs text-[var(--color-text)]">
                  {syncState?.status === 'syncing'
                    ? 'Syncing in progress...'
                    : !syncState?.isOnline
                    ? 'Offline (Changes safely queued in IndexedDB outbox)'
                    : syncState?.status === 'error'
                    ? 'Sync Error'
                    : 'Online & Up to Date'}
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {ledgerState.pendingOpsCount === 0
                  ? 'All local changes synced with remote peers'
                  : `${ledgerState.pendingOpsCount} change(s) waiting to upload`}
              </p>
            </div>

            <button
              type="button"
              onClick={handleManualSync}
              disabled={syncState?.status === 'syncing'}
              className="px-4 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-bold rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5"
            >
              <Icon name="reload" size={14} className={syncState?.status === 'syncing' ? 'animate-spin' : ''} />
              <span>Sync Now</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cloud Sync Configuration (Optional) */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-[var(--color-text)]">
              Supabase Cloud Sync (Optional)
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Connect your own free-tier Supabase database for multi-user cross-network syncing.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCloudConfig(!showCloudConfig)}
            className="text-xs font-bold text-primary hover:underline"
          >
            {showCloudConfig ? 'Hide Config' : 'Configure →'}
          </button>
        </div>

        {showCloudConfig && (
          <form onSubmit={handleConnectSupabase} className="space-y-4 pt-2 border-t border-[var(--color-border)] animate-fade-in">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Supabase Project URL
              </label>
              <input
                type="url"
                required
                placeholder="https://xyzcompany.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-xs text-[var(--color-text)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Publishable Anon Key (Never enter service-role key)
              </label>
              <input
                type="password"
                required
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-xs text-[var(--color-text)] focus:outline-none"
              />
            </div>

            {supabaseStatusMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  supabaseStatusMsg.startsWith('✓')
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {supabaseStatusMsg}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="submit"
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-md transition-all"
              >
                Connect Cloud Sync
              </button>
            </div>
          </form>
        )}
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
            className="w-full sm:w-auto px-4 py-2.5 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-bold rounded-xl shadow-sm transition-all inline-flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Icon name="save" size={15} />
            <span>Export JSON Backup</span>
          </button>

          <label className="w-full sm:w-auto px-4 py-2.5 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 active:scale-95">
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

      {/* Replayable Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </div>
  )
}
