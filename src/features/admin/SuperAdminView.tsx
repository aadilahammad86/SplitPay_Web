import React, { useState } from 'react'
import { useStore } from '../../ui/storeContext'
import { Icon } from '../../ui/components/Icon'
import {
  defaultAdminAuthService,
  SUPERADMIN_DEFAULT_USER,
} from '../../services/admin/adminAuthService'
import { getSupabaseClient } from '../../supabase/supabaseClient'

interface SuperAdminViewProps {
  onBackToApp: () => void
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({ onBackToApp }) => {
  const {
    syncEngine,
    syncState,
    ledgerState,
    sharedLedgerId,
    setSharedLedgerId,
    connectSupabase,
    disconnectSupabase,
  } = useStore()

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    defaultAdminAuthService.isAuthenticated()
  )
  const [usernameInput, setUsernameInput] = useState(SUPERADMIN_DEFAULT_USER)
  const [passwordInput, setPasswordInput] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Supabase Configuration State
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
  const [showAnonKey, setShowAnonKey] = useState(false)
  const [dbStatusMsg, setDbStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [isTestingConnection, setIsTestingConnection] = useState(false)

  // Ledger Infrastructure State
  const [ledgerInput, setLedgerInput] = useState(sharedLedgerId || 'default_ledger')
  const [ledgerMsg, setLedgerMsg] = useState<string | null>(null)
  const [isSyncingNow, setIsSyncingNow] = useState(false)

  // Change Admin Password State
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmNewPass, setConfirmNewPass] = useState('')
  const [changePassMsg, setChangePassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    setIsLoggingIn(true)

    try {
      const res = await defaultAdminAuthService.login(usernameInput, passwordInput)
      if (res.success) {
        setIsAuthenticated(true)
        setPasswordInput('')
      } else {
        setLoginError(res.error || 'Invalid credentials.')
      }
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = () => {
    defaultAdminAuthService.logout()
    setIsAuthenticated(false)
  }

  const handleSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault()
    setDbStatusMsg(null)

    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setDbStatusMsg({
        type: 'error',
        text: 'Please provide both the Supabase URL and Publishable Anon Key.',
      })
      return
    }

    try {
      await connectSupabase({
        url: supabaseUrl.trim(),
        anonKey: supabaseAnonKey.trim(),
      })
      setDbStatusMsg({
        type: 'success',
        text: '✓ Supabase database connected successfully! Real-time sync engine is initialized.',
      })
    } catch (err) {
      setDbStatusMsg({
        type: 'error',
        text: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  const handleTestConnection = async () => {
    setIsTestingConnection(true)
    setDbStatusMsg(null)

    try {
      const client = getSupabaseClient()
      if (!client) {
        setDbStatusMsg({
          type: 'error',
          text: 'No active Supabase client configured. Save connection settings first.',
        })
        return
      }

      // Ping profiles table
      const { error: profileError } = await client
        .from('profiles')
        .select('id', { count: 'exact', head: true })

      if (profileError) {
        setDbStatusMsg({
          type: 'error',
          text: `Database ping warning: ${profileError.message}. Make sure schema.sql was executed.`,
        })
      } else {
        setDbStatusMsg({
          type: 'success',
          text: '✓ Connection Test Passed: Supabase REST API and public.profiles table are healthy!',
        })
      }
    } catch (err) {
      setDbStatusMsg({
        type: 'error',
        text: `Connection test failed: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleDisconnectSupabase = () => {
    if (confirm('Disconnect Supabase cloud sync? The app will operate in local offline mode.')) {
      disconnectSupabase()
      setSupabaseUrl('')
      setSupabaseAnonKey('')
      setDbStatusMsg({
        type: 'info',
        text: 'Supabase disconnected. App switched to local offline mode.',
      })
    }
  }

  const handleSaveLedgerId = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ledgerInput.trim()) return

    await setSharedLedgerId(ledgerInput.trim())
    setLedgerMsg(`✓ App-wide Ledger ID set to "${ledgerInput.trim()}".`)
    setTimeout(() => setLedgerMsg(null), 3000)
  }

  const handleForceSync = async () => {
    if (!syncEngine) return
    setIsSyncingNow(true)
    try {
      await syncEngine.syncNow()
    } finally {
      setIsSyncingNow(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangePassMsg(null)

    if (newPass !== confirmNewPass) {
      setChangePassMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }

    const res = await defaultAdminAuthService.changePassword(currentPass, newPass)
    if (res.success) {
      setChangePassMsg({ type: 'success', text: '✓ Super Admin password updated successfully!' })
      setCurrentPass('')
      setNewPass('')
      setConfirmNewPass('')
      setTimeout(() => setShowChangePassword(false), 2000)
    } else {
      setChangePassMsg({ type: 'error', text: res.error || 'Failed to update password.' })
    }
  }

  // =========================================================================
  // VIEW: Super Admin Login Screen
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md p-6 sm:p-8 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-2xl space-y-6 animate-fade-in">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-amber-400 border border-slate-800 flex items-center justify-center text-2xl mx-auto shadow-md">
              <Icon name="lock" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[var(--color-text)] tracking-tight">
                Super Admin Console
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Restricted infrastructure portal for SplitPay system configuration
              </p>
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-2.5">
            <Icon name="alert" size={16} className="shrink-0 mt-0.5" />
            <span>
              This area is strictly reserved for system administrators. Database credentials and shared sync routing are managed here.
            </span>
          </div>

          {loginError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 animate-fade-in">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Admin Username / Email
              </label>
              <input
                type="text"
                required
                autoFocus
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="superadmin"
                className="w-full px-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-sm text-[var(--color-text)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Admin Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full pl-4 pr-10 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-sm text-[var(--color-text)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  <Icon name={showPassword ? 'unlock' : 'lock'} size={15} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md transition-all inline-flex items-center justify-center gap-2"
            >
              {isLoggingIn ? <Icon name="reload" size={16} className="animate-spin" /> : <Icon name="lock" size={16} />}
              <span>Authenticate & Enter Console</span>
            </button>
          </form>

          <div className="pt-2 border-t border-[var(--color-border)] text-center">
            <button
              type="button"
              onClick={onBackToApp}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <span>← Back to SplitPay App</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW: Super Admin Console Dashboard
  // =========================================================================
  const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Top Header Bar */}
      <div className="p-6 bg-slate-900 text-white rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xl shadow-sm">
            <Icon name="lock" size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                Super Admin Console
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-amber-400/20 text-amber-300 rounded-full border border-amber-400/30">
                System Root
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Infrastructure control: Supabase database, global sync routing, and telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={onBackToApp}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors border border-slate-700 inline-flex items-center gap-1.5"
          >
            <span>Back to App</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold rounded-xl transition-colors border border-rose-500/40 inline-flex items-center gap-1.5"
          >
            <Icon name="close" size={13} />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: Supabase Backend Database Configuration */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-[var(--color-text)]">
                Supabase Backend Database
              </h3>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                  isSupabaseConfigured
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}
              >
                {isSupabaseConfigured ? '✓ Configured' : 'Offline / Not Configured'}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Configures the live Postgres & Realtime backend for the whole application.
            </p>
          </div>

          {isSupabaseConfigured && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="px-3 py-1.5 bg-primary-subtle border border-primary-border text-primary font-bold text-xs rounded-xl hover:bg-primary hover:text-white transition-all inline-flex items-center gap-1.5"
              >
                <Icon name="reload" size={13} className={isTestingConnection ? 'animate-spin' : ''} />
                <span>Test Connection</span>
              </button>
              <button
                type="button"
                onClick={handleDisconnectSupabase}
                className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-bold rounded-xl hover:bg-rose-100 transition-colors"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {dbStatusMsg && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-semibold animate-fade-in ${
              dbStatusMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                : dbStatusMsg.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
            }`}
          >
            {dbStatusMsg.text}
          </div>
        )}

        <form onSubmit={handleSaveSupabase} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Supabase Project URL
            </label>
            <input
              type="url"
              required
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xyzcompany.supabase.co"
              className="w-full px-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-xs text-[var(--color-text)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Publishable Anon Key (Public Key — Never enter service_role secret)
            </label>
            <div className="relative">
              <input
                type={showAnonKey ? 'text' : 'password'}
                required
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full pl-4 pr-10 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-xs text-[var(--color-text)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowAnonKey(!showAnonKey)}
                className="absolute right-3 top-3 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                <Icon name={showAnonKey ? 'unlock' : 'lock'} size={14} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Applies globally and persists across all client sessions.
            </span>
            <button
              type="submit"
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              Save & Connect Database
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: Global Shared Ledger Infrastructure & Sync Engine */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-5">
        <div>
          <h3 className="font-bold text-sm text-[var(--color-text)]">
            Global Shared Ledger & Realtime Transport
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Controls which shared ledger ring all devices join for real-time collaboration.
          </p>
        </div>

        {ledgerMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-semibold animate-fade-in">
            {ledgerMsg}
          </div>
        )}

        <form onSubmit={handleSaveLedgerId} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Active App Ledger Identifier
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={ledgerInput}
                onChange={(e) => setLedgerInput(e.target.value)}
                placeholder="default_ledger"
                className="flex-1 px-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-xs text-[var(--color-text)] focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-md transition-all shrink-0"
              >
                Update Ledger ID
              </button>
            </div>
          </div>
        </form>

        {/* Sync Engine Monitor Card */}
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
                Sync Engine: {syncState?.status?.toUpperCase() || 'OFFLINE'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {ledgerState.pendingOpsCount === 0
                ? '0 pending outbox operations · Local and remote are synchronized'
                : `${ledgerState.pendingOpsCount} outbox operation(s) awaiting server confirmation`}
            </p>
            {syncState?.error && (
              <p className="text-[11px] text-rose-500 font-mono mt-1 bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
                Error: {syncState.error}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleForceSync}
            disabled={isSyncingNow || !syncEngine}
            className="px-4 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-bold rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Icon name="reload" size={13} className={isSyncingNow ? 'animate-spin' : ''} />
            <span>Force Immediate Sync</span>
          </button>
        </div>
      </div>

      {/* SECTION 3: System Telemetry & Storage Health */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-sm text-[var(--color-text)]">
            System Telemetry & Storage Health
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Diagnostics from in-device IndexedDB storage and client identity.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl text-center">
            <div className="text-xl font-extrabold text-[var(--color-text)]">{ledgerState.people.length}</div>
            <div className="text-[11px] text-[var(--color-text-muted)] font-medium mt-0.5">Directory Contacts</div>
          </div>
          <div className="p-3 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl text-center">
            <div className="text-xl font-extrabold text-[var(--color-text)]">
              {ledgerState.expenses.filter((e) => !e.isTombstone).length}
            </div>
            <div className="text-[11px] text-[var(--color-text-muted)] font-medium mt-0.5">Total Expenses</div>
          </div>
          <div className="p-3 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl text-center">
            <div className="text-xl font-extrabold text-[var(--color-text)]">{ledgerState.groups.length}</div>
            <div className="text-[11px] text-[var(--color-text-muted)] font-medium mt-0.5">Groups Created</div>
          </div>
          <div className="p-3 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl text-center">
            <div className="text-xl font-extrabold text-primary">{ledgerState.pendingOpsCount}</div>
            <div className="text-[11px] text-[var(--color-text-muted)] font-medium mt-0.5">Pending Ops</div>
          </div>
        </div>

        <div className="p-3 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-[var(--color-text-muted)]">
          <span>Device ID: <code className="font-mono text-[var(--color-text)]">{ledgerState.deviceId}</code></span>
          <span>Engine: <span className="font-semibold text-emerald-600 dark:text-emerald-400">IndexedDB + CRDT Outbox</span></span>
        </div>
      </div>

      {/* SECTION 4: Super Admin Security & Password Management */}
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-[var(--color-text)]">
              Super Admin Security
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Change the password protecting this administrative console.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowChangePassword(!showChangePassword)}
            className="text-xs font-bold text-primary hover:underline"
          >
            {showChangePassword ? 'Cancel' : 'Change Password →'}
          </button>
        </div>

        {showChangePassword && (
          <form onSubmit={handleChangePassword} className="space-y-3 pt-2 border-t border-[var(--color-border)] animate-fade-in">
            {changePassMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  changePassMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {changePassMsg.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  placeholder="Current password"
                  className="w-full px-3 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl text-xs font-mono text-[var(--color-text)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] mb-1">
                  New Password (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="New password"
                  className="w-full px-3 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl text-xs font-mono text-[var(--color-text)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmNewPass}
                  onChange={(e) => setConfirmNewPass(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full px-3 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl text-xs font-mono text-[var(--color-text)] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-md transition-all"
              >
                Save New Admin Password
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
