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
  ]

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-surface)]/95 backdrop-blur-md border-t border-[var(--color-border)] px-2 py-1 safe-bottom">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-medium'
              }`}
            >
              <span className="text-xl mb-0.5">{tab.icon}</span>
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
