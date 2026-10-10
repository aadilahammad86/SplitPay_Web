/**
 * Super Admin Authentication Service
 * Controls access to app-wide infrastructure (Supabase configuration,
 * shared ledger infrastructure, outbox operations, and system telemetry).
 */

const ADMIN_STORAGE_KEY = 'splitpay_superadmin_pwd_hash'
const ADMIN_SESSION_KEY = 'splitpay_superadmin_session'

// Canonical Super Admin Username & Default Password
export const SUPERADMIN_DEFAULT_USER = 'superadmin'
export const SUPERADMIN_DEFAULT_PASSWORD = 'SplitPay@SuperAdmin2026!'

async function hashString(str: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(str + '_splitpay_superadmin_salt')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  // Simple fallback for environments without subtle crypto
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return 'fallback_' + Math.abs(hash).toString(16)
}

export class AdminAuthService {
  private defaultHashPromise: Promise<string>

  constructor() {
    this.defaultHashPromise = hashString(SUPERADMIN_DEFAULT_PASSWORD)
  }

  /**
   * Checks if an active Super Admin session exists.
   */
  isAuthenticated(): boolean {
    if (typeof localStorage === 'undefined') return false
    const session = localStorage.getItem(ADMIN_SESSION_KEY)
    if (!session) return false

    try {
      const parsed = JSON.parse(session)
      // Session expires after 24 hours
      if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
        this.logout()
        return false
      }
      return parsed.authenticated === true
    } catch {
      this.logout()
      return false
    }
  }

  /**
   * Authenticates super admin credentials.
   */
  async login(usernameInput: string, passwordInput: string): Promise<{ success: boolean; error?: string }> {
    const cleanUser = usernameInput.trim().toLowerCase()
    const cleanPass = passwordInput.trim()

    // Accept 'superadmin', 'admin', or 'admin@splitpay.app'
    const allowedUsernames = [
      SUPERADMIN_DEFAULT_USER.toLowerCase(),
      'admin',
      'admin@splitpay.app',
    ]

    if (!allowedUsernames.includes(cleanUser)) {
      return { success: false, error: 'Invalid Super Admin username or email.' }
    }

    const inputHash = await hashString(cleanPass)
    const savedHash = typeof localStorage !== 'undefined' ? localStorage.getItem(ADMIN_STORAGE_KEY) : null
    const targetHash = savedHash || (await this.defaultHashPromise)

    if (inputHash !== targetHash) {
      return { success: false, error: 'Incorrect Super Admin password.' }
    }

    // Set authenticated session
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        ADMIN_SESSION_KEY,
        JSON.stringify({
          authenticated: true,
          username: cleanUser,
          timestamp: Date.now(),
        })
      )
    }

    return { success: true }
  }

  /**
   * Logs out of Super Admin mode.
   */
  logout(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ADMIN_SESSION_KEY)
    }
  }

  /**
   * Allows the Super Admin to change their password.
   */
  async changePassword(
    currentPass: string,
    newPass: string
  ): Promise<{ success: boolean; error?: string }> {
    const verifyCurrent = await this.login(SUPERADMIN_DEFAULT_USER, currentPass)
    if (!verifyCurrent.success) {
      return { success: false, error: 'Current password verification failed.' }
    }

    if (newPass.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters long.' }
    }

    const newHash = await hashString(newPass)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ADMIN_STORAGE_KEY, newHash)
    }

    return { success: true }
  }
}

export const defaultAdminAuthService = new AdminAuthService()
