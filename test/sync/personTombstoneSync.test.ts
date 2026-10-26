import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryStorageAdapter } from '../../src/data/storage/memoryStorageAdapter'
import { LedgerStore } from '../../src/data/storage/ledgerStore'
import { SimulatedNetworkTransport } from '../../src/data/sync/syncTransport'
import { SyncEngine } from '../../src/data/sync/syncEngine'
import { opAddPerson, opSetPersonTombstone, applyOps, type LedgerSnapshot } from '../../src/domain/syncOp'

describe('Person Tombstoning & Cross-Device Sync (Option A Anti-Resurrection)', () => {
  let transport: SimulatedNetworkTransport
  let storeA: LedgerStore
  let storeB: LedgerStore
  let engineA: SyncEngine
  let engineB: SyncEngine
  const sharedLedgerId = 'ledger_test_tombstone'

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

  it('removing a friend creates a tombstone SyncOp that syncs to another device and prevents resurrection', async () => {
    await engineA.start(sharedLedgerId)
    await engineB.start(sharedLedgerId)

    // Device A adds Charlie as a friend
    const charlie = await storeA.addFriend('Charlie', 'charlie_h')
    await engineA.syncNow()
    await engineB.syncNow()

    // Device B should now have Charlie
    const bobPeopleAfterAdd = storeB.getState().people
    const charlieOnB = bobPeopleAfterAdd.find((p) => p.id === charlie.id)
    expect(charlieOnB).toBeDefined()
    expect(charlieOnB?.isTombstone).toBeFalsy()

    // Device A removes Charlie
    await storeA.removeFriend(charlie.id)
    const charlieOnA = storeA.getState().people.find((p) => p.id === charlie.id)
    expect(charlieOnA?.isTombstone).toBe(true)

    // Sync A to remote and sync B from remote
    await engineA.syncNow()
    await engineB.syncNow()

    // Device B should now see Charlie tombstoned
    const charlieOnBAfterRemove = storeB.getState().people.find((p) => p.id === charlie.id)
    expect(charlieOnBAfterRemove?.isTombstone).toBe(true)

    // Device C joins fresh and downloads all historical ops from transport
    const adapterC = new MemoryStorageAdapter()
    const storeC = new LedgerStore(adapterC)
    await storeC.init()
    const engineC = new SyncEngine({ store: storeC, transport })
    await engineC.start(sharedLedgerId)
    await engineC.syncNow()

    // Device C should also have Charlie tombstoned, NOT resurrected!
    const charlieOnC = storeC.getState().people.find((p) => p.id === charlie.id)
    expect(charlieOnC).toBeDefined()
    expect(charlieOnC?.isTombstone).toBe(true)
  })

  it('re-adding a tombstoned friend explicitly restores them', async () => {
    await engineA.start(sharedLedgerId)

    const charlie = await storeA.addFriend('Charlie', 'charlie_h')
    await storeA.removeFriend(charlie.id)
    expect(storeA.getState().people.find((p) => p.id === charlie.id)?.isTombstone).toBe(true)

    // Re-add Charlie with the same ID
    const restored = await storeA.addFriend('Charlie', 'charlie_h', { id: charlie.id })
    expect(restored.id).toBe(charlie.id)
    expect(restored.isTombstone).toBe(false)
    expect(storeA.getState().people.find((p) => p.id === charlie.id)?.isTombstone).toBe(false)
  })

  it('domain applyOps resolves LWW for tombstone and restore ops correctly', () => {
    const emptyBase: LedgerSnapshot = {
      people: [],
      groups: [],
      expenses: [],
      settlements: [],
    }

    const personId = 'person_01'
    const op1 = opAddPerson({
      opId: '01ARZ3NDEKTSV4RRFFQ69G5FA1',
      deviceId: 'dev_1',
      atMicros: 1000,
      person: { id: personId, name: 'Dave' },
    })
    const op2 = opSetPersonTombstone({
      opId: '01ARZ3NDEKTSV4RRFFQ69G5FA2',
      deviceId: 'dev_1',
      atMicros: 2000,
      personId,
      tombstoned: true,
    })

    // Forward order: add then tombstone -> tombstone wins
    const stateForward = applyOps(emptyBase, [op1, op2])
    const daveForward = stateForward.people.find((p) => p.id === personId)
    expect(daveForward?.isTombstone).toBe(true)

    // Reverse order: tombstone arriving before add (or simultaneous) -> tombstone still wins because op2 > op1
    const stateReverse = applyOps(emptyBase, [op2, op1])
    const daveReverse = stateReverse.people.find((p) => p.id === personId)
    expect(daveReverse?.isTombstone).toBe(true)

    // Now restore with op3 > op2
    const op3 = opSetPersonTombstone({
      opId: '01ARZ3NDEKTSV4RRFFQ69G5FA3',
      deviceId: 'dev_2',
      atMicros: 3000,
      personId,
      tombstoned: false,
    })
    const stateRestored = applyOps(emptyBase, [op1, op2, op3])
    const daveRestored = stateRestored.people.find((p) => p.id === personId)
    expect(daveRestored?.isTombstone).toBe(false)
  })
})
