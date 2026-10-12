import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { IndexedDbStorageAdapter } from '../data/storage/indexedDbAdapter'
import { LedgerStore, type LedgerState } from '../data/storage/ledgerStore'
import { SyncEngine, type SyncEngineState } from '../data/sync/syncEngine'
import { SupabaseSyncTransport } from '../data/sync/syncTransport'
import { getSupabaseClient, type SupabaseConfig } from '../supabase/supabaseClient'

interface StoreContextType {
  store: LedgerStore
  syncEngine: SyncEngine | null
  ledgerState: LedgerState
  syncState: SyncEngineState | null
  sharedLedgerId: string | null
  setSharedLedgerId: (id: string) => Promise<void>
  connectSupabase: (config: SupabaseConfig) => Promise<void>
  disconnectSupabase: () => void
}

const StoreContext = createContext<StoreContextType | null>(null)

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [store] = useState<LedgerStore>(() => {
    const adapter = new IndexedDbStorageAdapter()
    return new LedgerStore(adapter)
  })

  const [syncEngine, setSyncEngine] = useState<SyncEngine | null>(null)
  const [sharedLedgerId, setSharedLedgerIdState] = useState<string | null>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('splitpay_shared_ledger_id') || 'default_ledger'
    }
    return 'default_ledger'
  })

  // Subscribe to LedgerStore changes
  const ledgerState = useSyncExternalStore(
    (onStoreChange) => store.subscribe(onStoreChange),
    () => store.getState(),
    () => store.getState()
  )

  // Subscribe to SyncEngine changes
  const syncState = useSyncExternalStore(
    (onStoreChange) => {
      if (!syncEngine) return () => {}
      return syncEngine.subscribe(onStoreChange)
    },
    () => syncEngine?.getState() ?? null,
    () => syncEngine?.getState() ?? null
  )

  // Initialize store and sync engine on mount
  useEffect(() => {
    let active = true
    let engineInstance: SyncEngine | null = null

    async function init() {
      try {
        await store.init()
      } catch (err) {
        console.error('Ledger store initialization error:', err)
      }
      if (!active) return

      // Request persistent browser storage where supported (ADR 0002)
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        try {
          await navigator.storage.persist()
        } catch {
          // Ignore if permission denied
        }
      }

      // Check if Supabase client is configured
      try {
        const client = getSupabaseClient()
        if (client && sharedLedgerId) {
          const transport = new SupabaseSyncTransport(client)
          engineInstance = new SyncEngine({ store, transport })
          await engineInstance.start(sharedLedgerId)
          if (active) setSyncEngine(engineInstance)
        }
      } catch (syncErr) {
        console.warn('Sync engine initialization failed, operating offline:', syncErr)
      }
    }

    init()

    return () => {
      active = false
      if (engineInstance) engineInstance.stop()
    }
  }, [store, sharedLedgerId])

  const setSharedLedgerId = async (id: string) => {
    const trimmed = id.trim()
    setSharedLedgerIdState(trimmed)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('splitpay_shared_ledger_id', trimmed)
    }
    if (syncEngine && trimmed) {
      await syncEngine.start(trimmed)
    }
  }

  const connectSupabase = async (config: SupabaseConfig) => {
    const client = getSupabaseClient(config)
    if (!client) return

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('splitpay_supabase_url', config.url)
      localStorage.setItem('splitpay_supabase_anon_key', config.anonKey)
    }

    const transport = new SupabaseSyncTransport(client)
    const engine = new SyncEngine({ store, transport })
    if (sharedLedgerId) {
      await engine.start(sharedLedgerId)
    }
    setSyncEngine(engine)
  }

  const disconnectSupabase = () => {
    if (syncEngine) {
      syncEngine.stop()
      setSyncEngine(null)
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('splitpay_supabase_url')
      localStorage.removeItem('splitpay_supabase_anon_key')
    }
  }

  return (
    <StoreContext.Provider
      value={{
        store,
        syncEngine,
        ledgerState,
        syncState,
        sharedLedgerId,
        setSharedLedgerId,
        connectSupabase,
        disconnectSupabase,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useStore(): StoreContextType {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider')
  }
  return context
}
