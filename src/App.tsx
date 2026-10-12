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
import { OnboardingModal } from './features/onboarding/OnboardingModal'
import { SuperAdminView } from './features/admin/SuperAdminView'
import { AcceptInviteModal } from './features/invite/AcceptInviteModal'
import { AuthScreen } from './features/auth/AuthScreen'
import { defaultAuthService, type UserAccount } from './services/auth/authService'
import { Icon } from './ui/components/Icon'

const AppContent: React.FC = () => {
  const { store, ledgerState } = useStore()
  const [session, setSession] = useState<UserAccount | null>(() => defaultAuthService.getCurrentSession())

  React.useEffect(() => {
    return defaultAuthService.subscribe((s) => {
      setSession(s)
    })
  }, [])
  const [currentTab, setCurrentTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#admin' || window.location.search.includes('admin=1')) {
        return 'admin'
      }
    }
    return 'dashboard'
  })
  const [statementSubjectId, setStatementSubjectId] = useState<string | null>(null)
  const [showGlobalExpenseModal, setShowGlobalExpenseModal] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)

  // Onboarding Wizard (shown on first launch or via settings)
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('splitpay_onboarding_completed') === null
    }
    return false
  })

  // App Passcode Lock
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      return !!localStorage.getItem('splitpay_app_passcode')
    }
    return false
  })
  const [passcodeInput, setPasscodeInput] = useState('')
  const [passcodeError, setPasscodeError] = useState(false)

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault()
    const saved = localStorage.getItem('splitpay_app_passcode')
    if (passcodeInput === saved) {
      setIsLocked(false)
      setPasscodeInput('')
      setPasscodeError(false)
    } else {
      setPasscodeError(true)
    }
  }

  const [initSlow, setInitSlow] = useState(false)
  React.useEffect(() => {
    if (!ledgerState.initialized) {
      const timer = setTimeout(() => setInitSlow(true), 3500)
      return () => clearTimeout(timer)
    }
  }, [ledgerState.initialized])

  if (!ledgerState.initialized) {
    return (
      <div className="flex-1 min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[var(--color-bg)]">
        <div className="w-14 h-14 rounded-3xl bg-primary flex items-center justify-center text-white text-3xl font-extrabold animate-pulse shadow-xl mb-4">
          <Icon name="rupee" size={32} />
        </div>
        <h2 className="font-extrabold text-xl text-[var(--color-text)] tracking-tight">SplitPay</h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
          Initializing local IndexedDB ledger...
        </p>

        {initSlow && (
          <div className="mt-6 max-w-xs space-y-3 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl animate-fade-in shadow-md">
            <p className="text-xs text-[var(--color-text-muted)]">
              Initialization is taking longer than usual. If your browser is restricting storage or tab locks:
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 py-2 px-3 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl"
              >
                Reload
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.clear()
                    if ('indexedDB' in window) window.indexedDB.deleteDatabase('splitpay_db')
                  } finally {
                    window.location.reload()
                  }
                }}
                className="flex-1 py-2 px-3 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold rounded-xl"
              >
                Reset DB
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Authentication Screen (Login / Sign Up / Guest Mode)
  if (!session && currentTab !== 'admin') {
    return (
      <AuthScreen
        onAuthenticated={async (account) => {
          setSession(account)
          await store.updateLocalProfile({
            id: account.id,
            name: account.name,
            handle: account.isGuest ? undefined : account.username,
            email: account.email,
            phone: account.phone,
          })
        }}
      />
    )
  }

  // Passcode Lock Screen
  if (isLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-bg)] text-[var(--color-text)] animate-fade-in">
        <div className="w-full max-w-sm p-6 sm:p-8 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-primary-subtle text-primary border border-primary-border flex items-center justify-center text-2xl mx-auto shadow-sm">
            <Icon name="lock" size={28} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">SplitPay Locked</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Enter your personal app passcode to access your ledger
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <input
                type="password"
                required
                autoFocus
                placeholder="Enter passcode"
                value={passcodeInput}
                onChange={(e) => {
                  setPasscodeInput(e.target.value)
                  setPasscodeError(false)
                }}
                className={`w-full px-4 py-3 bg-[var(--color-surface-subtle)] border rounded-2xl text-center font-mono text-lg font-bold tracking-widest focus:outline-none ${
                  passcodeError
                    ? 'border-rose-500 ring-2 ring-rose-500/20'
                    : 'border-[var(--color-border)]'
                }`}
              />
              {passcodeError && (
                <p className="text-xs text-rose-500 font-semibold mt-1.5 animate-fade-in">
                  Incorrect passcode. Please try again.
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-primary hover:bg-primary-hover text-white font-bold text-sm rounded-2xl shadow-md transition-all active:scale-95 inline-flex items-center justify-center gap-2"
            >
              <Icon name="unlock" size={16} />
              <span>Unlock Ledger</span>
            </button>
          </form>
        </div>
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
        <main className="flex-1 w-full max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 pb-32 md:pb-10">
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

          {currentTab === 'settings' && (
            <SettingsView onOpenAdmin={() => setCurrentTab('admin')} />
          )}

          {currentTab === 'admin' && (
            <SuperAdminView onBackToApp={() => setCurrentTab('settings')} />
          )}
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

      {/* First-Time Value-First Setup Wizard Onboarding */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />

      {/* Invite Link Accept Modal */}
      <AcceptInviteModal onNavigate={setCurrentTab} />
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
