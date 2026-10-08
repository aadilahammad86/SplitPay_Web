import React, { useState } from 'react'
import { useStore } from '../../ui/storeContext'
import { useTheme } from '../../ui/themeContext'
import type { ThemeMode } from '../../ui/theme'

export const SettingsView: React.FC = () => {
  const { store, syncEngine, syncState, ledgerState, sharedLedgerId, setSharedLedgerId, connectSupabase, disconnectSupabase } = useStore()
  const { mode, setMode } = useTheme()
  const me = store.me

  // Profile
  const [profileName, setProfileName] = useState(me?.name || '')
  const [savedProfileMsg, setSavedProfileMsg] = useState(false)

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
    await store.createLocalProfile(profileName.trim())
    setSavedProfileMsg(true)
    setTimeout(() => setSavedProfileMsg(false), 2500)
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

  const themes: { id: ThemeMode; label: string; icon: string; previewClass: string }[] = [
    { id: 'system', label: 'System', icon: '🌓', previewClass: 'bg-slate-500' },
    { id: 'light', label: 'Light', icon: '☀️', previewClass: 'bg-white border-slate-300' },
    { id: 'dark', label: 'Dark', icon: '🌙', previewClass: 'bg-slate-900 border-slate-700' },
    { id: 'amoled', label: 'AMOLED', icon: '🖤', previewClass: 'bg-black border-slate-800' },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--color-text)] tracking-tight">
          Settings & Identity
        </h2>
        <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-1">
          Customize your profile, visual theme, multi-device shared ledger, and local offline backups.
        </p>
      </div>

      {/* Profile Section */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center justify-center text-lg">
            {profileName.trim().charAt(0).toUpperCase() || 'Y'}
          </div>
          <div>
            <h3 className="font-bold text-sm text-[var(--color-text)]">
              Your Profile
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Used when attributing expenses, shares, and settlements
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
              Display Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Your name"
                className="flex-1 px-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-medium text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
              >
                Save Name
              </button>
            </div>
            {savedProfileMsg && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-2 block animate-fade-in">
                ✓ Display name saved!
              </span>
            )}
          </div>
          <div className="p-3 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
            <span>Device ID: <code className="font-mono text-[var(--color-text)]">{ledgerState.deviceId.slice(0, 10)}...</code></span>
            <span>Local User: <code className="font-mono text-[var(--color-text)]">{ledgerState.localPersonId?.slice(0, 10)}...</code></span>
          </div>
        </form>
      </div>

      {/* Theme Settings */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-sm text-[var(--color-text)]">
            Appearance & Visual Theme
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Choose your preferred color theme or match your device system settings
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMode(t.id)}
              className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${
                mode === t.id
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm'
                  : 'bg-[var(--color-surface-subtle)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-medium'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm border ${t.previewClass}`}>
                {t.icon}
              </div>
              <span className="text-xs capitalize">{t.label}</span>
            </button>
          ))}
        </div>
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
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={ledgerInput}
                onChange={(e) => setLedgerInput(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-xs text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                type="button"
                onClick={handleCopyLedgerId}
                className="px-3.5 py-2.5 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold rounded-xl transition-colors"
                title="Copy Ledger ID"
              >
                {copiedLedger ? '✓ Copied' : '📋 Copy'}
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
              >
                Set Ledger
              </button>
            </div>
            {savedLedgerMsg && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-2 block animate-fade-in">
                ✓ Ledger ID switched to {ledgerInput}!
              </span>
            )}
          </div>
        </form>

        {/* Sync Status Cards */}
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
              className="px-4 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              🔄 Sync Now
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
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
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
                className="w-full px-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-xs text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
                className="w-full px-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-xs text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {supabaseStatusMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  supabaseStatusMsg.includes('success')
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                }`}
              >
                {supabaseStatusMsg}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
              >
                Connect to Supabase
              </button>
              {supabaseUrl && (
                <button
                  type="button"
                  onClick={() => {
                    disconnectSupabase()
                    setSupabaseUrl('')
                    setSupabaseAnonKey('')
                    setSupabaseStatusMsg('Disconnected from Supabase.')
                  }}
                  className="px-4 py-2.5 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-rose-500 font-bold text-xs rounded-xl border border-[var(--color-border)] transition-colors"
                >
                  Disconnect
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Backup & Restore */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-sm text-[var(--color-text)]">
            Offline Backup & Migration
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Export a full JSON snapshot of your friends, groups, expenses, and outbox logs to move between browsers.
          </p>
        </div>

        {backupMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-fade-in">
            {backupMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={handleExportBackup}
            className="p-4 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] border border-[var(--color-border)] rounded-2xl flex items-center gap-3 transition-colors text-left"
          >
            <span className="text-2xl">💾</span>
            <div>
              <span className="block font-bold text-xs text-[var(--color-text)]">
                Export JSON Backup
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                Save ledger data to local file
              </span>
            </div>
          </button>

          <label className="p-4 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] border border-[var(--color-border)] rounded-2xl flex items-center gap-3 transition-colors cursor-pointer text-left">
            <span className="text-2xl">📥</span>
            <div>
              <span className="block font-bold text-xs text-[var(--color-text)]">
                Restore From Backup
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                Import JSON backup file
              </span>
            </div>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  )
}
