import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryStorageAdapter } from '../../src/data/storage/memoryStorageAdapter'
import { LedgerStore } from '../../src/data/storage/ledgerStore'
import { Currencies } from '../../src/domain/money'
import { NotificationService } from '../../src/services/notifications/notificationService'
import { opAddExpense } from '../../src/domain/syncOp'
import { buildExpense } from '../../src/domain/splitEngine'

describe('Default Currency, Expense Date Selection, Permanent Delete & Notifications', () => {
  let adapter: MemoryStorageAdapter
  let store: LedgerStore

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter()
    store = new LedgerStore(adapter)
    await store.init()
  })

  describe('Default Currency Setting & Persistence', () => {
    it('initializes with INR by default', () => {
      expect(store.getState().defaultCurrency.code).toBe('INR')
    })

    it('updates default currency and persists across store reloads', async () => {
      await store.setDefaultCurrency(Currencies.AED)
      expect(store.getState().defaultCurrency.code).toBe('AED')
      expect(store.getState().defaultCurrency.symbol).toBe(Currencies.AED.symbol)

      // Verify adapter metadata was updated
      const savedMeta = await adapter.getMeta('default_currency')
      expect(savedMeta).toBe('AED')

      // Reload in a new store instance with the same adapter
      const newStore = new LedgerStore(adapter)
      await newStore.init()
      expect(newStore.getState().defaultCurrency.code).toBe('AED')
    })

    it('can switch between USD, EUR, GBP, and INR', async () => {
      await store.setDefaultCurrency(Currencies.USD)
      expect(store.getState().defaultCurrency.code).toBe('USD')

      await store.setDefaultCurrency(Currencies.EUR)
      expect(store.getState().defaultCurrency.code).toBe('EUR')

      await store.setDefaultCurrency(Currencies.GBP)
      expect(store.getState().defaultCurrency.code).toBe('GBP')
    })
  })

  describe('Expense Date Selection and Editing', () => {
    it('creates expense with custom createdAtMicros date', async () => {
      const customDateMicros = new Date('2026-05-15T12:00:00Z').getTime() * 1000
      const friend = await store.addFriend('Alice')

      const expense = await store.addExpense({
        description: 'Team Lunch',
        totalMinor: 2000,
        currency: Currencies.INR,
        paidBy: store.getState().localPersonId!,
        groupId: null,
        memberIds: [store.getState().localPersonId!, friend.id],
        mode: 'equal',
        createdAtMicros: customDateMicros,
      })

      expect(expense.createdAtMicros).toBe(customDateMicros)
      const stored = store.getState().expenses.find((e) => e.id === expense.id)
      expect(stored?.createdAtMicros).toBe(customDateMicros)
    })

    it('updates existing expense details and date via updateExpense', async () => {
      const friend = await store.addFriend('Bob')
      const initialDateMicros = new Date('2026-01-01T10:00:00Z').getTime() * 1000

      const expense = await store.addExpense({
        description: 'Snacks',
        totalMinor: 1500,
        currency: Currencies.INR,
        paidBy: store.getState().localPersonId!,
        groupId: null,
        memberIds: [store.getState().localPersonId!, friend.id],
        mode: 'equal',
        createdAtMicros: initialDateMicros,
      })

      const updatedDateMicros = new Date('2026-02-14T18:30:00Z').getTime() * 1000
      const updated = await store.updateExpense({
        id: expense.id,
        description: 'Valentines Dinner',
        totalMinor: 5000,
        currency: Currencies.INR,
        paidBy: store.getState().localPersonId!,
        groupId: null,
        memberIds: [store.getState().localPersonId!, friend.id],
        mode: 'equal',
        createdAtMicros: updatedDateMicros,
      })

      expect(updated.id).toBe(expense.id)
      expect(updated.description).toBe('Valentines Dinner')
      expect(updated.totalMinor).toBe(5000)
      expect(updated.createdAtMicros).toBe(updatedDateMicros)

      const fromState = store.getState().expenses.find((e) => e.id === expense.id)
      expect(fromState?.description).toBe('Valentines Dinner')
      expect(fromState?.totalMinor).toBe(5000)
      expect(fromState?.createdAtMicros).toBe(updatedDateMicros)
    })
  })

  describe('Cancel vs Permanent Remove Deletion', () => {
    it('cancelling (soft delete) marks as tombstone and can be restored', async () => {
      const friend = await store.addFriend('Charlie')
      const expense = await store.addExpense({
        description: 'Movie Tickets',
        totalMinor: 1200,
        currency: Currencies.INR,
        paidBy: store.getState().localPersonId!,
        groupId: null,
        memberIds: [store.getState().localPersonId!, friend.id],
        mode: 'equal',
      })

      // Cancel
      await store.deleteExpense(expense.id)
      let found = store.getState().expenses.find((e) => e.id === expense.id)
      expect(found).toBeDefined()
      expect(found?.isTombstone).toBe(true)

      // Restore
      await store.restoreExpense(expense.id)
      found = store.getState().expenses.find((e) => e.id === expense.id)
      expect(found).toBeDefined()
      expect(found?.isTombstone).toBe(false)
    })

    it('permanentRemoveExpense completely purges the record from storage', async () => {
      const friend = await store.addFriend('Dana')
      const expense = await store.addExpense({
        description: 'Groceries',
        totalMinor: 2500,
        currency: Currencies.INR,
        paidBy: store.getState().localPersonId!,
        groupId: null,
        memberIds: [store.getState().localPersonId!, friend.id],
        mode: 'equal',
      })

      expect(store.getState().expenses.some((e) => e.id === expense.id)).toBe(true)

      // Permanently remove
      await store.permanentRemoveExpense(expense.id)

      expect(store.getState().expenses.some((e) => e.id === expense.id)).toBe(false)
      const inAdapter = await adapter.getExpenses()
      expect(inAdapter.some((e) => e.id === expense.id)).toBe(false)
    })

    it('permanentRemoveSettlement completely purges settlement record from storage', async () => {
      const friend = await store.addFriend('Elena')
      const settlement = await store.addSettlement({
        from: store.getState().localPersonId!,
        to: friend.id,
        amountMinor: 1000,
        currency: Currencies.INR,
        groupId: null,
        note: 'UPI Payment',
      })

      expect(store.getState().settlements.some((s) => s.id === settlement.id)).toBe(true)

      await store.permanentRemoveSettlement(settlement.id)

      expect(store.getState().settlements.some((s) => s.id === settlement.id)).toBe(false)
      const inAdapter = await adapter.getSettlements()
      expect(inAdapter.some((s) => s.id === settlement.id)).toBe(false)
    })

    it('permanentRemoveExpenses removes batch of items', async () => {
      const friend = await store.addFriend('Frank')
      const exp1 = await store.addExpense({
        description: 'Item 1',
        totalMinor: 500,
        currency: Currencies.INR,
        paidBy: store.getState().localPersonId!,
        groupId: null,
        memberIds: [store.getState().localPersonId!, friend.id],
        mode: 'equal',
      })
      const exp2 = await store.addExpense({
        description: 'Item 2',
        totalMinor: 600,
        currency: Currencies.INR,
        paidBy: store.getState().localPersonId!,
        groupId: null,
        memberIds: [store.getState().localPersonId!, friend.id],
        mode: 'equal',
      })

      await store.permanentRemoveExpenses([exp1.id, exp2.id])
      const ids = store.getState().expenses.map((e) => e.id)
      expect(ids.includes(exp1.id)).toBe(false)
      expect(ids.includes(exp2.id)).toBe(false)
    })
  })

  describe('NotificationService Functionality', () => {
    let service: NotificationService

    beforeEach(() => {
      service = new NotificationService()
    })

    it('can toggle notifications enabled / disabled state', () => {
      service.setEnabled(false)
      expect(service.isEnabled()).toBe(false)

      service.setEnabled(true)
      expect(service.isEnabled()).toBe(true)
    })

    it('dispatches in-app toasts to active subscribers', () => {
      const received: any[] = []
      const unsubscribe = service.subscribeToast((toast) => {
        received.push(toast)
      })

      service.notify('Test Alert', { body: 'Test Body', type: 'info' })
      expect(received.length).toBe(1)
      expect(received[0].title).toBe('Test Alert')
      expect(received[0].body).toBe('Test Body')
      expect(received[0].type).toBe('info')

      unsubscribe()
      service.notify('After Unsubscribe')
      expect(received.length).toBe(1)
    })

    it('generates remote ops notifications ignoring own device ops', () => {
      const received: any[] = []
      service.subscribeToast((toast) => received.push(toast))

      const dummyExp = buildExpense({
        id: 'exp123',
        description: 'Pizza Party',
        totalMinor: 4000,
        currency: Currencies.INR,
        paidBy: 'peer1',
        groupId: null,
        memberIds: ['peer1', 'user1'],
        mode: 'equal',
        createdAtMicros: Date.now() * 1000,
      })

      const ownOp = opAddExpense({
        opId: 'op_own',
        deviceId: 'my_device',
        atMicros: Date.now() * 1000,
        expense: dummyExp,
      })

      const remoteOp = opAddExpense({
        opId: 'op_remote',
        deviceId: 'friend_device',
        atMicros: Date.now() * 1000,
        expense: dummyExp,
      })

      // Pass local device ID so own ops are filtered out
      service.notifyRemoteOps([ownOp, remoteOp], 'my_device')

      expect(received.length).toBe(1)
      expect(received[0].title).toBe('New Expense Added')
      expect(received[0].body).toContain('Pizza Party')
    })
  })
})
