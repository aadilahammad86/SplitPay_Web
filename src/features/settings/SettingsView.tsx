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

  const handleConnectSupabase = async (e: React.FormEvent) => {
    e.preventDefault()
    setSupabaseStatusMsg(null)
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setSupabaseStatusMsg('Please enter both Supabase URL and publishable Anon Key.')
      return
    }

    try {
      await connectSupabase({ url: supabaseUrl.trim(), anonKey: supabaseAnonKey.trim() })
      setSupabaseStatusMsg('Connected successfully!')
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
        setBackupMsg('Ledger restored successfully!')
      } catch (err: unknown) {
        setBackupMsg(`Failed to import backup: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-5 text-sm">
      <div>
        <h2 className="text-base font-bold text-[var(--color-text)]">Settings & Sync Health</h2>
        <p className="text-xs text-[var(--color-text-muted)]">
          Manage your identity, theme, cloud synchronization, and offline backup.
        </p>
      </div>

      {/* Profile Section */}
      <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3">
        <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
          Your Profile & Identity (SY-1)
        </h3>
        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Display Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm"
              >
                Save
              </button>
            </div>
            {savedProfileMsg && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
                ✓ Name updated!
              </span>
            )}
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)] font-mono">
            Device ID: {ledgerState.deviceId} · User ID: {ledgerState.localPersonId}
          </div>
        </form>
      </div>

      {/* Theme Settings */}
      <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3">
        <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
          Appearance & Theme
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {(['system', 'light', 'dark', 'amoled'] as ThemeMode[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setMode(t)}
              className={`py-2 px-3 rounded-xl border text-xs font-bold capitalize transition-all ${
                mode === t
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                  : 'bg-[var(--color-surface-subtle)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Shared Ledger Configuration */}
      <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3">
        <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
          Shared Ledger (Multi-User Collaboration)
        </h3>
        <p className="text-xs text-[var(--color-text-muted)]">
          Two users sharing the same Ledger ID on separate devices will sync expenses and balances automatically.
        </p>
        <form onSubmit={handleSaveLedgerId} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Active Ledger ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={ledgerInput}
                onChange={(e) => setLedgerInput(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm"
              >
                Set Ledger
              </button>
            </div>
            {savedLedgerMsg && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
                ✓ Shared ledger updated!
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Sync Health & Outbox Monitor */}
      <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
            Sync Health & Outbox Monitor (INV-6)
          </h3>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={syncState?.status === 'syncing'}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm"
          >
            {syncState?.status === 'syncing' ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-2.5 bg-[var(--color-surface-subtle)] rounded-xl border border-[var(--color-border)]">
            <span className="block text-[10px] text-[var(--color-text-muted)] font-medium">Network</span>
            <span className="font-bold text-xs">
              {syncState?.isOnline ? '🟢 Connected' : '🔴 Offline'}
            </span>
          </div>

          <div className="p-2.5 bg-[var(--color-surface-subtle)] rounded-xl border border-[var(--color-border)]">
            <span className="block text-[10px] text-[var(--color-text-muted)] font-medium">Outbox Queue</span>
            <span className={`font-bold text-xs ${ledgerState.pendingOpsCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
              {ledgerState.pendingOpsCount} unsynced
            </span>
          </div>

          <div className="p-2.5 bg-[var(--color-surface-subtle)] rounded-xl border border-[var(--color-border)]">
            <span className="block text-[10px] text-[var(--color-text-muted)] font-medium">Status</span>
            <span className="font-bold text-xs capitalize">{syncState?.status || 'Local Only'}</span>
          </div>

          <div className="p-2.5 bg-[var(--color-surface-subtle)] rounded-xl border border-[var(--color-border)]">
            <span className="block text-[10px] text-[var(--color-text-muted)] font-medium">Last Synced</span>
            <span className="font-bold text-[11px] truncate">
              {syncState?.lastSyncedAt
                ? syncState.lastSyncedAt.toLocaleTimeString()
                : 'Never'}
            </span>
          </div>
        </div>

        {syncState?.error && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-xl text-xs">
            Sync Alert: {syncState.error}
          </div>
        )}
      </div>

      {/* Supabase Hosted Sync (Optional Cloud Endpoint) */}
      <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
            Supabase Cloud Sync (Optional)
          </h3>
          {syncEngine && (
            <button
              type="button"
              onClick={disconnectSupabase}
              className="text-xs text-rose-600 hover:underline font-semibold"
            >
              Disconnect
            </button>
          )}
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          Connect to your Supabase project using its publishable anon key. Never enter a service-role secret.
        </p>

        <form onSubmit={handleConnectSupabase} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Project URL
            </label>
            <input
              type="url"
              placeholder="https://xyz.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full px-3.5 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Publishable Anon Key
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              className="w-full px-3.5 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm"
            >
              Connect to Supabase
            </button>
            {supabaseStatusMsg && (
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {supabaseStatusMsg}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Backup & Disaster Recovery */}
      <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3">
        <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
          Data Backup & Disaster Recovery
        </h3>
        <p className="text-xs text-[var(--color-text-muted)]">
          Export your complete ledger data as a JSON file to recover if browser site data or cookies are ever cleared.
        </p>

        <div className="flex flex-wrap gap-2.5 items-center">
          <button
            type="button"
            onClick={handleExportBackup}
            className="px-4 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] hover:bg-[var(--color-border)] font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
          >
            <span>📦</span>
            <span>Export JSON Backup</span>
          </button>

          <label className="px-4 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] hover:bg-[var(--color-border)] font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5">
            <span>📂</span>
            <span>Restore Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>

        {backupMsg && (
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {backupMsg}
          </p>
        )}
      </div>
    </div>
  )
}
