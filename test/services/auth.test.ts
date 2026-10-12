import { describe, it, expect, beforeEach } from 'vitest'
import { AuthService, hashPassword, SESSION_KEY } from '../../src/services/auth/authService'

describe('AuthService - Username/Password & Guest Authentication', () => {
  let authService: AuthService
  const storageMock = (() => {
    let store: Record<string, string> = {}
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString()
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => {
        store = {}
      },
    }
  })()

  beforeEach(() => {
    // @ts-expect-error Mocking globalThis.localStorage for test
    globalThis.localStorage = storageMock
    storageMock.clear()
    authService = new AuthService()
  })

  it('initially reports no session when storage is empty', () => {
    expect(authService.getCurrentSession()).toBeNull()
  })

  it('hashes passwords deterministically', async () => {
    const hash1 = await hashPassword('secret123', 'aadil')
    const hash2 = await hashPassword('secret123', 'aadil')
    const hashOther = await hashPassword('different', 'aadil')

    expect(hash1).toBe(hash2)
    expect(hash1).not.toBe(hashOther)
  })

  it('registers a new user with username and password', async () => {
    const res = await authService.register({
      name: 'Aadil Ahammad',
      username: 'aadil',
      password: 'password123',
    })

    expect(res.success).toBe(true)
    expect(res.account).toBeDefined()
    expect(res.account?.username).toBe('aadil')
    expect(res.account?.isGuest).toBe(false)

    // Current session is set
    const current = authService.getCurrentSession()
    expect(current?.username).toBe('aadil')
    expect(current?.name).toBe('Aadil Ahammad')
  })

  it('rejects duplicate username registration on device', async () => {
    await authService.register({
      name: 'First User',
      username: 'aadil',
      password: 'password123',
    })

    const second = await authService.register({
      name: 'Second User',
      username: 'aadil',
      password: 'password456',
    })

    expect(second.success).toBe(false)
    expect(second.error).toContain('already registered')
  })

  it('authenticates an existing user with correct password', async () => {
    await authService.register({
      name: 'Aadil',
      username: 'aadil',
      password: 'mypassword',
    })

    // Log out first
    authService.logout()
    expect(authService.getCurrentSession()).toBeNull()

    // Log in
    const loginRes = await authService.login('aadil', 'mypassword')
    expect(loginRes.success).toBe(true)
    expect(loginRes.account?.username).toBe('aadil')
    expect(authService.getCurrentSession()?.username).toBe('aadil')
  })

  it('rejects login with wrong password', async () => {
    await authService.register({
      name: 'Aadil',
      username: 'aadil',
      password: 'correctpassword',
    })

    authService.logout()

    const loginRes = await authService.login('aadil', 'wrongpassword')
    expect(loginRes.success).toBe(false)
    expect(loginRes.error).toContain('Incorrect password')
    expect(authService.getCurrentSession()).toBeNull()
  })

  it('allows logging in as a guest user without credentials', async () => {
    const guestRes = await authService.loginAsGuest('Traveler')
    expect(guestRes.success).toBe(true)
    expect(guestRes.account.isGuest).toBe(true)
    expect(guestRes.account.name).toBe('Traveler')
    expect(authService.getCurrentSession()?.isGuest).toBe(true)
  })

  it('clears session upon logout and notifies subscribers', () => {
    let notified: boolean = false
    authService.subscribe((s) => {
      if (s === null) notified = true
    })

    storageMock.setItem(SESSION_KEY, JSON.stringify({ id: 'u1', name: 'User', username: 'u', isGuest: false }))
    expect(authService.getCurrentSession()).not.toBeNull()

    authService.logout()
    expect(authService.getCurrentSession()).toBeNull()
    expect(notified).toBe(true)
  })
})
