import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseConfig {
  url: string
  anonKey: string
}

let clientInstance: SupabaseClient | null = null
let currentConfig: SupabaseConfig | null = null

/**
 * Validates that the key is a client-safe publishable key.
 * Security Invariant: Never allow service-role keys in browser code.
 */
export function validatePublishableKey(key: string): void {
  if (!key || typeof key !== 'string') {
    throw new Error('Supabase anon key is required.')
  }
  const lower = key.toLowerCase()
  if (lower.includes('service_role') || lower.includes('secret')) {
    throw new Error('SECURITY VIOLATION: Privileged service_role key detected. Only publishable anon keys are allowed in client applications.')
  }
}

/**
 * Initializes or retrieves the configured Supabase client.
 */
export function getSupabaseClient(config?: SupabaseConfig): SupabaseClient | null {
  if (config) {
    validatePublishableKey(config.anonKey)
    if (
      !clientInstance ||
      currentConfig?.url !== config.url ||
      currentConfig?.anonKey !== config.anonKey
    ) {
      currentConfig = { ...config }
      clientInstance = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    }
    return clientInstance
  }

  if (clientInstance) {
    return clientInstance
  }

  // In test environment, do not automatically create remote network client
  const isTest = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE === 'test'
  if (isTest) {
    return null
  }

  // Attempt to read from Vite environment variables
  const envUrl = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_SUPABASE_URL as string) : undefined
  const envKey = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_SUPABASE_ANON_KEY as string) : undefined

  if (envUrl && envKey) {
    validatePublishableKey(envKey)
    currentConfig = { url: envUrl, anonKey: envKey }
    clientInstance = createClient(envUrl, envKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
    return clientInstance
  }

  // Attempt to read from localStorage if configured via in-app Settings
  if (typeof localStorage !== 'undefined') {
    const localUrl = localStorage.getItem('splitpay_supabase_url')
    const localKey = localStorage.getItem('splitpay_supabase_anon_key')
    if (localUrl && localKey) {
      try {
        validatePublishableKey(localKey)
        currentConfig = { url: localUrl, anonKey: localKey }
        clientInstance = createClient(localUrl, localKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        })
        return clientInstance
      } catch {
        // ignore invalid key in localStorage
      }
    }
  }

  // Fallback to default SplitPay cloud backend in browser/production
  if (!isTest) {
    const defaultUrl = 'https://uomijchozppmtcmjychc.supabase.co'
    const defaultKey = 'sb_publishable_KPTpCoULsCu_CwcbL0fwXg_dafVaZ5g'
    try {
      validatePublishableKey(defaultKey)
      currentConfig = { url: defaultUrl, anonKey: defaultKey }
      clientInstance = createClient(defaultUrl, defaultKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
      return clientInstance
    } catch {
      // ignore initialization fallback errors
    }
  }

  return null
}

export function resetSupabaseClient(): void {
  if (clientInstance) {
    try {
      const channels = clientInstance.getChannels()
      for (const ch of channels) {
        clientInstance.removeChannel(ch)
      }
    } catch {
      // ignore cleanup errors
    }
  }
  clientInstance = null
  currentConfig = null
}
