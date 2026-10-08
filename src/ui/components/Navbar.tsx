import React, { useState } from 'react'
import { useTheme } from '../themeContext'
import { useStore } from '../storeContext'
import { InstallModal } from '../../pwa/InstallModal'
import { isStandalone } from '../../pwa/pwaManager'

interface NavbarProps {
  currentTab: string
  onNavigate: (tab: string) => void
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate }) => {
  const { mode, setMode } = useTheme()
  const { syncEngine, syncState, ledgerState } = useStore()
  const [showInstall, setShowInstall] = useState(false)
  const standalone = isStandalone()

  const handleSyncClick = async () => {
    if (syncEngine) {
      await syncEngine.syncNow()
    }
  }

  const cycleTheme = () => {
    if (mode === 'system') setMode('light')
    else if (mode === 'light') setMode('dark')
    else if (mode === 'dark') setMode('amoled')
    else setMode('system')
  }

  const themeIcon = {
    system: '🌓',
    light: '☀️',
    dark: '🌙',
    amoled: '🖤',
  }[mode]

  const isSyncing = syncState?.status === 'syncing'
  const isOffline = syncState?.status === 'offline' || !syncState?.isOnline
  const isError = syncState?.status === 'error'

  return (
    <header className="md:hidden sticky top-0 z-40 bg-[var(--color-surface)]/90 backdrop-blur-md border-b border-[var(--color-border)] px-4 py-3 safe-top">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        {/* Logo and Brand */}
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => onNavigate('dashboard')}
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
            ₹
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight text-[var(--color-text)]">
              SplitPay
            </h1>
          </div>
        </div>

        {/* Status Pill & Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Sync Status Badge */}
          <button
            type="button"
            onClick={handleSyncClick}
            disabled={isSyncing}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              isSyncing
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                : isOffline
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400'
                : isError
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
            }`}
            title={
              isOffline
                ? 'Offline: changes are queued locally'
                : isSyncing
                ? 'Syncing with remote ledger...'
                : isError
                ? `Sync error: ${syncState?.error}`
                : 'All changes synced'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isSyncing
                  ? 'bg-blue-500 animate-pulse'
                  : isOffline
                  ? 'bg-amber-500'
                  : isError
                  ? 'bg-rose-500'
                  : 'bg-emerald-500'
              }`}
            />
            <span className="hidden sm:inline">
              {isSyncing ? 'Syncing...' : isOffline ? 'Offline' : isError ? 'Error' : 'Online'}
            </span>
            {ledgerState.pendingOpsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-bold text-[10px]">
                {ledgerState.pendingOpsCount}
              </span>
            )}
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={cycleTheme}
            className="p-1.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] text-sm transition-colors"
            title={`Theme: ${mode} (click to cycle)`}
            aria-label={`Current theme is ${mode}. Click to change.`}
          >
            <span>{themeIcon}</span>
          </button>

          {/* Install Button (hidden when already installed) */}
          {!standalone && (
            <button
              type="button"
              onClick={() => setShowInstall(true)}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
            >
              <span>📲</span>
              <span>Install</span>
            </button>
          )}

          {/* Settings button */}
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="p-1.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] text-[var(--color-text)] transition-colors text-sm"
            aria-label="Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      <InstallModal isOpen={showInstall} onClose={() => setShowInstall(false)} />
    </header>
  )
}
