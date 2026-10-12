import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { ThemeProvider } from '../src/ui/themeContext'
import { StoreProvider } from '../src/ui/storeContext'
import { ErrorBoundary } from '../src/ui/components/ErrorBoundary'
import App from '../src/App'
import { DashboardView } from '../src/features/dashboard/DashboardView'
import { FriendsView } from '../src/features/friends/FriendsView'
import { GroupsView } from '../src/features/groups/GroupsView'
import { ActivityView } from '../src/features/activity/ActivityView'
import { StatementsView } from '../src/features/statements/StatementsView'
import { SettingsView } from '../src/features/settings/SettingsView'
import { SuperAdminView } from '../src/features/admin/SuperAdminView'
import { OnboardingModal } from '../src/features/onboarding/OnboardingModal'
import { EmailVerificationModal } from '../src/features/auth/EmailVerificationModal'
import { PhoneLinkingModal } from '../src/features/auth/PhoneLinkingModal'
import { ContactSyncModal } from '../src/features/contacts/ContactSyncModal'
import { ExpenseEditorModal } from '../src/features/expense/ExpenseEditorModal'
import { SettleUpModal } from '../src/features/settle/SettleUpModal'
import { CreateGroupModal } from '../src/features/groups/CreateGroupModal'
import { InstallModal } from '../src/pwa/InstallModal'
import { AcceptInviteModal } from '../src/features/invite/AcceptInviteModal'

describe('Application & Views Render Tests', () => {
  const wrap = (node: React.ReactNode) => (
    <ThemeProvider>
      <StoreProvider>
        {node}
      </StoreProvider>
    </ThemeProvider>
  )

  it('renders root App with ErrorBoundary without throwing', () => {
    const html = renderToString(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    )
    expect(html).toBeDefined()
    expect(html).toContain('SplitPay')
  })

  it('renders ErrorBoundary fallback when error is caught', () => {
    const errorState = ErrorBoundary.getDerivedStateFromError(new Error('Sample error'))
    expect(errorState.hasError).toBe(true)
    expect(errorState.error.message).toBe('Sample error')

    // Test rendering ErrorBoundary directly
    const html = renderToString(
      <ErrorBoundary fallback={<div data-testid="fallback">Custom Fallback</div>}>
        <div>Safe Child</div>
      </ErrorBoundary>
    )
    expect(html).toContain('Safe Child')
  })

  it('renders DashboardView', () => {
    const html = renderToString(
      wrap(<DashboardView onNavigate={() => {}} onSelectFriend={() => {}} onSelectGroup={() => {}} />)
    )
    expect(html).toBeDefined()
  })

  it('renders FriendsView', () => {
    const html = renderToString(
      wrap(<FriendsView onNavigateToStatement={() => {}} />)
    )
    expect(html).toBeDefined()
  })

  it('renders GroupsView', () => {
    const html = renderToString(
      wrap(<GroupsView onNavigateToGroupStatement={() => {}} />)
    )
    expect(html).toBeDefined()
  })

  it('renders ActivityView', () => {
    const html = renderToString(wrap(<ActivityView />))
    expect(html).toBeDefined()
  })

  it('renders StatementsView', () => {
    const html = renderToString(wrap(<StatementsView />))
    expect(html).toBeDefined()
  })

  it('renders SettingsView', () => {
    const html = renderToString(wrap(<SettingsView onOpenAdmin={() => {}} />))
    expect(html).toBeDefined()
  })

  it('renders SuperAdminView', () => {
    const html = renderToString(wrap(<SuperAdminView onBackToApp={() => {}} />))
    expect(html).toBeDefined()
  })
})

describe('Modal Render Tests', () => {
  const wrap = (node: React.ReactNode) => (
    <ThemeProvider>
      <StoreProvider>
        {node}
      </StoreProvider>
    </ThemeProvider>
  )

  it('renders OnboardingModal open', () => {
    const html = renderToString(wrap(<OnboardingModal isOpen={true} onClose={() => {}} />))
    expect(html).toBeDefined()
  })

  it('renders EmailVerificationModal open', () => {
    const html = renderToString(wrap(<EmailVerificationModal isOpen={true} onClose={() => {}} />))
    expect(html).toBeDefined()
  })

  it('renders PhoneLinkingModal open', () => {
    const html = renderToString(wrap(<PhoneLinkingModal isOpen={true} onClose={() => {}} />))
    expect(html).toBeDefined()
  })

  it('renders ContactSyncModal open', () => {
    const html = renderToString(wrap(<ContactSyncModal isOpen={true} onClose={() => {}} />))
    expect(html).toBeDefined()
  })

  it('renders ExpenseEditorModal open', () => {
    const html = renderToString(wrap(<ExpenseEditorModal isOpen={true} onClose={() => {}} />))
    expect(html).toBeDefined()
  })

  it('renders SettleUpModal open', () => {
    const html = renderToString(wrap(<SettleUpModal isOpen={true} onClose={() => {}} />))
    expect(html).toBeDefined()
  })

  it('renders CreateGroupModal open', () => {
    const html = renderToString(wrap(<CreateGroupModal isOpen={true} onClose={() => {}} />))
    expect(html).toBeDefined()
  })

  it('renders InstallModal open', () => {
    const html = renderToString(wrap(<InstallModal isOpen={true} onClose={() => {}} />))
    expect(html).toBeDefined()
  })

  it('renders AcceptInviteModal', () => {
    const html = renderToString(wrap(<AcceptInviteModal />))
    expect(html).toBeDefined()
  })
})
