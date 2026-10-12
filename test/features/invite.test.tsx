import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { ThemeProvider } from '../../src/ui/themeContext'
import { StoreProvider } from '../../src/ui/storeContext'
import { AcceptInviteModal } from '../../src/features/invite/AcceptInviteModal'

describe('Features - AcceptInviteModal', () => {
  it('renders without throwing in SSR when window is undefined', () => {
    const html = renderToString(
      <ThemeProvider>
        <StoreProvider>
          <AcceptInviteModal />
        </StoreProvider>
      </ThemeProvider>
    )

    expect(html).toBeDefined()
  })

  it('handles simulated browser window location with invite code', () => {
    // @ts-expect-error Mock window
    globalThis.window = {
      location: {
        href: 'https://splitpay.app/?invite=sp_test123&name=Alice',
        search: '?invite=sp_test123&name=Alice',
        hash: '',
        pathname: '/',
        origin: 'https://splitpay.app',
      },
      history: {
        replaceState: () => {},
      },
      document: { title: 'SplitPay' },
    }

    try {
      const html = renderToString(
        <ThemeProvider>
          <StoreProvider>
            <AcceptInviteModal />
          </StoreProvider>
        </ThemeProvider>
      )
      expect(html).toBeDefined()
    } finally {
      // @ts-expect-error Cleanup
      delete globalThis.window
    }
  })
})
