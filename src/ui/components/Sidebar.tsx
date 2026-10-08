import React from 'react'
import { useStore } from '../storeContext'
import { useTheme } from '../themeContext'

interface SidebarProps {
  currentTab: string
  onNavigate: (tab: string) => void
  onAddExpense: () => void
  onOpenInstall: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onNavigate,
  onAddExpense,
  onOpenInstall,
}) => {
  const { store, ledgerState, syncState, syncEngine, sharedLedgerId } = useStore()
  const { mode, setMode } = useTheme()
  const me = store.me

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', count: null },
    { id: 'friends', label: 'Friends', icon: '👥', count: ledgerState.people.filter((p) => p.id !== me?.id).length },
    { id: 'groups', label: 'Groups', icon: '🏝', count: ledgerState.groups.length },
    { id: 'activity', label: 'Activity', icon: '🧾', count: ledgerState.expenses.filter((e) => !e.isTombstone).length },
    { id: 'statements', label: 'Statements', icon: '📊', count: null },
    { id: 'settings', label: 'Settings', icon: '⚙️', count: null },
  ]

  const isSyncing = syncState?.status === 'syncing'
  const isOffline = syncState?.status === 'offline' || !syncState?.isOnline
  const isError = syncState?.status === 'error'

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

  const themeLabel = {
    system: 'System Theme',
    light: 'Light Theme',
    dark: 'Dark Theme',
    amoled: 'AMOLED Black',
  }[mode]

  const themeIcon = {
    system: '🌓',
    light: '☀️',
    dark: '🌙',
    amoled: '🖤',
  }[mode]

  return (
    <aside className="hidden md:flex flex-col w-64 lg:w-72 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-md sticky top-0 h-screen p-5 justify-between select-none">
      {/* Top section: Logo & App Identity */}
      <div className="space-y-6">
        <div
          className="flex items-center gap-3 cursor-pointer group px-2"
          onClick={() => onNavigate('dashboard')}
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-extrabold text-xl shadow-md group-hover:scale-105 transition-transform">
            ₹
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-lg tracking-tight text-[var(--color-text)]">
                SplitPay
              </h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                PWA
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[150px]">
              {sharedLedgerId ? `Ledger: ${sharedLedgerId}` : 'Local Offline Mode'}
            </p>
          </div>
        </div>

        {/* User Card */}
        <div className="p-3 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0">
              {me?.name ? me.name.charAt(0).toUpperCase() : 'Y'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-[var(--color-text)] truncate">
                {me?.name || 'You'}
              </p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                ● Active Profile
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="p-1 rounded-lg hover:bg-[var(--color-border)] text-[var(--color-text-muted)] text-xs"
            title="Edit profile"
          >
            ✏️
          </button>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={onAddExpense}
          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98"
        >
          <span className="text-base leading-none">+</span>
          <span>Add New Expense</span>
        </button>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-base leading-none">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.count !== null && item.count > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--color-border)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Bottom Footer: Sync, Theme & Install */}
      <div className="space-y-2 pt-4 border-t border-[var(--color-border)]">
        {/* Sync Status Button */}
        <button
          type="button"
          onClick={handleSyncClick}
          disabled={isSyncing}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
            isSyncing
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
              : isOffline
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400'
              : isError
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
          }`}
          title="Click to sync now"
        >
          <div className="flex items-center gap-2">
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
            <span className="font-semibold text-[11px]">
              {isSyncing ? 'Syncing...' : isOffline ? 'Offline Mode' : isError ? 'Sync Error' : 'Online Sync'}
            </span>
          </div>
          {ledgerState.pendingOpsCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-white">
              {ledgerState.pendingOpsCount}
            </span>
          )}
        </button>

        {/* Theme and Install Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cycleTheme}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold rounded-xl border border-[var(--color-border)] transition-colors"
            title={`Current: ${themeLabel} (Click to toggle)`}
          >
            <span>{themeIcon}</span>
            <span className="text-[11px] capitalize">{mode}</span>
          </button>
          <button
            type="button"
            onClick={onOpenInstall}
            className="flex items-center justify-center py-1.5 px-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl border border-indigo-200 dark:border-indigo-800 text-xs font-semibold transition-colors"
            title="Install PWA on this device"
          >
            📲 Install
          </button>
        </div>
      </div>
    </aside>
  )
}
