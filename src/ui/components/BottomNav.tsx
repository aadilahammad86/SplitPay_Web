import React from 'react'
import { Icon, type IconName } from './Icon'

interface BottomNavProps {
  currentTab: string
  onNavigate: (tab: string) => void
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onNavigate }) => {
  const tabs: { id: string; label: string; icon: IconName }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    { id: 'credit', label: 'Lent/Credit', icon: 'creditcard' },
    { id: 'friends', label: 'Friends', icon: 'user' },
    { id: 'groups', label: 'Groups', icon: 'users' },
    { id: 'activity', label: 'Activity', icon: 'receipt' },
    { id: 'statements', label: 'Statements', icon: 'chart' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-surface)]/95 backdrop-blur-lg border-t border-[var(--color-border)] px-1 py-1 safe-bottom shadow-lg">
      <div className="flex items-center justify-between max-w-lg mx-auto w-full">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`bottom-nav-item flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all relative ${
                isActive
                  ? 'text-primary font-bold'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-medium'
              }`}
            >
              {isActive && (
                <span
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-1 rounded-full bg-primary"
                  style={{ boxShadow: '0 0 8px var(--color-primary-glow)' }}
                />
              )}
              <span className="mb-0.5 shrink-0">
                <Icon name={tab.icon} size={18} strokeWidth={isActive ? 2.5 : 2} />
              </span>
              <span className="text-[9px] sm:text-[10px] tracking-tight truncate w-full text-center">
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
