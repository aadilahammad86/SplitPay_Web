import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryStorageAdapter } from '../../src/data/storage/memoryStorageAdapter'
import { LedgerStore } from '../../src/data/storage/ledgerStore'
import { SimulatedNetworkTransport, SupabaseSyncTransport } from '../../src/data/sync/syncTransport'
import { SyncEngine } from '../../src/data/sync/syncEngine'
import { Currencies } from '../../src/domain/money'
import { validatePublishableKey } from '../../src/supabase/supabaseClient'
import { breakdownFor } from '../../src/domain/balance'

describe('Sync Engine - Multi-Device Convergence & Offline Recovery (ADR 0003)', () => {
  let transport: SimulatedNetworkTransport
  let storeA: LedgerStore
  let storeB: LedgerStore
  let engineA: SyncEngine
  let engineB: SyncEngine
  const sharedLedgerId = 'ledger_shared_001'

  beforeEach(async () => {
    transport = new SimulatedNetworkTransport()

    const adapterA = new MemoryStorageAdapter()
    storeA = new LedgerStore(adapterA)
    await storeA.init()
    await storeA.createLocalProfile('Alice')

    const adapterB = new MemoryStorageAdapter()
    storeB = new LedgerStore(adapterB)
    await storeB.init()
    await storeB.createLocalProfile('Bob')

    engineA = new SyncEngine({ store: storeA, transport })
    engineB = new SyncEngine({ store: storeB, transport })
  })

  it('two users write offline on separate networks, reconnect, and mathematically converge', async () => {
    // Both connect to the shared ledger
    await engineA.start(sharedLedgerId)
    await engineB.start(sharedLedgerId)

    const aliceId = storeA.getState().localPersonId!
    const bobId = storeB.getState().localPersonId!

    // Network goes down (offline)
    transport.isOnline = false
    engineA.setOnline(false)
    engineB.setOnline(false)

    // Alice adds an offline expense: 1000 minor units, Bob owes 500
    await storeA.addExpense({
      description: 'Groceries',
      totalMinor: 1000,
      currency: Currencies.INR,
      paidBy: aliceId,
      groupId: null,
      memberIds: [aliceId, bobId],
      mode: 'equal',
    })

    // Bob adds an offline expense: 600 minor units, Alice owes 300
    await storeB.addExpense({
      description: 'Coffee',
      totalMinor: 600,
      currency: Currencies.INR,
      paidBy: bobId,
      groupId: null,
      memberIds: [aliceId, bobId],
      mode: 'equal',
    })

    // Both have 1 pending op in their outbox
    expect(storeA.getState().pendingOpsCount).toBeGreaterThan(0)
    expect(storeB.getState().pendingOpsCount).toBeGreaterThan(0)

    // Reconnection occurs
    transport.isOnline = true
    engineA.setOnline(true)
    engineB.setOnline(true)

    // Alice syncs
    await engineA.syncNow()
    // Bob syncs
    await engineB.syncNow()
    // Alice syncs to pull Bob's uploaded ops
    await engineA.syncNow()

    // Both should have 0 pending ops
    expect(storeA.getState().pendingOpsCount).toBe(0)
    expect(storeB.getState().pendingOpsCount).toBe(0)

    // Both should have both expenses
    expect(storeA.getState().expenses.length).toBe(2)
    expect(storeB.getState().expenses.length).toBe(2)

    // Calculate balances on both devices
    const balanceOnAlice = breakdownFor({
      me: aliceId,
      friend: bobId,
      expenses: storeA.getState().expenses,
      settlements: storeA.getState().settlements,
    })

    const balanceOnBob = breakdownFor({
      me: bobId,
      friend: aliceId,
      expenses: storeB.getState().expenses,
      settlements: storeB.getState().settlements,
    })

    // Alice is owed 500 (groceries) - 300 (coffee) = +200 minor units
    // Bob owes Alice -200 minor units
    expect(balanceOnAlice.netMinor).toBe(200)
    expect(balanceOnBob.netMinor).toBe(-200)
    expect(balanceOnAlice.netMinor + balanceOnBob.netMinor).toBe(0)
  })

  it('idempotently handles duplicate operation deliveries without double counting', async () => {
    await engineA.start(sharedLedgerId)
    const aliceId = storeA.getState().localPersonId!

    await storeA.addExpense({
      description: 'Dinner',
      totalMinor: 4000,
      currency: Currencies.INR,
      paidBy: aliceId,
      groupId: null,
      memberIds: [aliceId, 'friend_xyz'],
      mode: 'equal',
    })

    await engineA.syncNow()

    // Grab all ops from transport and push duplicate identical ops
    const pulledOps = await transport.pullOps(sharedLedgerId, null)
    expect(pulledOps.length).toBeGreaterThan(0)

    // Apply the exact same ops again
    await storeA.applyRemoteOps(pulledOps)

    expect(storeA.getState().expenses.length).toBe(1)
    expect(storeA.getState().expenses[0]?.totalMinor).toBe(4000)
  })

  it('recovers missed updates via cursor pull when offline', async () => {
    await engineA.start(sharedLedgerId)
    await engineB.start(sharedLedgerId)

    const aliceId = storeA.getState().localPersonId!
    const bobId = storeB.getState().localPersonId!

    // Bob goes offline
    engineB.stop()

    // Alice creates 2 expenses while Bob is offline
    await storeA.addExpense({
      description: 'Taxi',
      totalMinor: 500,
      currency: Currencies.INR,
      paidBy: aliceId,
      groupId: null,
      memberIds: [aliceId, bobId],
      mode: 'equal',
    })
    await storeA.addExpense({
      description: 'Lunch',
      totalMinor: 800,
      currency: Currencies.INR,
      paidBy: aliceId,
      groupId: null,
      memberIds: [aliceId, bobId],
      mode: 'equal',
    })
    await engineA.syncNow()

    expect(storeB.getState().expenses.length).toBe(0)

    // Bob resumes app and syncs
    await engineB.start(sharedLedgerId)

    expect(storeB.getState().expenses.length).toBe(2)
  })

  it('concurrent changes: simultaneous offline expenses and settlements converge to identical balances', async () => {
    await engineA.start(sharedLedgerId)
    await engineB.start(sharedLedgerId)

    const aliceId = storeA.getState().localPersonId!
    const bobId = storeB.getState().localPersonId!

    // Network disconnects
    transport.isOnline = false
    engineA.setOnline(false)
    engineB.setOnline(false)

    // Alice adds dinner: 1200 INR (Bob owes 600)
    await storeA.addExpense({
      description: 'Dinner Party',
      totalMinor: 1200,
      currency: Currencies.INR,
      paidBy: aliceId,
      groupId: null,
      memberIds: [aliceId, bobId],
      mode: 'equal',
    })

    // Bob adds cab: 400 INR (Alice owes 200)
    await storeB.addExpense({
      description: 'Cab Ride',
      totalMinor: 400,
      currency: Currencies.INR,
      paidBy: bobId,
      groupId: null,
      memberIds: [aliceId, bobId],
      mode: 'equal',
    })

    // Bob also records partial settlement of 150 INR to Alice offline
    await storeB.addSettlement({
      from: bobId,
      to: aliceId,
      amountMinor: 150,
      currency: Currencies.INR,
      groupId: null,
      note: 'Partial payment',
    })

    // Both reconnect
    transport.isOnline = true
    engineA.setOnline(true)
    engineB.setOnline(true)

    await engineA.syncNow()
    await engineB.syncNow()
    // Secondary sync pass to pick up peer's pushed updates
    await engineA.syncNow()

    // Mathematical convergence check:
    // Alice paid 1200, owes 200 for cab = +400. Received 150 settlement = +250 net owed to Alice.
    // Bob paid 400, owes 600 for dinner = -400. Paid 150 settlement = -250 net owed by Bob.
    const aliceBreakdownOnA = breakdownFor({
      me: aliceId,
      friend: bobId,
      expenses: storeA.getState().expenses,
      settlements: storeA.getState().settlements,
    })
    const aliceBreakdownOnB = breakdownFor({
      me: aliceId,
      friend: bobId,
      expenses: storeB.getState().expenses,
      settlements: storeB.getState().settlements,
    })

    expect(aliceBreakdownOnA.netMinor).toBe(250)
    expect(aliceBreakdownOnB.netMinor).toBe(250)
    expect(storeA.getState().expenses.length).toBe(storeB.getState().expenses.length)
    expect(storeA.getState().settlements.length).toBe(storeB.getState().settlements.length)
  })

  it('cross-device expense deletion: deleting an expense on device A tombstones it on device B and updates balance', async () => {
    await engineA.start(sharedLedgerId)
    await engineB.start(sharedLedgerId)

    const aliceId = storeA.getState().localPersonId!
    const bobId = storeB.getState().localPersonId!

    // Alice creates an expense shared with Bob: 1000 INR
    const exp = await storeA.addExpense({
      description: 'Dinner',
      totalMinor: 1000,
      currency: Currencies.INR,
      paidBy: aliceId,
      groupId: null,
      memberIds: [aliceId, bobId],
      mode: 'equal',
    })

    // Both sync
    await engineA.syncNow()
    await engineB.syncNow()

    expect(storeB.getState().expenses.length).toBe(1)
    expect(storeB.getState().expenses[0]?.isTombstone).toBe(false)
    expect(breakdownFor({ me: aliceId, friend: bobId, expenses: storeB.getState().expenses, settlements: [] }).netMinor).toBe(500)

    // Alice deletes the expense
    await storeA.deleteExpense(exp.id)
    expect(storeA.getState().expenses[0]?.isTombstone).toBe(true)

    // Alice syncs to push tombstone op, then Bob syncs to pull it
    await engineA.syncNow()
    await engineB.syncNow()

    // Bob must now have the expense tombstoned and mutual balance is 0
    expect(storeB.getState().expenses[0]?.isTombstone).toBe(true)
    const bBreakdown = breakdownFor({
      me: aliceId,
      friend: bobId,
      expenses: storeB.getState().expenses,
      settlements: storeB.getState().settlements,
    })
    expect(bBreakdown.netMinor).toBe(0)
  })

  it('cross-device settlement deletion: deleting a settlement on device A tombstones it on device B and reverts balance', async () => {
    await engineA.start(sharedLedgerId)
    await engineB.start(sharedLedgerId)

    const aliceId = storeA.getState().localPersonId!
    const bobId = storeB.getState().localPersonId!

    // Alice records a settlement of 500 INR to Bob
    const settlement = await storeA.addSettlement({
      from: aliceId,
      to: bobId,
      amountMinor: 500,
      currency: Currencies.INR,
      groupId: null,
      note: 'Payment',
    })

    await engineA.syncNow()
    await engineB.syncNow()

    expect(storeB.getState().settlements.length).toBe(1)
    expect(storeB.getState().settlements[0]?.isTombstone).toBeFalsy()

    // Alice deletes the settlement
    await storeA.deleteSettlement(settlement.id)
    await engineA.syncNow()
    await engineB.syncNow()

    // Device B must reflect the tombstoned settlement
    expect(storeB.getState().settlements[0]?.isTombstone).toBe(true)
    const balanceOnB = breakdownFor({
      me: bobId,
      friend: aliceId,
      expenses: storeB.getState().expenses,
      settlements: storeB.getState().settlements,
    })
    expect(balanceOnB.netMinor).toBe(0)
  })

  it('out-of-order tombstone arrival: tombstone op arrives before expense op, expense remains tombstoned', async () => {
    await engineB.start(sharedLedgerId)

    const opTombstone = {
      opId: '02_TOMBSTONE_OP',
      deviceId: 'device_a',
      kind: 'tombstoneExpense' as const,
      payload: { expenseId: 'exp_out_of_order_1' },
      createdAtMicros: 2000,
    }

    const opAdd = {
      opId: '01_ADD_EXPENSE_OP',
      deviceId: 'device_a',
      kind: 'addExpense' as const,
      payload: {
        id: 'exp_out_of_order_1',
        description: 'Late arrival expense',
        totalMinor: 2000,
        currency: 'INR',
        paidBy: 'alice_1',
        groupId: null,
        mode: 'equal',
        createdAtMicros: 1000,
        categoryEmoji: '🧾',
        isTombstone: false,
        shares: [],
      },
      createdAtMicros: 1000,
    }

    // Apply tombstone FIRST (orphan)
    await storeB.applyRemoteOps([opTombstone])

    // Then later apply the original addExpense
    await storeB.applyRemoteOps([opAdd])

    // The expense must be tombstoned because the latest op for it is tombstoneExpense!
    const exp = storeB.getState().expenses.find((e) => e.id === 'exp_out_of_order_1')
    expect(exp).toBeDefined()
    expect(exp?.isTombstone).toBe(true)
  })
})

describe('Security & Secrets (INV RLS, Zero Service-Role)', () => {
  it('strictly rejects service-role keys', () => {
    expect(() => {
      validatePublishableKey('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service_role.fake_key')
    }).toThrow(/SECURITY VIOLATION/)

    expect(() => {
      validatePublishableKey('supabase_secret_key_12345')
    }).toThrow(/SECURITY VIOLATION/)
  })

  it('accepts valid publishable anon keys', () => {
    expect(() => {
      validatePublishableKey('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon_publishable_key')
    }).not.toThrow()
  })

  it('rejects non-member access when RLS membership is enforced', async () => {
    const secureTransport = new SimulatedNetworkTransport()
    const secureLedgerId = 'ledger_secure_999'

    // Authorize only Alice's device
    secureTransport.authorizeMember(secureLedgerId, 'alice_device_id')

    // Alice can push
    const aliceOp = {
      opId: '01M4_ALICE_OP',
      deviceId: 'alice_device_id',
      kind: 'addPerson' as const,
      payload: { id: 'p1', name: 'Alice' },
      createdAtMicros: 1000,
    }
    await expect(secureTransport.pushOps(secureLedgerId, [aliceOp])).resolves.not.toThrow()

    // Non-member attacker device tries to push
    const attackerOp = {
      opId: '01M4_ATTACKER_OP',
      deviceId: 'malicious_device_id',
      kind: 'addExpense' as const,
      payload: { id: 'exp_hack', description: 'Fraud', totalMinor: 999999 },
      createdAtMicros: 2000,
    }
    await expect(secureTransport.pushOps(secureLedgerId, [attackerOp])).rejects.toThrow(/403 Forbidden/)

    // Non-member attacker device tries to pull
    await expect(secureTransport.pullOps(secureLedgerId, null, 100, 'malicious_device_id')).rejects.toThrow(/403 Forbidden/)
  })

  it('SupabaseSyncTransport safely cleans existing channel and never throws after subscribe', () => {
    const removed: string[] = []
    const mockChannel = {
      topic: 'ops_ledger_1',
      on: () => mockChannel,
      subscribe: () => mockChannel,
    }
    const mockClient = {
      getChannels: () => [mockChannel],
      removeChannel: (ch: { topic: string }) => {
        removed.push(ch.topic)
      },
      channel: () => mockChannel,
    }

    const transport = new SupabaseSyncTransport(mockClient as any)
    const unsub = transport.subscribe('ledger_1', () => {})
    expect(removed).toContain('ops_ledger_1')
    expect(typeof unsub).toBe('function')
    unsub()
  })
})
