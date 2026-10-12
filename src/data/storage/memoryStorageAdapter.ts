import type { Expense, Group, Person, Settlement } from '../../domain/entities'
import type { SyncOp } from '../../domain/syncOp'
import {
  decodePerson,
  decodeGroup,
  decodeExpense,
  decodeSettlement,
} from '../../domain/syncOp'
import type { LedgerBackup, StorageAdapter } from './storageAdapter'

interface StoredOp extends SyncOp {
  synced: 0 | 1
}

export class MemoryStorageAdapter implements StorageAdapter {
  private people = new Map<string, Person>()
  private groups = new Map<string, Group>()
  private expenses = new Map<string, Expense>()
  private settlements = new Map<string, Settlement>()
  private ops = new Map<string, StoredOp>()
  private meta = new Map<string, string>()

  async init(): Promise<void> {}
  async close(): Promise<void> {}

  async getPeople(): Promise<Person[]> {
    return Array.from(this.people.values()).sort(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
    )
  }

  async getGroups(): Promise<Group[]> {
    return Array.from(this.groups.values()).sort(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
    )
  }

  async getExpenses(): Promise<Expense[]> {
    return Array.from(this.expenses.values()).sort(
      (a, b) => b.createdAtMicros - a.createdAtMicros || a.id.localeCompare(b.id)
    )
  }

  async getSettlements(): Promise<Settlement[]> {
    return Array.from(this.settlements.values()).sort(
      (a, b) => b.createdAtMicros - a.createdAtMicros || a.id.localeCompare(b.id)
    )
  }

  async getPendingOps(limit: number = 500): Promise<SyncOp[]> {
    const pending = Array.from(this.ops.values())
      .filter((o) => o.synced === 0)
      .sort((a, b) => a.opId.localeCompare(b.opId))
    return pending.slice(0, limit)
  }

  async getOpsSince(afterOpId: string | null, limit: number = 500): Promise<SyncOp[]> {
    const all = Array.from(this.ops.values()).sort((a, b) => a.opId.localeCompare(b.opId))
    const filtered = afterOpId ? all.filter((o) => o.opId > afterOpId) : all
    return filtered.slice(0, limit)
  }

  async markOpsSynced(opIds: string[]): Promise<void> {
    for (const id of opIds) {
      const op = this.ops.get(id)
      if (op) {
        this.ops.set(id, { ...op, synced: 1 })
      }
    }
  }

  async getMeta(key: string): Promise<string | null> {
    return this.meta.get(key) ?? null
  }

  async setMeta(key: string, value: string): Promise<void> {
    this.meta.set(key, value)
  }

  async addPerson(person: Person, op: SyncOp): Promise<void> {
    this.people.set(person.id, person)
    this.ops.set(op.opId, { ...op, synced: 0 })
  }

  async removePerson(personId: string): Promise<void> {
    this.people.delete(personId)
  }

  async addGroup(group: Group, op: SyncOp): Promise<void> {
    this.groups.set(group.id, group)
    this.ops.set(op.opId, { ...op, synced: 0 })
  }

  async removeGroup(groupId: string): Promise<void> {
    this.groups.delete(groupId)
  }

  async addExpense(expense: Expense, op: SyncOp): Promise<void> {
    this.expenses.set(expense.id, expense)
    this.ops.set(op.opId, { ...op, synced: 0 })
  }

  async tombstoneExpense(expenseId: string, op: SyncOp): Promise<void> {
    const current = this.expenses.get(expenseId)
    if (current) {
      this.expenses.set(expenseId, { ...current, isTombstone: true })
    }
    this.ops.set(op.opId, { ...op, synced: 0 })
  }

  async restoreExpense(expenseId: string, op: SyncOp): Promise<void> {
    const current = this.expenses.get(expenseId)
    if (current) {
      this.expenses.set(expenseId, { ...current, isTombstone: false })
    }
    this.ops.set(op.opId, { ...op, synced: 0 })
  }

  async addSettlement(settlement: Settlement, op: SyncOp): Promise<void> {
    this.settlements.set(settlement.id, settlement)
    this.ops.set(op.opId, { ...op, synced: 0 })
  }

  async tombstoneSettlement(settlementId: string, op: SyncOp): Promise<void> {
    const current = this.settlements.get(settlementId)
    if (current) {
      this.settlements.set(settlementId, { ...current, isTombstone: true })
    }
    this.ops.set(op.opId, { ...op, synced: 0 })
  }

  async restoreSettlement(settlementId: string, op: SyncOp): Promise<void> {
    const current = this.settlements.get(settlementId)
    if (current) {
      this.settlements.set(settlementId, { ...current, isTombstone: false })
    }
    this.ops.set(op.opId, { ...op, synced: 0 })
  }

  async deleteSettlement(settlementId: string): Promise<void> {
    this.settlements.delete(settlementId)
  }

  async applyRemoteOps(ops: SyncOp[]): Promise<void> {
    for (const op of ops) {
      this.ops.set(op.opId, { ...op, synced: 1 })
    }

    const sorted = [...ops].sort((a, b) => a.opId.localeCompare(b.opId))

    for (const op of sorted) {
      switch (op.kind) {
        case 'addPerson': {
          const person = decodePerson(op.payload)
          if (
            person.name === 'You' ||
            person.name === 'SplitPay Friend' ||
            person.name === 'Guest User' ||
            person.id.startsWith('invited_') ||
            !person.name.trim()
          ) {
            break
          }
          this.people.set(op.payload.id as string, person)
          break
        }
        case 'addGroup':
          this.groups.set(op.payload.id as string, decodeGroup(op.payload))
          break
        case 'addExpense':
          this.expenses.set(op.payload.id as string, decodeExpense(op.payload))
          break
        case 'addSettlement':
          this.settlements.set(op.payload.id as string, decodeSettlement(op.payload))
          break
      }
    }

    // Comprehensive tombstone reconciliation across ALL historical ops in this.ops
    const expenseTombstones = new Map<string, { opId: string; value: boolean }>()
    const settlementTombstones = new Map<string, { opId: string; value: boolean }>()

    for (const o of this.ops.values()) {
      if (o.kind === 'tombstoneExpense' || o.kind === 'restoreExpense') {
        const expId = String(o.payload?.expenseId || o.payload?.expense_id || o.payload?.id || '')
        if (expId) {
          const cur = expenseTombstones.get(expId)
          if (!cur || o.opId.localeCompare(cur.opId) > 0) {
            expenseTombstones.set(expId, { opId: o.opId, value: o.kind === 'tombstoneExpense' })
          }
        }
      } else if (o.kind === 'tombstoneSettlement' || o.kind === 'restoreSettlement') {
        const setId = String(o.payload?.settlementId || o.payload?.settlement_id || o.payload?.id || '')
        if (setId) {
          const cur = settlementTombstones.get(setId)
          if (!cur || o.opId.localeCompare(cur.opId) > 0) {
            settlementTombstones.set(setId, { opId: o.opId, value: o.kind === 'tombstoneSettlement' })
          }
        }
      }
    }

    for (const [expId, winner] of expenseTombstones.entries()) {
      const existing = this.expenses.get(expId)
      if (existing) {
        this.expenses.set(expId, { ...existing, isTombstone: winner.value })
      }
    }

    for (const [setId, winner] of settlementTombstones.entries()) {
      const existing = this.settlements.get(setId)
      if (existing) {
        this.settlements.set(setId, { ...existing, isTombstone: winner.value })
      }
    }
  }

  async exportAll(): Promise<LedgerBackup> {
    return {
      version: 1,
      exportedAtMicros: Date.now() * 1000,
      deviceId: this.meta.get('device_id') || 'unknown',
      localPersonId: this.meta.get('local_person_id') || null,
      people: await this.getPeople(),
      groups: await this.getGroups(),
      expenses: await this.getExpenses(),
      settlements: await this.getSettlements(),
      ops: Array.from(this.ops.values()),
    }
  }

  async importAll(backup: LedgerBackup): Promise<void> {
    for (const p of backup.people) this.people.set(p.id, p)
    for (const g of backup.groups) this.groups.set(g.id, g)
    for (const e of backup.expenses) this.expenses.set(e.id, e)
    for (const s of backup.settlements) this.settlements.set(s.id, s)
    for (const o of backup.ops) this.ops.set(o.opId, { ...o, synced: 1 })
    if (backup.localPersonId) {
      this.meta.set('local_person_id', backup.localPersonId)
    }
  }

  async clearAll(): Promise<void> {
    this.people.clear()
    this.groups.clear()
    this.expenses.clear()
    this.settlements.clear()
    this.ops.clear()
    this.meta.clear()
  }

  async clearLedgerData(keepLocalProfile: boolean = true): Promise<void> {
    this.groups.clear()
    this.expenses.clear()
    this.settlements.clear()
    this.ops.clear()
    if (!keepLocalProfile) {
      this.people.clear()
      this.meta.clear()
    } else {
      const localPersonId = this.meta.get('local_person_id')
      for (const [id] of this.people) {
        if (id !== localPersonId) {
          this.people.delete(id)
        }
      }
    }
  }
}
