import type { SupabaseClient } from '@supabase/supabase-js'
import type { OpKind, SyncOp } from '../../domain/syncOp'

export interface SyncTransport {
  pushOps(ledgerId: string, ops: SyncOp[]): Promise<void>
  pullOps(ledgerId: string, afterOpId: string | null, limit?: number): Promise<SyncOp[]>
  subscribe(ledgerId: string, onNotification: () => void): () => void
}

/**
 * Production remote sync transport using Supabase with Row Level Security.
 */
export class SupabaseSyncTransport implements SyncTransport {
  private readonly supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  async pushOps(ledgerId: string, ops: SyncOp[]): Promise<void> {
    if (ops.length === 0) return

    const rows = ops.map((op) => ({
      op_id: op.opId,
      ledger_id: ledgerId,
      device_id: op.deviceId,
      kind: op.kind,
      payload_json: op.payload,
      created_at_micros: op.createdAtMicros,
    }))

    const { error } = await this.supabase
      .from('ops')
      .upsert(rows, { onConflict: 'op_id', ignoreDuplicates: true })

    if (error) {
      throw new Error(`Failed to push ops to Supabase: ${error.message} (Code: ${error.code})`)
    }
  }

  async pullOps(ledgerId: string, afterOpId: string | null, limit: number = 500): Promise<SyncOp[]> {
    let query = this.supabase
      .from('ops')
      .select('op_id, device_id, kind, payload_json, created_at_micros')
      .eq('ledger_id', ledgerId)
      .order('op_id', { ascending: true })
      .limit(limit)

    if (afterOpId) {
      query = query.gt('op_id', afterOpId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to pull ops from Supabase: ${error.message}`)
    }

    if (!data) return []

    return data.map((row) => ({
      opId: String(row.op_id),
      deviceId: String(row.device_id),
      kind: row.kind as OpKind,
      payload: (row.payload_json as Record<string, unknown>) ?? {},
      createdAtMicros: Number(row.created_at_micros),
    }))
  }

  subscribe(ledgerId: string, onNotification: () => void): () => void {
    const channelTopic = `ops_${ledgerId}`

    // Remove existing channel for this topic if one was previously registered
    try {
      const existingChannels = this.supabase.getChannels()
      for (const ch of existingChannels) {
        if (ch.topic === channelTopic || ch.topic === `realtime:${channelTopic}`) {
          this.supabase.removeChannel(ch)
        }
      }
    } catch (cleanErr) {
      console.warn('Error cleaning up existing realtime channel:', cleanErr)
    }

    try {
      const channel = this.supabase
        .channel(channelTopic)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'ops',
            filter: `ledger_id=eq.${ledgerId}`,
          },
          () => {
            onNotification()
          }
        )
        .subscribe()

      return () => {
        try {
          this.supabase.removeChannel(channel)
        } catch {
          // ignore cleanup errors
        }
      }
    } catch (subErr) {
      console.warn('Realtime subscription failed, continuing without push listener:', subErr)
      return () => {}
    }
  }
}

/**
 * In-memory simulated remote transport for offline, latency, and multi-device tests.
 */
export class SimulatedNetworkTransport implements SyncTransport {
  private ledgers = new Map<string, Map<string, SyncOp>>()
  private subscribers = new Map<string, Set<() => void>>()
  public isOnline: boolean = true
  public duplicateDeliveryChance: number = 0
  public authorizedMembers = new Map<string, Set<string>>()

  authorizeMember(ledgerId: string, memberId: string): void {
    let set = this.authorizedMembers.get(ledgerId)
    if (!set) {
      set = new Set()
      this.authorizedMembers.set(ledgerId, set)
    }
    set.add(memberId)
  }

  async pushOps(ledgerId: string, ops: SyncOp[]): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Network error: device is currently offline.')
    }

    const acl = this.authorizedMembers.get(ledgerId)
    if (acl) {
      for (const op of ops) {
        if (!acl.has(op.deviceId)) {
          throw new Error(`403 Forbidden: device ${op.deviceId} is not a member of ledger ${ledgerId} (RLS rejection).`)
        }
      }
    }

    let ledgerOps = this.ledgers.get(ledgerId)
    if (!ledgerOps) {
      ledgerOps = new Map()
      this.ledgers.set(ledgerId, ledgerOps)
    }

    for (const op of ops) {
      ledgerOps.set(op.opId, op)
    }

    // Notify connected peers asynchronously
    const subs = this.subscribers.get(ledgerId)
    if (subs) {
      queueMicrotask(() => {
        for (const listener of subs) {
          try {
            listener()
          } catch (err) {
            console.error('Error in simulated transport subscriber:', err)
          }
        }
      })
    }
  }

  async pullOps(ledgerId: string, afterOpId: string | null, limit: number = 500, requesterDeviceId?: string): Promise<SyncOp[]> {
    if (!this.isOnline) {
      throw new Error('Network error: device is currently offline.')
    }

    const acl = this.authorizedMembers.get(ledgerId)
    if (acl && requesterDeviceId && !acl.has(requesterDeviceId)) {
      throw new Error(`403 Forbidden: device ${requesterDeviceId} is not a member of ledger ${ledgerId} (RLS rejection).`)
    }

    const ledgerOps = this.ledgers.get(ledgerId)
    if (!ledgerOps) return []

    const all = Array.from(ledgerOps.values()).sort((a, b) => a.opId.localeCompare(b.opId))
    const filtered = afterOpId ? all.filter((o) => o.opId > afterOpId) : all
    return filtered.slice(0, limit)
  }

  subscribe(ledgerId: string, onNotification: () => void): () => void {
    let subs = this.subscribers.get(ledgerId)
    if (!subs) {
      subs = new Set()
      this.subscribers.set(ledgerId, subs)
    }
    subs.add(onNotification)

    return () => {
      subs?.delete(onNotification)
    }
  }

  clear(): void {
    this.ledgers.clear()
    this.subscribers.clear()
  }
}
