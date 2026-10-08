import type { StorageAdapter } from '../storage/storageAdapter'
import type { LedgerStore } from '../storage/ledgerStore'
import type { SyncTransport } from './syncTransport'

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncEngineState {
  status: SyncStatus
  isOnline: boolean
  lastSyncedAt: Date | null
  lastWatermark: string | null
  error: string | null
  ledgerId: string | null
}

export class SyncEngine {
  private readonly store: LedgerStore
  private readonly adapter: StorageAdapter
  private readonly transport: SyncTransport
  private state: SyncEngineState
  private listeners = new Set<() => void>()
  private unsubscribeTransport: (() => void) | null = null
  private retryTimeout: ReturnType<typeof setTimeout> | null = null
  private retryAttempt = 0

  constructor(params: {
    store: LedgerStore
    transport: SyncTransport
  }) {
    this.store = params.store
    this.adapter = params.store.getAdapter()
    this.transport = params.transport

    const online =
      typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
        ? navigator.onLine
        : true
    this.state = {
      status: online ? 'idle' : 'offline',
      isOnline: online,
      lastSyncedAt: null,
      lastWatermark: null,
      error: null,
      ledgerId: null,
    }

    this.setupWindowListeners()
  }

  setOnline(online: boolean): void {
    this.setState({
      isOnline: online,
      status: online ? 'idle' : 'offline',
      error: null,
    })
    if (!online && this.retryTimeout) {
      clearTimeout(this.retryTimeout)
      this.retryTimeout = null
    }
  }

  getState(): SyncEngineState {
    return this.state
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch (err) {
        console.error('Error in SyncEngine listener:', err)
      }
    }
  }

  private setState(partial: Partial<SyncEngineState>): void {
    this.state = { ...this.state, ...partial }
    this.notify()
  }

  private setupWindowListeners(): void {
    if (typeof window === 'undefined') return

    window.addEventListener('online', () => {
      this.setState({ isOnline: true, status: 'idle', error: null })
      this.retryAttempt = 0
      this.syncNow()
    })

    window.addEventListener('offline', () => {
      this.setState({ isOnline: false, status: 'offline' })
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout)
        this.retryTimeout = null
      }
    })

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.state.isOnline) {
          this.syncNow()
        }
      })
    }
  }

  async start(ledgerId: string): Promise<void> {
    this.stop()

    const watermarkKey = `sync_watermark_${ledgerId}`
    const storedWatermark = await this.adapter.getMeta(watermarkKey)

    this.setState({
      ledgerId,
      lastWatermark: storedWatermark,
      error: null,
    })

    // Subscribe to remote real-time notifications
    this.unsubscribeTransport = this.transport.subscribe(ledgerId, () => {
      // Notification received -> prompt cursor pull
      if (this.state.isOnline) {
        this.syncNow()
      }
    })

    // Trigger initial sync
    if (this.state.isOnline) {
      await this.syncNow()
    }
  }

  stop(): void {
    if (this.unsubscribeTransport) {
      this.unsubscribeTransport()
      this.unsubscribeTransport = null
    }
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
      this.retryTimeout = null
    }
    this.setState({ ledgerId: null })
  }

  async syncNow(): Promise<void> {
    if (!this.state.ledgerId) return
    if (!this.state.isOnline) {
      this.setState({ status: 'offline' })
      return
    }
    if (this.state.status === 'syncing') {
      return
    }

    this.setState({ status: 'syncing', error: null })
    const ledgerId = this.state.ledgerId

    try {
      // ----------------------------------------------------------------------
      // Step 1: Push pending local ops (Outbox)
      // ----------------------------------------------------------------------
      const pendingOps = await this.adapter.getPendingOps()
      if (pendingOps.length > 0) {
        await this.transport.pushOps(ledgerId, pendingOps)
        await this.adapter.markOpsSynced(pendingOps.map((o) => o.opId))
        await this.store.refreshPendingOpsCount()
      }

      // ----------------------------------------------------------------------
      // Step 2: Cursor pull remote ops since last watermark
      // ----------------------------------------------------------------------
      const remoteOps = await this.transport.pullOps(ledgerId, this.state.lastWatermark)
      let newWatermark = this.state.lastWatermark

      if (remoteOps.length > 0) {
        await this.store.applyRemoteOps(remoteOps)

        for (const op of remoteOps) {
          if (!newWatermark || op.opId > newWatermark) {
            newWatermark = op.opId
          }
        }

        if (newWatermark) {
          await this.adapter.setMeta(`sync_watermark_${ledgerId}`, newWatermark)
        }
      }

      this.retryAttempt = 0
      this.setState({
        status: 'idle',
        lastSyncedAt: new Date(),
        lastWatermark: newWatermark,
        error: null,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('Sync failed:', msg)
      this.setState({ status: 'error', error: msg })
      this.scheduleRetry()
    }
  }

  private scheduleRetry(): void {
    if (!this.state.isOnline || !this.state.ledgerId) return
    if (this.retryTimeout) clearTimeout(this.retryTimeout)

    // Exponential backoff: 2s, 4s, 8s, 16s, up to 30s
    this.retryAttempt++
    const delay = Math.min(2000 * Math.pow(2, this.retryAttempt - 1), 30000)

    this.retryTimeout = setTimeout(() => {
      this.syncNow()
    }, delay)
  }
}
