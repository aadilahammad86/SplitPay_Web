import React, { useState } from 'react'
import { ThemeProvider } from './ui/themeContext'
import { StoreProvider, useStore } from './ui/storeContext'
import { Navbar } from './ui/components/Navbar'
import { Sidebar } from './ui/components/Sidebar'
import { BottomNav } from './ui/components/BottomNav'
import { DashboardView } from './features/dashboard/DashboardView'
import { FriendsView } from './features/friends/FriendsView'
import { GroupsView } from './features/groups/GroupsView'
import { ActivityView } from './features/activity/ActivityView'
import { StatementsView } from './features/statements/StatementsView'
import { SettingsView } from './features/settings/SettingsView'
import { ExpenseEditorModal } from './features/expense/ExpenseEditorModal'
import { InstallModal } from './pwa/InstallModal'

const AppContent: React.FC = () => {
  const { ledgerState } = useStore()
  const [currentTab, setCurrentTab] = useState<string>('dashboard')
  const [statementSubjectId, setStatementSubjectId] = useState<string | null>(null)
  const [showGlobalExpenseModal, setShowGlobalExpenseModal] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)

  if (!ledgerState.initialized) {
    return (
      <div className="flex-1 min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[var(--color-bg)]">
        <div className="w-14 h-14 rounded-3xl bg-indigo-600 flex items-center justify-center text-white text-3xl font-extrabold animate-pulse shadow-xl mb-4">
          ₹
        </div>
        <h2 className="font-extrabold text-xl text-[var(--color-text)] tracking-tight">SplitPay</h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
          Initializing local IndexedDB ledger...
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
    <div className="flex min-h-screen bg-[var(--color-bg)] transition-colors duration-200">
      {/* Desktop/Tablet Left Sidebar Navigation (Adaptive LY-03) */}
      <Sidebar
        currentTab={currentTab}
        onNavigate={setCurrentTab}
        onAddExpense={() => setShowGlobalExpenseModal(true)}
        onOpenInstall={() => setShowInstallModal(true)}
      />

      {/* Main Area: Top Mobile Header + Scrollable Viewport */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Mobile Top Header */}
        <Navbar currentTab={currentTab} onNavigate={setCurrentTab} />

        {/* Main Responsive View Container (Dynamic Centered Area) */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
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

        {/* Mobile Floating Bottom Navigation Dock */}
        <BottomNav currentTab={currentTab} onNavigate={setCurrentTab} />
      </div>

      {/* Global Modals */}
      {showGlobalExpenseModal && (
        <ExpenseEditorModal
          isOpen={showGlobalExpenseModal}
          onClose={() => setShowGlobalExpenseModal(false)}
        />
      )}

      <InstallModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />
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
