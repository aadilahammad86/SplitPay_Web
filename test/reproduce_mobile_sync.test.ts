import { describe, it, expect } from 'vitest'
import { indexedDB } from 'fake-indexeddb'
import { createClient } from '@supabase/supabase-js'
import { IndexedDbStorageAdapter } from '../src/data/storage/indexedDbAdapter'
import { LedgerStore } from '../src/data/storage/ledgerStore'
import { defaultAuthService } from '../src/services/auth/authService'
import { defaultNotificationService } from '../src/services/notifications/notificationService'
import { calculateOverallBalance } from '../src/domain/balance'

describe('Mobile Sync Reproduction with live Supabase ops', () => {
  it('simulates fresh mobile device logging in as aadilahammad1406 and syncing', async () => {
    const supabase = createClient(
      'https://uomijchozppmtcmjychc.supabase.co',
      'sb_publishable_KPTpCoULsCu_CwcbL0fwXg_dafVaZ5g'
    )
    const { data: remoteOpsRaw } = await supabase
      .from('ops')
      .select('op_id, device_id, kind, payload_json, created_at_micros')
      .eq('ledger_id', 'default_ledger')
      .order('op_id', { ascending: true })

    expect(remoteOpsRaw).toBeDefined()
    expect(remoteOpsRaw!.length).toBeGreaterThan(0)

    const remoteOps = remoteOpsRaw!.map((r) => ({
      opId: String(r.op_id),
      deviceId: String(r.device_id),
      kind: r.kind,
      payload: r.payload_json ?? {},
      createdAtMicros: Number(r.created_at_micros),
    }))

    // 1. Fresh mobile device
    const adapter = new IndexedDbStorageAdapter(indexedDB)
    await adapter.init()
    const store = new LedgerStore(adapter)
    await store.init()

    // 2. User logs in with session on mobile
    defaultAuthService.saveSession({
      id: '01M4QKYNEKT6B3RZNQHKPN70CR',
      name: 'Aadil',
      username: 'aadilahammad1406',
      phone: '+971553605166',
      isGuest: false,
    })

    // Profile sync as done in App.tsx
    await store.updateLocalProfile({
      id: '01M4QKYNEKT6B3RZNQHKPN70CR',
      name: 'Aadil',
      handle: 'aadilahammad1406',
      phone: '+971553605166',
    })

    // 3. Sync engine pulls all remote ops and applies them
    await store.applyRemoteOps(remoteOps)

    const state = store.getState()
    console.log('PEOPLE ON MOBILE:', state.people.map((p) => ({ id: p.id, name: p.name, handle: p.handle })))
    console.log('EXPENSES COUNT ON MOBILE:', state.expenses.length)
    console.log('ACTIVE EXPENSES:', state.expenses.filter((e) => !e.isTombstone).map((e) => ({
      id: e.id,
      desc: e.description,
      paidBy: e.paidBy,
      shares: e.shares,
    })))

    const validFriends = state.people.filter(
      (p) =>
        !store.isMe(p.id) &&
        p.name !== 'You' &&
        p.name !== 'SplitPay Friend' &&
        p.name !== 'Guest User' &&
        !p.id.startsWith('invited_') &&
        p.name.trim() !== ''
    )
    console.log('VALID FRIENDS ON MOBILE:', validFriends.map((f) => ({ id: f.id, name: f.name })))

    const overall = calculateOverallBalance({
      me: store.me?.id || '',
      friendIds: validFriends.map((f) => f.id),
      expenses: state.expenses,
      settlements: state.settlements,
      isMe: (id) => store.isMe(id),
    })

    console.log('OVERALL BALANCE ON MOBILE:', overall)
    expect(overall.netMinor).toBe(overall.totalOwedToYouMinor - overall.totalYouOweMinor)
    expect(state.people.some((p) => p.name.toLowerCase() === 'test')).toBe(false)
    expect(state.people.filter((p) => (p.handle || '').toLowerCase() === 'nabeel').length).toBe(1)
  })

  it('verifies notification service does not spam on initial sync or for user themselves', () => {
    let notifiedCount = 0
    let lastToastTitle = ''
    const unsub = defaultNotificationService.subscribeToast((toast) => {
      notifiedCount++
      lastToastTitle = toast.title
    })

    const historicalOps = [
      {
        opId: '01M4WQA6JVV0VEWC0MC93FWE79',
        deviceId: 'other_device',
        kind: 'addPerson' as const,
        payload: { id: '01M4QKYNEKT6B3RZNQHKPN70CR', name: 'Aadil', handle: 'aadilahammad1406' },
        createdAtMicros: (Date.now() - 3600_000) * 1000, // 1 hour ago
      },
      {
        opId: '01M4QSRN0AKNBC95RFQNDCDZD6',
        deviceId: 'other_device',
        kind: 'addPerson' as const,
        payload: { id: '01M4QSRE1VMQ334AZVBZK7CE7H', name: 'Nabeel', handle: 'nabeel' },
        createdAtMicros: (Date.now() - 3600_000) * 1000, // 1 hour ago
      },
    ]

    // 1. Initial sync must NOT notify
    defaultNotificationService.notifyRemoteOps(historicalOps, {
      localDeviceId: 'my_device',
      isMe: (id) => id === '01M4QKYNEKT6B3RZNQHKPN70CR',
      myName: 'Aadil',
      myHandle: 'aadilahammad1406',
      isInitialSync: true,
    })
    expect(notifiedCount).toBe(0)

    // 2. Historical ops even without isInitialSync flag must NOT notify because they are older than 60s
    defaultNotificationService.notifyRemoteOps(historicalOps, {
      localDeviceId: 'my_device',
      isMe: (id) => id === '01M4QKYNEKT6B3RZNQHKPN70CR',
      myName: 'Aadil',
      myHandle: 'aadilahammad1406',
      isInitialSync: false,
    })
    expect(notifiedCount).toBe(0)

    // 3. New real-time op for "me" must NOT notify
    const selfOp = [
      {
        opId: '01M4NEWSELFOP1234567890123',
        deviceId: 'other_device',
        kind: 'addPerson' as const,
        payload: { id: '01M4QKYNEKT6B3RZNQHKPN70CR', name: 'Aadil', handle: 'aadilahammad1406' },
        createdAtMicros: Date.now() * 1000,
      },
    ]
    defaultNotificationService.notifyRemoteOps(selfOp, {
      localDeviceId: 'my_device',
      isMe: (id) => id === '01M4QKYNEKT6B3RZNQHKPN70CR',
      myName: 'Aadil',
      myHandle: 'aadilahammad1406',
      isInitialSync: false,
    })
    expect(notifiedCount).toBe(0)

    // 4. Real-time op for a brand-new friend SHOULD notify
    const friendOp = [
      {
        opId: '01M4NEWFRIENDOP12345678901',
        deviceId: 'other_device',
        kind: 'addPerson' as const,
        payload: { id: '01NEWFRIEND123456789012345', name: 'Sara', handle: 'sara_travel' },
        createdAtMicros: Date.now() * 1000,
      },
    ]
    defaultNotificationService.notifyRemoteOps(friendOp, {
      localDeviceId: 'my_device',
      isMe: (id) => id === '01M4QKYNEKT6B3RZNQHKPN70CR',
      myName: 'Aadil',
      myHandle: 'aadilahammad1406',
      isInitialSync: false,
    })
    expect(notifiedCount).toBe(1)
    expect(lastToastTitle).toBe('Friend Connected')

    unsub()
  })
})
