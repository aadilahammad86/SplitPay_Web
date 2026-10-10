import { describe, it, expect, beforeEach } from 'vitest'
import {
  AdminAuthService,
  SUPERADMIN_DEFAULT_USER,
  SUPERADMIN_DEFAULT_PASSWORD,
} from '../../src/services/admin/adminAuthService'

describe('AdminAuthService - Super Admin Access Control', () => {
  let adminService: AdminAuthService
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
    adminService = new AdminAuthService()
  })

  it('initially reports unauthenticated when no session exists', () => {
    expect(adminService.isAuthenticated()).toBe(false)
  })

  it('rejects login with unknown username', async () => {
    const res = await adminService.login('unknown_user', SUPERADMIN_DEFAULT_PASSWORD)
    expect(res.success).toBe(false)
    expect(res.error).toContain('Invalid Super Admin username')
    expect(adminService.isAuthenticated()).toBe(false)
  })

  it('rejects login with wrong password', async () => {
    const res = await adminService.login(SUPERADMIN_DEFAULT_USER, 'WrongPassword123!')
    expect(res.success).toBe(false)
    expect(res.error).toContain('Incorrect Super Admin password')
    expect(adminService.isAuthenticated()).toBe(false)
  })

  it('authenticates successfully with canonical superadmin credentials', async () => {
    const res = await adminService.login(SUPERADMIN_DEFAULT_USER, SUPERADMIN_DEFAULT_PASSWORD)
    expect(res.success).toBe(true)
    expect(adminService.isAuthenticated()).toBe(true)
  })

  it('accepts valid aliases like "admin" and "admin@splitpay.app"', async () => {
    const res1 = await adminService.login('admin', SUPERADMIN_DEFAULT_PASSWORD)
    expect(res1.success).toBe(true)

    adminService.logout()

    const res2 = await adminService.login('admin@splitpay.app', SUPERADMIN_DEFAULT_PASSWORD)
    expect(res2.success).toBe(true)
    expect(adminService.isAuthenticated()).toBe(true)
  })

  it('clears authentication on logout', async () => {
    await adminService.login(SUPERADMIN_DEFAULT_USER, SUPERADMIN_DEFAULT_PASSWORD)
    expect(adminService.isAuthenticated()).toBe(true)

    adminService.logout()
    expect(adminService.isAuthenticated()).toBe(false)
  })

  it('allows changing the superadmin password and requires the new password subsequently', async () => {
    const newPass = 'BrandNewSecretPass2026!'
    const changeRes = await adminService.changePassword(SUPERADMIN_DEFAULT_PASSWORD, newPass)
    expect(changeRes.success).toBe(true)

    adminService.logout()

    // Old password should now fail
    const oldLogin = await adminService.login(SUPERADMIN_DEFAULT_USER, SUPERADMIN_DEFAULT_PASSWORD)
    expect(oldLogin.success).toBe(false)

    // New password should succeed
    const newLogin = await adminService.login(SUPERADMIN_DEFAULT_USER, newPass)
    expect(newLogin.success).toBe(true)
    expect(adminService.isAuthenticated()).toBe(true)
  })
})
