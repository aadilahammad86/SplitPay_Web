import type { Expense, Group, Person, Settlement } from '../../domain/entities'
import type { SyncOp } from '../../domain/syncOp'
import {
  decodePerson,
  decodeGroup,
  decodeExpense,
  decodeSettlement,
} from '../../domain/syncOp'
import type { LedgerBackup, StorageAdapter } from './storageAdapter'

const DB_NAME = 'splitpay_db'
const DB_VERSION = 1

interface StoredOp extends SyncOp {
  synced: 0 | 1
}

interface StoredMeta {
  key: string
  value: string
}

export class IndexedDbStorageAdapter implements StorageAdapter {
  private db: IDBDatabase | null = null
  private readonly customIndexedDB?: IDBFactory

  constructor(customIndexedDB?: IDBFactory) {
    this.customIndexedDB = customIndexedDB
  }

  private get idb(): IDBFactory {
    if (this.customIndexedDB) return this.customIndexedDB
    if (typeof window !== 'undefined' && window.indexedDB) return window.indexedDB
    if (typeof indexedDB !== 'undefined') return indexedDB
    throw new Error('IndexedDB is not supported in this environment.')
  }

  async init(): Promise<void> {
    if (this.db) return

    return new Promise((resolve, reject) => {
      const request = this.idb.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains('people')) {
          db.createObjectStore('people', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('groups')) {
          db.createObjectStore('groups', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('expenses')) {
          db.createObjectStore('expenses', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('settlements')) {
          db.createObjectStore('settlements', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('ops')) {
          const opsStore = db.createObjectStore('ops', { keyPath: 'opId' })
          opsStore.createIndex('synced', 'synced', { unique: false })
          opsStore.createIndex('createdAtMicros', 'createdAtMicros', { unique: false })
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' })
        }
      }

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result
        resolve()
      }

      request.onerror = (event) => {
        reject(new Error(`Failed to open IndexedDB: ${(event.target as IDBOpenDBRequest).error?.message}`))
      }
    })
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  private getDatabase(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.')
    }
    return this.db
  }

  private getAll<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const tx = this.getDatabase().transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const req = store.getAll()
      req.onsuccess = () => resolve((req.result as T[]) || [])
      req.onerror = () => reject(req.error)
    })
  }

  async getPeople(): Promise<Person[]> {
    const list = await this.getAll<Person>('people')
    return list.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  }

  async getGroups(): Promise<Group[]> {
    const list = await this.getAll<Group>('groups')
    return list.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  }

  async getExpenses(): Promise<Expense[]> {
    const list = await this.getAll<Expense>('expenses')
    return list.sort((a, b) => b.createdAtMicros - a.createdAtMicros || a.id.localeCompare(b.id))
  }

  async getSettlements(): Promise<Settlement[]> {
    const list = await this.getAll<Settlement>('settlements')
    return list.sort((a, b) => b.createdAtMicros - a.createdAtMicros || a.id.localeCompare(b.id))
  }

  async getPendingOps(limit: number = 500): Promise<SyncOp[]> {
    return new Promise((resolve, reject) => {
      const tx = this.getDatabase().transaction('ops', 'readonly')
      const store = tx.objectStore('ops')
      const index = store.index('synced')
      const req = index.getAll(0, limit)
      req.onsuccess = () => {
        const ops = (req.result as StoredOp[]) || []
        resolve(ops.sort((a, b) => a.opId.localeCompare(b.opId)))
      }
      req.onerror = () => reject(req.error)
    })
  }

  async getOpsSince(afterOpId: string | null, limit: number = 500): Promise<SyncOp[]> {
    const all = await this.getAll<StoredOp>('ops')
    const sorted = all.sort((a, b) => a.opId.localeCompare(b.opId))
    const filtered = afterOpId ? sorted.filter((o) => o.opId > afterOpId) : sorted
    return filtered.slice(0, limit)
  }

  async markOpsSynced(opIds: string[]): Promise<void> {
    if (opIds.length === 0) return
    const idSet = new Set(opIds)
    return new Promise((resolve, reject) => {
      const tx = this.getDatabase().transaction('ops', 'readwrite')
      const store = tx.objectStore('ops')
      const index = store.index('synced')
      const keyRange = typeof IDBKeyRange !== 'undefined' ? IDBKeyRange.only(0) : undefined
      const cursorReq = index.openCursor(keyRange)

      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          const row = cursor.value as StoredOp
          if (idSet.has(row.opId)) {
            cursor.update({ ...row, synced: 1 })
          }
          cursor.continue()
        }
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async getMeta(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const tx = this.getDatabase().transaction('meta', 'readonly')
      const store = tx.objectStore('meta')
      const req = store.get(key)
      req.onsuccess = () => {
        const row = req.result as StoredMeta | undefined
        resolve(row ? row.value : null)
      }
      req.onerror = () => reject(req.error)
    })
  }

  async setMeta(key: string, value: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.getDatabase().transaction('meta', 'readwrite')
      const store = tx.objectStore('meta')
      const req = store.put({ key, value })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  // Atomic local transaction: entity + outbox op
  private atomicWrite(storeName: string, entity: unknown, op: SyncOp): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.getDatabase().transaction([storeName, 'ops'], 'readwrite')
      const entityStore = tx.objectStore(storeName)
      const opsStore = tx.objectStore('ops')

      entityStore.put(entity)
      const storedOp: StoredOp = { ...op, synced: 0 }
      opsStore.put(storedOp)

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async addPerson(person: Person, op: SyncOp): Promise<void> {
    return this.atomicWrite('people', person, op)
  }

  async addGroup(group: Group, op: SyncOp): Promise<void> {
    return this.atomicWrite('groups', group, op)
  }

  async addExpense(expense: Expense, op: SyncOp): Promise<void> {
    return this.atomicWrite('expenses', expense, op)
  }

  async tombstoneExpense(expenseId: string, op: SyncOp): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.getDatabase().transaction(['expenses', 'ops'], 'readwrite')
      const expensesStore = tx.objectStore('expenses')
      const opsStore = tx.objectStore('ops')

      const getReq = expensesStore.get(expenseId)
      getReq.onsuccess = () => {
        const expense = getReq.result as Expense | undefined
        if (expense) {
          expensesStore.put({ ...expense, isTombstone: true })
        }
      }

      const storedOp: StoredOp = { ...op, synced: 0 }
      opsStore.put(storedOp)

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async restoreExpense(expenseId: string, op: SyncOp): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.getDatabase().transaction(['expenses', 'ops'], 'readwrite')
      const expensesStore = tx.objectStore('expenses')
      const opsStore = tx.objectStore('ops')

      const getReq = expensesStore.get(expenseId)
      getReq.onsuccess = () => {
        const expense = getReq.result as Expense | undefined
        if (expense) {
          expensesStore.put({ ...expense, isTombstone: false })
        }
      }

      const storedOp: StoredOp = { ...op, synced: 0 }
      opsStore.put(storedOp)

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async removePerson(personId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.getDatabase().transaction('people', 'readwrite')
      const store = tx.objectStore('people')
      store.delete(personId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async removeGroup(groupId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.getDatabase().transaction('groups', 'readwrite')
      const store = tx.objectStore('groups')
      store.delete(groupId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async addSettlement(settlement: Settlement, op: SyncOp): Promise<void> {
    return this.atomicWrite('settlements', settlement, op)
  }

  async tombstoneSettlement(settlementId: string, op: SyncOp): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.getDatabase().transaction(['settlements', 'ops'], 'readwrite')
      const settlementsStore = tx.objectStore('settlements')
      const opsStore = tx.objectStore('ops')

      const getReq = settlementsStore.get(settlementId)
      getReq.onsuccess = () => {
        const settlement = getReq.result as Settlement | undefined
        if (settlement) {
          settlementsStore.put({ ...settlement, isTombstone: true })
        }
      }

      const storedOp: StoredOp = { ...op, synced: 0 }
      opsStore.put(storedOp)

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async restoreSettlement(settlementId: string, op: SyncOp): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.getDatabase().transaction(['settlements', 'ops'], 'readwrite')
      const settlementsStore = tx.objectStore('settlements')
      const opsStore = tx.objectStore('ops')

      const getReq = settlementsStore.get(settlementId)
      getReq.onsuccess = () => {
        const settlement = getReq.result as Settlement | undefined
        if (settlement) {
          settlementsStore.put({ ...settlement, isTombstone: false })
        }
      }

      const storedOp: StoredOp = { ...op, synced: 0 }
      opsStore.put(storedOp)

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async deleteSettlement(settlementId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.getDatabase().transaction('settlements', 'readwrite')
      const store = tx.objectStore('settlements')
      store.delete(settlementId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async applyRemoteOps(ops: SyncOp[]): Promise<void> {
    if (ops.length === 0) return

    return new Promise((resolve, reject) => {
      const tx = this.getDatabase().transaction(
        ['people', 'groups', 'expenses', 'settlements', 'ops'],
        'readwrite'
      )
      const peopleStore = tx.objectStore('people')
      const groupsStore = tx.objectStore('groups')
      const expensesStore = tx.objectStore('expenses')
      const settlementsStore = tx.objectStore('settlements')
      const opsStore = tx.objectStore('ops')

      // Record all incoming ops as synced
      for (const op of ops) {
        opsStore.put({ ...op, synced: 1 })
      }

      // Order ops by opId
      const sorted = [...ops].sort((a, b) => a.opId.localeCompare(b.opId))

      for (const op of sorted) {
        switch (op.kind) {
          case 'addPerson': {
            const person = decodePerson(op.payload)
            // Never persist anonymous dummy placeholders from other devices
            if (
              person.name === 'You' ||
              person.name === 'SplitPay Friend' ||
              person.name === 'Guest User' ||
              person.id.startsWith('invited_') ||
              !person.name.trim()
            ) {
              break
            }
            peopleStore.put(person)
            break
          }
          case 'addGroup':
            groupsStore.put(decodeGroup(op.payload))
            break
          case 'addExpense':
            expensesStore.put(decodeExpense(op.payload))
            break
          case 'addSettlement':
            settlementsStore.put(decodeSettlement(op.payload))
            break
        }
      }

      // Comprehensive tombstone reconciliation across ALL historical ops in opsStore
      // Guarantees skew-proof consistency: tombstones arriving before, during, or after
      // an expense/settlement will always prevail if the latest op is a tombstone.
      const allOpsReq = opsStore.getAll()
      allOpsReq.onsuccess = () => {
        const allStoredOps = (allOpsReq.result || []) as SyncOp[]
        const expenseTombstones = new Map<string, { opId: string; value: boolean }>()
        const settlementTombstones = new Map<string, { opId: string; value: boolean }>()

        for (const o of allStoredOps) {
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
          const getReq = expensesStore.get(expId)
          getReq.onsuccess = () => {
            const expense = getReq.result as Expense | undefined
            if (expense && expense.isTombstone !== winner.value) {
              expensesStore.put({ ...expense, isTombstone: winner.value })
            }
          }
        }

        for (const [setId, winner] of settlementTombstones.entries()) {
          const getReq = settlementsStore.get(setId)
          getReq.onsuccess = () => {
            const settlement = getReq.result as Settlement | undefined
            if (settlement && settlement.isTombstone !== winner.value) {
              settlementsStore.put({ ...settlement, isTombstone: winner.value })
            }
          }
        }
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async exportAll(): Promise<LedgerBackup> {
    const people = await this.getPeople()
    const groups = await this.getGroups()
    const expenses = await this.getExpenses()
    const settlements = await this.getSettlements()
    const ops = await this.getAll<SyncOp>('ops')
    const deviceId = (await this.getMeta('device_id')) || 'unknown'
    const localPersonId = await this.getMeta('local_person_id')

    return {
      version: 1,
      exportedAtMicros: Date.now() * 1000,
      deviceId,
      localPersonId,
      people,
      groups,
      expenses,
      settlements,
      ops,
    }
  }

  async importAll(backup: LedgerBackup): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.getDatabase().transaction(
        ['people', 'groups', 'expenses', 'settlements', 'ops', 'meta'],
        'readwrite'
      )

      const peopleStore = tx.objectStore('people')
      const groupsStore = tx.objectStore('groups')
      const expensesStore = tx.objectStore('expenses')
      const settlementsStore = tx.objectStore('settlements')
      const opsStore = tx.objectStore('ops')
      const metaStore = tx.objectStore('meta')

      for (const p of backup.people) peopleStore.put(p)
      for (const g of backup.groups) groupsStore.put(g)
      for (const e of backup.expenses) expensesStore.put(e)
      for (const s of backup.settlements) settlementsStore.put(s)
      for (const o of backup.ops) opsStore.put({ ...o, synced: 1 })

      if (backup.localPersonId) {
        metaStore.put({ key: 'local_person_id', value: backup.localPersonId })
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async clearAll(): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.getDatabase().transaction(
        ['people', 'groups', 'expenses', 'settlements', 'ops', 'meta'],
        'readwrite'
      )
      tx.objectStore('people').clear()
      tx.objectStore('groups').clear()
      tx.objectStore('expenses').clear()
      tx.objectStore('settlements').clear()
      tx.objectStore('ops').clear()
      tx.objectStore('meta').clear()

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async clearLedgerData(keepLocalProfile: boolean = true): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.getDatabase().transaction(
        ['people', 'groups', 'expenses', 'settlements', 'ops', 'meta'],
        'readwrite'
      )
      const peopleStore = tx.objectStore('people')
      const groupsStore = tx.objectStore('groups')
      const expensesStore = tx.objectStore('expenses')
      const settlementsStore = tx.objectStore('settlements')
      const opsStore = tx.objectStore('ops')
      const metaStore = tx.objectStore('meta')

      groupsStore.clear()
      expensesStore.clear()
      settlementsStore.clear()
      opsStore.clear()

      if (!keepLocalProfile) {
        peopleStore.clear()
        metaStore.clear()
      } else {
        const metaReq = metaStore.get('local_person_id')
        metaReq.onsuccess = () => {
          const localPersonId = (metaReq.result as StoredMeta | undefined)?.value
          const peopleReq = peopleStore.getAll()
          peopleReq.onsuccess = () => {
            const people = peopleReq.result as Person[]
            for (const p of people) {
              if (p.id !== localPersonId) {
                peopleStore.delete(p.id)
              }
            }
          }
        }
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}
