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

  return null
}

export function resetSupabaseClient(): void {
  clientInstance = null
  currentConfig = null
}
