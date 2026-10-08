import React, { useState } from 'react'
import { ThemeProvider } from './ui/themeContext'
import { StoreProvider, useStore } from './ui/storeContext'
import { Navbar } from './ui/components/Navbar'
import { BottomNav } from './ui/components/BottomNav'
import { DashboardView } from './features/dashboard/DashboardView'
import { FriendsView } from './features/friends/FriendsView'
import { GroupsView } from './features/groups/GroupsView'
import { ActivityView } from './features/activity/ActivityView'
import { StatementsView } from './features/statements/StatementsView'
import { SettingsView } from './features/settings/SettingsView'

const AppContent: React.FC = () => {
  const { ledgerState } = useStore()
  const [currentTab, setCurrentTab] = useState<string>('dashboard')
  const [statementSubjectId, setStatementSubjectId] = useState<string | null>(null)

  if (!ledgerState.initialized) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold animate-pulse shadow-lg mb-4">
          ₹
        </div>
        <h2 className="font-extrabold text-lg text-[var(--color-text)]">SplitPay</h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Loading local ledger from storage...
        </p>
      </div>
    )
  }

  const navigateToFriendStatement = (friendId: string) => {
    setStatementSubjectId(friendId)
    setCurrentTab('statements')
  }

  const navigateToGroupStatement = (groupId: string) => {
    setStatementSubjectId(groupId)
    setCurrentTab('statements')
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar currentTab={currentTab} onNavigate={setCurrentTab} />

      {/* Main Responsive View Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 pb-24 sm:pb-8">
        {currentTab === 'dashboard' && (
          <DashboardView
            onNavigate={setCurrentTab}
            onSelectFriend={(fId) => navigateToFriendStatement(fId)}
            onSelectGroup={(gId) => navigateToGroupStatement(gId)}
          />
        )}

        {currentTab === 'friends' && (
          <FriendsView onNavigateToStatement={navigateToFriendStatement} />
        )}

        {currentTab === 'groups' && (
          <GroupsView onNavigateToGroupStatement={navigateToGroupStatement} />
        )}

        {currentTab === 'activity' && <ActivityView />}

        {currentTab === 'statements' && (
          <StatementsView initialSubjectId={statementSubjectId} />
        )}

        {currentTab === 'settings' && <SettingsView />}
      </main>

      <BottomNav currentTab={currentTab} onNavigate={setCurrentTab} />
    </div>
  )
}

export function App() {
  return (
    <ThemeProvider>
      <StoreProvider>
        <AppContent />
      </StoreProvider>
    </ThemeProvider>
  )
}

export default App
