import type { Expense, Group, Person, Settlement } from '../../domain/entities'
import type { SyncOp } from '../../domain/syncOp'

export interface LedgerBackup {
  version: number
  exportedAtMicros: number
  deviceId: string
  localPersonId: string | null
  people: Person[]
  groups: Group[]
  expenses: Expense[]
  settlements: Settlement[]
  ops: SyncOp[]
}

/**
 * StorageAdapter interface.
 * Abstract boundary for local persistent storage (INV-6, ADR 0002).
 */
export interface StorageAdapter {
  init(): Promise<void>
  close(): Promise<void>

  // Read model queries
  getPeople(): Promise<Person[]>
  getGroups(): Promise<Group[]>
  getExpenses(): Promise<Expense[]>
  getSettlements(): Promise<Settlement[]>

  // Outbox queries
  getPendingOps(limit?: number): Promise<SyncOp[]>
  getOpsSince(afterOpId: string | null, limit?: number): Promise<SyncOp[]>
  markOpsSynced(opIds: string[]): Promise<void>

  // Key-Value Metadata
  getMeta(key: string): Promise<string | null>
  setMeta(key: string, value: string): Promise<void>

  // Atomic local mutations (Entity write + SyncOp outbox in one transaction)
  addPerson(person: Person, op: SyncOp): Promise<void>
  removePerson(personId: string): Promise<void>
  addGroup(group: Group, op: SyncOp): Promise<void>
  removeGroup(groupId: string): Promise<void>
  addExpense(expense: Expense, op: SyncOp): Promise<void>
  tombstoneExpense(expenseId: string, op: SyncOp): Promise<void>
  restoreExpense(expenseId: string, op: SyncOp): Promise<void>
  deleteExpense(expenseId: string): Promise<void>
  addSettlement(settlement: Settlement, op: SyncOp): Promise<void>
  tombstoneSettlement(settlementId: string, op: SyncOp): Promise<void>
  restoreSettlement(settlementId: string, op: SyncOp): Promise<void>
  deleteSettlement(settlementId: string): Promise<void>

  // Remote ops integration
  applyRemoteOps(ops: SyncOp[]): Promise<void>

  // Backup and Disaster Recovery
  exportAll(): Promise<LedgerBackup>
  importAll(backup: LedgerBackup): Promise<void>
  clearAll(): Promise<void>
  clearLedgerData(keepLocalProfile?: boolean): Promise<void>
}
