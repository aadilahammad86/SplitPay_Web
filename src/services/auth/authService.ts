import { generateUlid } from '../../domain/ulid'
import { getSupabaseClient } from '../../supabase/supabaseClient'
import { verifyTotpCode } from '../../domain/totp'
import { defaultDeviceService, getDeviceName, type UserDevice } from '../device/deviceService'

export interface UserAccount {
  id: string
  name: string
  username: string
  email?: string
  phone?: string
  isGuest: boolean
  avatarUrl?: string
  totpEnabled?: boolean
}

export interface StoredCredentials {
  id: string
  name: string
  username: string
  email?: string
  passwordHash?: string
  salt?: string
  isGuest: boolean
  totpEnabled?: boolean
  createdAt: string
}

export interface LoginResult {
  success: boolean
  account?: UserAccount
  requiresTotp?: boolean
  requiresDeviceRevoke?: boolean
  devices?: UserDevice[]
  tempAccount?: UserAccount
  error?: string
}

export const SESSION_KEY = 'splitpay_current_session'
export const ACCOUNTS_KEY = 'splitpay_accounts_store'

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(`${salt}:${password}:splitpay_v1`)
  const subtle = typeof crypto !== 'undefined' && crypto.subtle ? crypto.subtle : null
  if (subtle) {
    const hashBuffer = await subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data[i]) | 0
  }
  return 'fallback_' + Math.abs(hash).toString(16)
}

export class AuthService {
  private listeners = new Set<(session: UserAccount | null) => void>()

  subscribe(listener: (session: UserAccount | null) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(session: UserAccount | null): void {
    for (const listener of this.listeners) {
      listener(session)
    }
  }

  getCurrentSession(): UserAccount | null {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) {
      try {
        return JSON.parse(raw) as UserAccount
      } catch {
        // malformed session
      }
    }

    // Graceful migration: check if previous user was active before auth screen rollout
    const meRaw = localStorage.getItem('splitpay_me')
    const onboardingDone = localStorage.getItem('splitpay_onboarding_completed')
    if (meRaw && onboardingDone === 'true') {
      try {
        const me = JSON.parse(meRaw)
        const guestSession: UserAccount = {
          id: me.id || generateUlid(Date.now()),
          name: me.name || 'You',
          username: me.handle || 'user',
          isGuest: false,
          phone: me.phone,
          email: me.email,
        }
        this.saveSession(guestSession)
        return guestSession
      } catch {
        // ignore
      }
    }

    return null
  }

  private saveSession(session: UserAccount): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    }
    this.notify(session)
  }

  private getStoredAccounts(): Record<string, StoredCredentials> {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    if (!raw) return {}
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }

  private saveStoredAccounts(accounts: Record<string, StoredCredentials>): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
    }
  }

  async register(params: {
    name: string
    username: string
    password?: string
    email?: string
    phone?: string
    isGuest?: boolean
  }): Promise<{ success: boolean; account?: UserAccount; error?: string }> {
    const cleanName = params.name.trim() || 'You'
    const cleanUsername = params.username.trim().toLowerCase().replace(/^@/, '')

    if (!params.isGuest) {
      if (!cleanUsername || cleanUsername.length < 2) {
        return { success: false, error: 'Username must be at least 2 characters long.' }
      }
      if (!params.password || params.password.length < 4) {
        return { success: false, error: 'Password must be at least 4 characters long.' }
      }
    }

    const accounts = this.getStoredAccounts()
    if (!params.isGuest && accounts[cleanUsername]) {
      return { success: false, error: `Username @${cleanUsername} is already registered on this device. Please log in.` }
    }

    const accountId = generateUlid(Date.now())
    const salt = cleanUsername || generateUlid(Date.now())
    const hash = params.password ? await hashPassword(params.password, salt) : undefined

    const credentials: StoredCredentials = {
      id: accountId,
      name: cleanName,
      username: cleanUsername || `guest_${accountId.slice(-6).toLowerCase()}`,
      email: params.email?.trim() || undefined,
      passwordHash: hash,
      salt,
      isGuest: !!params.isGuest,
      createdAt: new Date().toISOString(),
    }

    accounts[credentials.username] = credentials
    this.saveStoredAccounts(accounts)

    const account: UserAccount = {
      id: credentials.id,
      name: credentials.name,
      username: credentials.username,
      email: credentials.email,
      phone: params.phone,
      isGuest: credentials.isGuest,
      avatarUrl: hash ? `auth:sha256:${hash}` : undefined,
    }

    // Attempt cloud profile sync
    try {
      const supabase = getSupabaseClient()
      if (supabase && !params.isGuest) {
        await supabase.from('profiles').upsert({
          id: account.id,
          name: account.name,
          handle: account.username,
          avatar_url: account.avatarUrl,
          password_hash: hash,
          password_salt: salt,
          email: account.email || null,
          discoverable_by_phone: true,
          updated_at: new Date().toISOString(),
        })

        // Register initial device
        await defaultDeviceService.registerOrVerifyDevice(account.id)
      }
    } catch {
      // Offline-first: register succeeds locally even if cloud sync is pending
    }

    this.saveSession(account)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('splitpay_onboarding_completed', 'true')
    }

    return { success: true, account }
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '')
    if (!cleanUsername) {
      return { success: false, error: 'Please enter your username.' }
    }
    if (!password) {
      return { success: false, error: 'Please enter your password.' }
    }

    const accounts = this.getStoredAccounts()
    const local = accounts[cleanUsername]

    if (local && local.passwordHash && local.salt) {
      const computedHash = await hashPassword(password, local.salt)
      if (computedHash === local.passwordHash) {
        const account: UserAccount = {
          id: local.id,
          name: local.name,
          username: local.username,
          email: local.email,
          isGuest: false,
          avatarUrl: `auth:sha256:${local.passwordHash}`,
          totpEnabled: !!local.totpEnabled,
        }

        // Verify active devices
        const deviceCheck = await defaultDeviceService.registerOrVerifyDevice(local.id)
        if (!deviceCheck.allowed && deviceCheck.requiresVerification) {
          return {
            success: false,
            requiresTotp: !!local.totpEnabled,
            requiresDeviceRevoke: true,
            devices: deviceCheck.devices,
            tempAccount: account,
            error: `Device limit reached (${deviceCheck.count}/3 devices). Please disconnect an older device or verify with Google Authenticator.`,
          }
        }

        if (local.totpEnabled) {
          return {
            success: false,
            requiresTotp: true,
            tempAccount: account,
            error: 'Please enter your 6-digit Google Authenticator code.',
          }
        }

        this.saveSession(account)
        return { success: true, account }
      }
      return { success: false, error: 'Incorrect password. Please try again.' }
    }

    // Check remote Supabase profiles for existing cloud account
    try {
      const supabase = getSupabaseClient()
      if (supabase) {
        const { data: rows, error } = await supabase
          .from('profiles')
          .select('*')
          .ilike('handle', cleanUsername)
          .order('updated_at', { ascending: false })

        if (!error && Array.isArray(rows) && rows.length > 0) {
          // Find any profile with registered password credentials
          let authedProfile = rows.find(
            (r) =>
              (r.password_hash && typeof r.password_hash === 'string') ||
              (r.avatar_url && typeof r.avatar_url === 'string' && r.avatar_url.startsWith('auth:sha256:'))
          )

          // Auto-repair fallback: if profile has null avatar_url/password_hash, check sibling profile with same phone or email
          if (!authedProfile && rows.length > 0) {
            const first = rows[0]
            if (first.phone || first.email) {
              const { data: siblings } = await supabase
                .from('profiles')
                .select('*')
                .or(`email.eq.${first.email || 'none'},phone.eq.${first.phone || 'none'}`)
                .not('avatar_url', 'is', null)
                .limit(5)
              const sib = siblings?.find(
                (s) => s.password_hash || (s.avatar_url && s.avatar_url.startsWith('auth:sha256:'))
              )
              if (sib) {
                authedProfile = {
                  ...first,
                  avatar_url: sib.avatar_url,
                  password_hash: sib.password_hash,
                  password_salt: sib.password_salt || cleanUsername,
                }
              }
            }
          }

          if (authedProfile && (authedProfile.avatar_url || authedProfile.password_hash)) {
            const expectedHash = authedProfile.password_hash || authedProfile.avatar_url.replace('auth:sha256:', '')
            const salt = authedProfile.password_salt || cleanUsername
            const computedHash = await hashPassword(password, salt)
            if (computedHash === expectedHash) {
              const profileWithEmail = rows.find((r) => r.email)
              const profileWithPhone = rows.find((r) => r.phone)

              const account: UserAccount = {
                id: authedProfile.id,
                name: authedProfile.name,
                username: authedProfile.handle || cleanUsername,
                email: authedProfile.email || profileWithEmail?.email || undefined,
                phone: authedProfile.phone || profileWithPhone?.phone || undefined,
                isGuest: false,
                avatarUrl: `auth:sha256:${expectedHash}`,
                totpEnabled: !!authedProfile.totp_enabled,
              }

              // Cache credentials locally for offline use
              accounts[cleanUsername] = {
                id: account.id,
                name: account.name,
                username: cleanUsername,
                email: account.email,
                passwordHash: expectedHash,
                salt: salt,
                isGuest: false,
                totpEnabled: account.totpEnabled,
                createdAt: authedProfile.created_at || new Date().toISOString(),
              }
              this.saveStoredAccounts(accounts)

              // Ensure password_hash and avatar_url are permanently stored in Supabase
              Promise.resolve(
                supabase
                  .from('profiles')
                  .update({
                    avatar_url: `auth:sha256:${expectedHash}`,
                    password_hash: expectedHash,
                    password_salt: salt,
                  })
                  .eq('id', authedProfile.id)
              ).catch(() => {})

              // Verify active devices
              const deviceCheck = await defaultDeviceService.registerOrVerifyDevice(
                account.id,
                undefined,
                getDeviceName()
              )

              if (!deviceCheck.allowed && deviceCheck.requiresVerification) {
                return {
                  success: false,
                  requiresTotp: !!authedProfile.totp_enabled,
                  requiresDeviceRevoke: true,
                  devices: deviceCheck.devices,
                  tempAccount: account,
                  error: deviceCheck.error || `Device limit reached (${deviceCheck.count}/3 devices). Please disconnect an older device or verify with Google Authenticator.`,
                }
              }

              if (authedProfile.totp_enabled) {
                return {
                  success: false,
                  requiresTotp: true,
                  tempAccount: account,
                  error: 'Please enter your 6-digit Google Authenticator code.',
                }
              }

              this.saveSession(account)
              return { success: true, account }
            }
            return { success: false, error: 'Incorrect password. Please try again.' }
          }
          return { success: false, error: 'This username exists as a contact without a password. Please sign up to create your account.' }
        }
      }
    } catch {
      // Remote lookup failed
    }

    return { success: false, error: 'No account found with this username. Please check your spelling or sign up.' }
  }

  async completeLoginWithTotp(account: UserAccount, totpCode: string): Promise<LoginResult> {
    const isValid = await this.verifyTotpForLogin(account.id, totpCode)
    if (!isValid) {
      return { success: false, error: 'Invalid 6-digit Google Authenticator code. Please try again.' }
    }

    // Authorize additional device if limit reached
    await defaultDeviceService.authorizeAdditionalDevice(account.id)
    this.saveSession(account)
    return { success: true, account }
  }

  async completeLoginWithDeviceRevoke(
    account: UserAccount,
    revokeDeviceId: string,
    totpCode?: string
  ): Promise<LoginResult> {
    if (account.totpEnabled) {
      if (!totpCode) {
        return { success: false, error: 'Google Authenticator 2FA code is required to revoke devices.' }
      }
      const isValid = await this.verifyTotpForLogin(account.id, totpCode)
      if (!isValid) {
        return { success: false, error: 'Invalid Google Authenticator code.' }
      }
    }

    await defaultDeviceService.revokeDevice(account.id, revokeDeviceId)
    const check = await defaultDeviceService.registerOrVerifyDevice(account.id)
    if (!check.allowed) {
      return { success: false, error: 'Unable to connect device after revocation. Please try again.' }
    }

    this.saveSession(account)
    return { success: true, account }
  }

  async enableTotp(
    userId: string,
    secret: string,
    verificationCode: string
  ): Promise<{ success: boolean; error?: string }> {
    const isValid = await verifyTotpCode(verificationCode, secret)
    if (!isValid) {
      return {
        success: false,
        error: 'Invalid 6-digit verification code. Please check your Google Authenticator app and try again.',
      }
    }

    try {
      const supabase = getSupabaseClient()
      if (supabase) {
        await supabase
          .from('profiles')
          .update({
            totp_secret: secret,
            totp_enabled: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
      }

      const current = this.getCurrentSession()
      if (current && current.id === userId) {
        current.totpEnabled = true
        this.saveSession(current)
      }

      // Update local storage credentials
      const accounts = this.getStoredAccounts()
      for (const key of Object.keys(accounts)) {
        if (accounts[key]?.id === userId) {
          accounts[key]!.totpEnabled = true
        }
      }
      this.saveStoredAccounts(accounts)

      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to enable 2FA.' }
    }
  }

  async disableTotp(
    userId: string,
    verificationCode: string
  ): Promise<{ success: boolean; error?: string }> {
    const secret = await this.getTotpSecret(userId)
    if (secret) {
      const isValid = await verifyTotpCode(verificationCode, secret)
      if (!isValid) {
        return { success: false, error: 'Invalid 6-digit verification code.' }
      }
    }

    try {
      const supabase = getSupabaseClient()
      if (supabase) {
        await supabase
          .from('profiles')
          .update({
            totp_secret: null,
            totp_enabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
      }

      const current = this.getCurrentSession()
      if (current && current.id === userId) {
        current.totpEnabled = false
        this.saveSession(current)
      }

      const accounts = this.getStoredAccounts()
      for (const key of Object.keys(accounts)) {
        if (accounts[key]?.id === userId) {
          accounts[key]!.totpEnabled = false
        }
      }
      this.saveStoredAccounts(accounts)

      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to disable 2FA.' }
    }
  }

  async getTotpSecret(userId: string): Promise<string | null> {
    try {
      const supabase = getSupabaseClient()
      if (!supabase) return null
      const { data } = await supabase.from('profiles').select('totp_secret').eq('id', userId).single()
      return data?.totp_secret || null
    } catch {
      return null
    }
  }

  async verifyTotpForLogin(userId: string, code: string): Promise<boolean> {
    const secret = await this.getTotpSecret(userId)
    if (!secret) return false
    return verifyTotpCode(code, secret)
  }

  async loginAsGuest(guestName?: string): Promise<{ success: boolean; account: UserAccount }> {
    const name = guestName?.trim() || 'Guest User'
    const guestId = generateUlid(Date.now())
    const account: UserAccount = {
      id: guestId,
      name,
      username: `guest_${guestId.slice(-6).toLowerCase()}`,
      isGuest: true,
    }

    this.saveSession(account)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('splitpay_onboarding_completed', 'true')
    }

    return { success: true, account }
  }

  logout(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_KEY)
    }
    this.notify(null)
  }

  async checkUsernameAvailability(
    username: string,
    currentUserId?: string,
    knownMeIds?: Set<string>
  ): Promise<UsernameCheckResult> {
    const clean = username.trim().toLowerCase().replace(/^@/, '')
    if (!clean) {
      return { available: false, status: 'idle', message: '' }
    }
    if (clean.length < 3) {
      return {
        available: false,
        status: 'invalid',
        message: 'Username must be at least 3 characters',
      }
    }
    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      return {
        available: false,
        status: 'invalid',
        message: 'Only letters, numbers, and underscores allowed',
      }
    }
    if (clean.length > 30) {
      return {
        available: false,
        status: 'invalid',
        message: 'Username cannot exceed 30 characters',
      }
    }

    // If candidate matches the current session username, it belongs to this user
    const session = this.getCurrentSession()
    if (session && session.username?.toLowerCase() === clean) {
      return {
        available: true,
        status: 'available',
        message: '✓ This is your current username',
      }
    }

    // 1. Check local device registered accounts
    const localAccounts = this.getStoredAccounts()
    const existingLocal = localAccounts[clean]
    if (
      existingLocal &&
      existingLocal.id !== currentUserId &&
      (!knownMeIds || !knownMeIds.has(existingLocal.id))
    ) {
      return {
        available: false,
        status: 'unavailable',
        message: `@${clean} is already registered on this device`,
      }
    }

    // 2. Check remote cloud Supabase profiles
    try {
      const supabase = getSupabaseClient()
      if (supabase) {
        const { data: rows, error } = await supabase
          .from('profiles')
          .select('id, handle, invite_code')
          .or(`handle.ilike.${clean},invite_code.ilike.${clean}`)
          .limit(10)

        if (!error && Array.isArray(rows) && rows.length > 0) {
          const conflicting = rows.find((r) => {
            if (currentUserId && r.id === currentUserId) return false
            if (knownMeIds && knownMeIds.has(r.id)) return false
            if (session && r.id === session.id) return false
            const rHandle = (r.handle || '').toLowerCase()
            const rInvite = (r.invite_code || '').toLowerCase()
            return rHandle === clean || rInvite === clean
          })

          if (conflicting) {
            return {
              available: false,
              status: 'unavailable',
              message: `@${clean} is already taken`,
            }
          }
        }
      }
    } catch {
      // Offline fallback: if cloud unreachable, local check stands
    }

    return {
      available: true,
      status: 'available',
      message: `✓ @${clean} is available`,
    }
  }
}

export interface UsernameCheckResult {
  available: boolean
  status: 'idle' | 'available' | 'unavailable' | 'invalid'
  message: string
}

export const defaultAuthService = new AuthService()
