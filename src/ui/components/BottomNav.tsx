import React from 'react'

interface BottomNavProps {
  currentTab: string
  onNavigate: (tab: string) => void
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onNavigate }) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'friends', label: 'Friends', icon: '👥' },
    { id: 'groups', label: 'Groups', icon: '🏝' },
    { id: 'activity', label: 'Activity', icon: '🧾' },
    { id: 'statements', label: 'Statements', icon: '📊' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-surface)]/90 backdrop-blur-lg border-t border-[var(--color-border)] px-2 py-1 safe-bottom shadow-lg">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all relative ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-medium'
              }`}
            >
              {isActive && (
                <span className="absolute -top-1 w-6 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400" />
              )}
              <span className="text-lg leading-none mb-0.5">{tab.icon}</span>
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
