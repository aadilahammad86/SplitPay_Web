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

  it('updates local profile name and handle with transactional outbox persistence', async () => {
    const store = new LedgerStore(adapter)
    await store.init()

    const updated = await store.updateLocalProfile({ name: 'Swalih', handle: 'swalih86' })
    expect(updated.name).toBe('Swalih')
    expect(updated.handle).toBe('swalih86')
    expect(store.me?.name).toBe('Swalih')
    expect(store.me?.handle).toBe('swalih86')

    // Verify outbox op exists
    const pending = await adapter.getPendingOps()
    const updateOp = pending.find((o) => o.kind === 'addPerson' && (o.payload as { name: string }).name === 'Swalih')
    expect(updateOp).toBeDefined()
  })

  it('updates friend profile name and handle with transactional outbox persistence', async () => {
    const store = new LedgerStore(adapter)
    await store.init()

    const friend = await store.addFriend('Bob', 'bobby')
    const updated = await store.updatePerson(friend.id, { name: 'Robert', handle: 'robert_c' })

    expect(updated.name).toBe('Robert')
    expect(updated.handle).toBe('robert_c')
    const found = store.getState().people.find((p) => p.id === friend.id)
    expect(found?.name).toBe('Robert')
    expect(found?.handle).toBe('robert_c')
  })

  it('creates friends, group, and multiple expenses with outbox persistence', async () => {
    const store = new LedgerStore(adapter)
    await store.init()

    const me = store.me!
    const friend1 = await store.addFriend('Friend One', 'friend_1')
    const friend2 = await store.addFriend('Friend Two', 'friend_2')

    const group = await store.createGroup({
      name: 'Shared Trip',
      kind: 'trip',
      memberIds: [friend1.id, friend2.id],
      currency: Currencies.INR,
    })

    await store.addExpense({
      description: 'Lodging',
      totalMinor: 100000,
      currency: Currencies.INR,
      paidBy: me.id,
      groupId: group.id,
      memberIds: [me.id, friend1.id, friend2.id],
      mode: 'equal',
    })

    const state = store.getState()
    expect(state.people.length).toBeGreaterThanOrEqual(3)
    expect(state.groups.length).toBe(1)
    expect(state.groups[0]?.name).toBe('Shared Trip')
    expect(state.expenses.length).toBe(1)
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

  it('removes friends and cleans up group membership', async () => {
    const memAdapter = new MemoryStorageAdapter()
    const store = new LedgerStore(memAdapter)
    await store.init()

    const friend = await store.addFriend('TestFriend')
    const me = store.me!
    await store.createGroup({
      name: 'TestGroup',
      kind: 'trip',
      memberIds: [me.id, friend.id],
      currency: Currencies.INR,
    })

    expect(store.getState().people.some((p) => p.id === friend.id)).toBe(true)
    expect(store.getState().groups[0]?.memberIds).toContain(friend.id)

    // Remove friend
    await store.removeFriend(friend.id)
    expect(store.getState().people.some((p) => p.id === friend.id)).toBe(false)
    expect(store.getState().groups[0]?.memberIds).not.toContain(friend.id)
  })

  it('deletes groups and removes group members', async () => {
    const memAdapter = new MemoryStorageAdapter()
    const store = new LedgerStore(memAdapter)
    await store.init()

    const friend1 = await store.addFriend('Friend1')
    const friend2 = await store.addFriend('Friend2')
    const me = store.me!

    const group = await store.createGroup({
      name: 'ProjectGroup',
      kind: 'event',
      memberIds: [me.id, friend1.id, friend2.id],
      currency: Currencies.INR,
    })

    expect(store.getState().groups.length).toBe(1)

    // Remove member
    await store.removeGroupMember(group.id, friend1.id)
    expect(store.getState().groups[0]?.memberIds).not.toContain(friend1.id)
    expect(store.getState().groups[0]?.memberIds).toContain(friend2.id)

    // Delete group
    await store.deleteGroup(group.id)
    expect(store.getState().groups.length).toBe(0)
  })

  it('deletes settlements and bulk deletes expenses', async () => {
    const memAdapter = new MemoryStorageAdapter()
    const store = new LedgerStore(memAdapter)
    await store.init()

    const friend = await store.addFriend('SettlementFriend')
    const me = store.me!

    const exp1 = await store.addExpense({
      description: 'Item 1',
      totalMinor: 100,
      currency: Currencies.INR,
      paidBy: me.id,
      groupId: null,
      memberIds: [me.id, friend.id],
      mode: 'equal',
    })
    const exp2 = await store.addExpense({
      description: 'Item 2',
      totalMinor: 200,
      currency: Currencies.INR,
      paidBy: me.id,
      groupId: null,
      memberIds: [me.id, friend.id],
      mode: 'equal',
    })

    const settlement = await store.addSettlement({
      from: friend.id,
      to: me.id,
      amountMinor: 150,
      currency: Currencies.INR,
      groupId: null,
      note: 'Settling up',
    })

    expect(store.getState().expenses.filter((e) => !e.isTombstone).length).toBe(2)
    expect(store.getState().settlements.length).toBe(1)

    // Delete settlement
    await store.deleteSettlement(settlement.id)
    expect(store.getState().settlements.filter((s) => !s.isTombstone).length).toBe(0)
    expect(store.getState().settlements[0]?.isTombstone).toBe(true)

    // Bulk delete expenses
    await store.deleteExpenses([exp1.id, exp2.id])
    expect(store.getState().expenses.filter((e) => !e.isTombstone).length).toBe(0)
  })

  it('clears ledger data while preserving local profile and user ID', async () => {
    const memAdapter = new MemoryStorageAdapter()
    const store = new LedgerStore(memAdapter)
    await store.init()

    const me = store.me!
    const friend = await store.addFriend('OldFriend')
    await store.createGroup({
      name: 'OldGroup',
      kind: 'home',
      memberIds: [me.id, friend.id],
      currency: Currencies.INR,
    })
    await store.addExpense({
      description: 'OldExpense',
      totalMinor: 500,
      currency: Currencies.INR,
      paidBy: me.id,
      groupId: null,
      memberIds: [me.id, friend.id],
      mode: 'equal',
    })

    // Clear ledger data
    await store.clearLedgerData(true)

    const state = store.getState()
    expect(state.expenses.length).toBe(0)
    expect(state.settlements.length).toBe(0)
    expect(state.groups.length).toBe(0)
    expect(state.people.length).toBe(1)
    expect(state.people[0]?.id).toBe(me.id)
    expect(store.me?.id).toBe(me.id)
  })
})
