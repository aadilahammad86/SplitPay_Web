import React from 'react'
import { useStore } from '../storeContext'
import { useTheme } from '../themeContext'
import { Icon, type IconName } from './Icon'
import { SyncStatusModal } from '../../features/sync/SyncStatusModal'
import { defaultAuthService } from '../../services/auth/authService'

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
  const { store, ledgerState, syncState, sharedLedgerId } = useStore()
  const { mode, setMode, palette, setPalette, availablePalettes } = useTheme()
  const me = store.me

  const navItems: { id: string; label: string; icon: IconName; count: number | null }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'home', count: null },
    { id: 'credit', label: 'Lent / Credit', icon: 'creditcard', count: null },
    { id: 'friends', label: 'Friends', icon: 'user', count: ledgerState.people.filter((p) => p.id !== me?.id).length },
    { id: 'groups', label: 'Groups', icon: 'users', count: ledgerState.groups.length },
    { id: 'activity', label: 'Activity', icon: 'receipt', count: ledgerState.expenses.filter((e) => !e.isTombstone).length },
    { id: 'statements', label: 'Statements', icon: 'chart', count: null },
    { id: 'settings', label: 'Settings', icon: 'settings', count: null },
  ]

  const [showSyncModal, setShowSyncModal] = React.useState(false)

  const isSyncing = syncState?.status === 'syncing'
  const isOffline = syncState?.status === 'offline' || !syncState?.isOnline
  const isError = syncState?.status === 'error'

  const handleSyncClick = () => {
    setShowSyncModal(true)
  }

  const cycleTheme = () => {
    if (mode === 'system') setMode('light')
    else if (mode === 'light') setMode('dark')
    else if (mode === 'dark') setMode('amoled')
    else setMode('system')
  }

  const cyclePalette = () => {
    const ids = availablePalettes.map((p) => p.id)
    const nextIdx = (ids.indexOf(palette) + 1) % ids.length
    setPalette(ids[nextIdx]!)
  }

  const themeLabel = {
    system: 'System Theme',
    light: 'Light Theme',
    dark: 'Dark Theme',
    amoled: 'AMOLED Black',
  }[mode]

  const themeIcon: IconName = {
    system: 'monitor' as IconName,
    light: 'sun' as IconName,
    dark: 'moon' as IconName,
    amoled: 'moon' as IconName,
  }[mode]

  return (
    <aside className="hidden md:flex flex-col w-64 lg:w-72 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-md sticky top-0 h-screen h-[100dvh] self-start p-5 justify-between select-none overflow-y-auto z-30">
      {/* Top section: Logo & App Identity */}
      <div className="space-y-6">
        <div
          className="flex items-center gap-3 cursor-pointer group px-2"
          onClick={() => onNavigate('dashboard')}
        >
          <div className="w-10 h-10 rounded-2xl hero-gradient flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
            <Icon name="rupee" size={24} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-lg tracking-tight text-[var(--color-text)]">
                SplitPay
              </h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary-subtle text-primary border border-primary-border">
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
            <div className="w-8 h-8 rounded-xl bg-primary text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
              {me?.name ? me.name.charAt(0).toUpperCase() : 'Y'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-[var(--color-text)] truncate">
                {me?.name || 'You'}
              </p>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                ● Active Profile
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="p-1.5 rounded-lg hover:bg-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs transition-colors"
              title="Edit profile & username"
            >
              <Icon name="edit" size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm('Are you sure you want to log out of SplitPay?')) {
                  defaultAuthService.logout()
                }
              }}
              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-[var(--color-text-muted)] hover:text-rose-600 dark:hover:text-rose-400 text-xs transition-colors"
              title="Log Out"
              aria-label="Log Out"
            >
              <Icon name="logout" size={15} />
            </button>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={onAddExpense}
          className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <Icon name="plus" size={16} strokeWidth={2.5} />
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
                className={`sidebar-nav-item w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors duration-150 ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon name={item.icon} size={18} strokeWidth={isActive ? 2.5 : 2} />
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
          className={`btn-press w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
            isSyncing
              ? 'bg-blue-500/10 border-blue-500/25 text-blue-700 dark:text-blue-400'
              : isOffline
              ? 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-400'
              : isError
              ? 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-400'
          }`}
          title="Click to sync now"
        >
          <div className="flex items-center gap-2">
            <Icon
              name="reload"
              size={14}
              className={isSyncing ? 'animate-spin' : ''}
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

        {/* Theme, Palette, and Install Quick Actions */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={cycleTheme}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold rounded-xl border border-[var(--color-border)] transition-colors"
            title={`Mode: ${themeLabel} (Click to toggle)`}
          >
            <Icon name={themeIcon} size={15} />
            <span className="text-[10px] capitalize">{mode}</span>
          </button>

          <button
            type="button"
            onClick={cyclePalette}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold rounded-xl border border-[var(--color-border)] transition-colors"
            title={`Palette: ${palette} (Click to cycle accent color)`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
            <span className="text-[10px] capitalize truncate">{palette}</span>
          </button>

          <button
            type="button"
            onClick={onOpenInstall}
            className="flex items-center justify-center gap-1 py-1.5 px-2 bg-primary-subtle text-primary border border-primary-border hover:bg-primary hover:text-white rounded-xl text-xs font-semibold transition-colors"
            title="Install PWA on this device"
          >
            <Icon name="smartphone" size={14} />
            <span>Install</span>
          </button>
        </div>
      </div>

      <SyncStatusModal isOpen={showSyncModal} onClose={() => setShowSyncModal(false)} />
    </aside>
  )
}
