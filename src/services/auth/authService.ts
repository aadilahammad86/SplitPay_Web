import { generateUlid } from '../../domain/ulid'
import { getSupabaseClient } from '../../supabase/supabaseClient'

export interface UserAccount {
  id: string
  name: string
  username: string
  email?: string
  phone?: string
  isGuest: boolean
  avatarUrl?: string
}

export interface StoredCredentials {
  id: string
  name: string
  username: string
  email?: string
  passwordHash?: string
  salt?: string
  isGuest: boolean
  createdAt: string
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
          email: account.email || null,
          discoverable_by_phone: true,
          updated_at: new Date().toISOString(),
        })
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

  async login(
    username: string,
    password: string
  ): Promise<{ success: boolean; account?: UserAccount; error?: string }> {
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
          const authedProfile = rows.find(
            (r) => r.avatar_url && typeof r.avatar_url === 'string' && r.avatar_url.startsWith('auth:sha256:')
          )

          if (authedProfile && authedProfile.avatar_url) {
            const expectedHash = authedProfile.avatar_url.replace('auth:sha256:', '')
            const computedHash = await hashPassword(password, cleanUsername)
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
                avatarUrl: authedProfile.avatar_url,
              }

              // Cache credentials locally for offline use
              accounts[cleanUsername] = {
                id: account.id,
                name: account.name,
                username: cleanUsername,
                email: account.email,
                passwordHash: expectedHash,
                salt: cleanUsername,
                isGuest: false,
                createdAt: authedProfile.created_at || new Date().toISOString(),
              }
              this.saveStoredAccounts(accounts)

              // Ensure sibling profiles with null avatar_url get synced with credentials
              Promise.resolve(
                supabase
                  .from('profiles')
                  .update({ avatar_url: authedProfile.avatar_url })
                  .ilike('handle', cleanUsername)
                  .is('avatar_url', null)
              ).catch(() => {})

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
}

export const defaultAuthService = new AuthService()
