import { describe, it, expect, beforeEach } from 'vitest'
import { indexedDB } from 'fake-indexeddb'
import { IndexedDbStorageAdapter } from '../../src/data/storage/indexedDbAdapter'
import { MemoryStorageAdapter } from '../../src/data/storage/memoryStorageAdapter'
import { LedgerStore } from '../../src/data/storage/ledgerStore'
import { Currencies } from '../../src/domain/money'

describe('Local Storage - IndexedDB Persistence & Transactional Outbox (INV-6, ADR 0002)', () => {
  let adapter: IndexedDbStorageAdapter

  beforeEach(async () => {
    adapter = new IndexedDbStorageAdapter(indexedDB)
    await adapter.init()
    await adapter.clearAll()
  })

  it('atomically records expense and unsynced outbox op', async () => {
    const store = new LedgerStore(adapter)
    await store.init()

    const friend = await store.addFriend('Bob')
    const me = store.me!

    const expense = await store.addExpense({
      description: 'Dinner',
      totalMinor: 2000,
      currency: Currencies.INR,
      paidBy: me.id,
      groupId: null,
      memberIds: [me.id, friend.id],
      mode: 'equal',
    })

    expect(expense.shares.length).toBe(1)
    expect(store.getState().expenses.length).toBe(1)

    // Outbox check
    const pendingOps = await adapter.getPendingOps()
    // 1 addPerson (initial 'You'), 1 addPerson (Bob), 1 addExpense
    expect(pendingOps.length).toBe(3)
    const expOp = pendingOps.find((o) => o.kind === 'addExpense')
    expect(expOp).toBeDefined()
    expect(expOp?.payload.id).toBe(expense.id)
  })

  it('survives restart: closes database, reopens, and verifies all data and outbox queue remain intact', async () => {
    const store1 = new LedgerStore(adapter)
    await store1.init()
    const friend = await store1.addFriend('Charlie')
    const me = store1.me!

    await store1.addExpense({
      description: 'Groceries',
      totalMinor: 1500,
      currency: Currencies.INR,
      paidBy: me.id,
      groupId: null,
      memberIds: [me.id, friend.id],
      mode: 'equal',
    })

    // Simulate browser restart / page refresh
    await adapter.close()

    const freshAdapter = new IndexedDbStorageAdapter(indexedDB)
    const store2 = new LedgerStore(freshAdapter)
    await store2.init()

    expect(store2.getState().people.length).toBe(2)
    expect(store2.getState().expenses.length).toBe(1)
    expect(store2.getState().expenses[0]?.description).toBe('Groceries')

    // Pending ops survived restart
    const pending = await freshAdapter.getPendingOps()
    expect(pending.length).toBe(3)
  })

  it('marks ops synced and removes them from pending outbox queue', async () => {
    const store = new LedgerStore(adapter)
    await store.init()
    await store.addFriend('Dave')

    const pendingBefore = await adapter.getPendingOps()
    expect(pendingBefore.length).toBeGreaterThan(0)

    const opIdsToMark = pendingBefore.map((o) => o.opId)
    await adapter.markOpsSynced(opIdsToMark)

    const pendingAfter = await adapter.getPendingOps()
    expect(pendingAfter.length).toBe(0)
  })

  it('tombstones and restores expenses with durable outbox recording', async () => {
    const store = new LedgerStore(adapter)
    await store.init()
    const friend = await store.addFriend('Eve')
    const me = store.me!

    const exp = await store.addExpense({
      description: 'Movie',
      totalMinor: 800,
      currency: Currencies.INR,
      paidBy: me.id,
      groupId: null,
      memberIds: [me.id, friend.id],
      mode: 'equal',
    })

    expect(store.getState().expenses[0]?.isTombstone).toBe(false)

    // Tombstone (delete)
    await store.deleteExpense(exp.id)
    expect(store.getState().expenses[0]?.isTombstone).toBe(true)

    // Verify outbox has tombstoneExpense op
    const pending = await adapter.getPendingOps()
    const tombOp = pending.find((o) => o.kind === 'tombstoneExpense')
    expect(tombOp).toBeDefined()

    // Restore
    await store.restoreExpense(exp.id)
    expect(store.getState().expenses[0]?.isTombstone).toBe(false)
  })

  it('exports and restores full backup cleanly', async () => {
    const store = new LedgerStore(adapter)
    await store.init()
    await store.addFriend('Frank')

    const jsonBackup = await store.exportBackup()
    expect(jsonBackup).toContain('Frank')

    // Clear all
    await adapter.clearAll()
    const emptyStore = new LedgerStore(adapter)
    await emptyStore.init()

    // Restore
    await emptyStore.importBackup(jsonBackup)
    expect(emptyStore.getState().people.some((p) => p.name === 'Frank')).toBe(true)
  })
})

describe('Local Storage - MemoryStorageAdapter', () => {
  it('mirrors identical transactional behavior in memory', async () => {
    const memAdapter = new MemoryStorageAdapter()
    const store = new LedgerStore(memAdapter)
    await store.init()

    const friend = await store.addFriend('Grace')
    const me = store.me!

    await store.addExpense({
      description: 'Coffee',
      totalMinor: 200,
      currency: Currencies.INR,
      paidBy: me.id,
      groupId: null,
      memberIds: [me.id, friend.id],
      mode: 'equal',
    })

    expect(store.getState().expenses.length).toBe(1)
    const pending = await memAdapter.getPendingOps()
    expect(pending.length).toBe(3)
  })
})
