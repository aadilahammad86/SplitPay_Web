import type { CurrencyCode } from '../../domain/money'
import { Currencies } from '../../domain/money'
import type {
  Expense,
  Group,
  GroupKind,
  Person,
  Settlement,
  SplitMode,
} from '../../domain/entities'
import { buildExpense } from '../../domain/splitEngine'
import {
  opAddExpense,
  opAddGroup,
  opAddPerson,
  opAddSettlement,
  opSetTombstone,
  type SyncOp,
} from '../../domain/syncOp'
import { generateUlid } from '../../domain/ulid'
import { getSupabaseClient } from '../../supabase/supabaseClient'
import type { LedgerBackup, StorageAdapter } from './storageAdapter'
import { MemoryStorageAdapter } from './memoryStorageAdapter'

export interface LedgerState {
  readonly people: readonly Person[]
  readonly groups: readonly Group[]
  readonly expenses: readonly Expense[]
  readonly settlements: readonly Settlement[]
  readonly localPersonId: string | null
  readonly deviceId: string
  readonly initialized: boolean
  readonly pendingOpsCount: number
}

export class LedgerStore {
  private adapter: StorageAdapter
  private state: LedgerState
  private listeners = new Set<() => void>()

  constructor(adapter: StorageAdapter) {
    this.adapter = adapter
    this.state = {
      people: [],
      groups: [],
      expenses: [],
      settlements: [],
      localPersonId: null,
      deviceId: '',
      initialized: false,
      pendingOpsCount: 0,
    }
  }

  getState(): LedgerState {
    return this.state
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch (err) {
        console.error('Error in LedgerStore listener:', err)
      }
    }
  }

  private setState(partial: Partial<LedgerState>): void {
    this.state = { ...this.state, ...partial }
    this.notify()
  }

  async init(): Promise<void> {
    if (this.state.initialized) return

    try {
      await this.adapter.init()
    } catch (adapterErr) {
      console.warn('StorageAdapter failed to initialize, falling back to MemoryStorageAdapter:', adapterErr)
      this.adapter = new MemoryStorageAdapter()
      await this.adapter.init()
    }

    // Ensure deviceId exists
    let deviceId = await this.adapter.getMeta('device_id')
    if (!deviceId) {
      deviceId = generateUlid()
      await this.adapter.setMeta('device_id', deviceId)
    }

    // Ensure local person exists
    let localPersonId = await this.adapter.getMeta('local_person_id')
    let people = await this.adapter.getPeople()

    if (!localPersonId) {
      // Create initial local profile
      const myId = generateUlid()
      const me: Person = { id: myId, name: 'You' }
      const op = opAddPerson({
        opId: generateUlid(),
        deviceId,
        atMicros: Date.now() * 1000,
        person: me,
      })
      await this.adapter.addPerson(me, op)
      await this.adapter.setMeta('local_person_id', myId)
      localPersonId = myId
      people = await this.adapter.getPeople()
    }

    const groups = await this.adapter.getGroups()
    const expenses = await this.adapter.getExpenses()
    const settlements = await this.adapter.getSettlements()
    const pendingOps = await this.adapter.getPendingOps()

    this.setState({
      people,
      groups,
      expenses,
      settlements,
      localPersonId,
      deviceId,
      initialized: true,
      pendingOpsCount: pendingOps.length,
    })
  }

  get me(): Person | null {
    if (!this.state.localPersonId) return null
    return this.state.people.find((p) => p.id === this.state.localPersonId) ?? null
  }

  async createLocalProfile(name: string): Promise<Person> {
    return this.updateLocalProfile({ name })
  }

  async updateLocalProfile(updates: {
    name?: string
    handle?: string
    email?: string
    emailVerified?: boolean
    phone?: string
    phoneVerified?: boolean
    discoverableByPhone?: boolean
    inviteCode?: string
  }): Promise<Person> {
    const currentMe = this.me
    const myId = currentMe?.id || this.state.localPersonId || generateUlid()
    const trimmedName = updates.name !== undefined ? (updates.name.trim() || 'You') : (currentMe?.name || 'You')
    const trimmedHandle = updates.handle !== undefined ? (updates.handle.trim() || undefined) : currentMe?.handle

    const updated: Person = {
      ...currentMe,
      id: myId,
      name: trimmedName,
      handle: trimmedHandle,
      email: updates.email !== undefined ? updates.email : currentMe?.email,
      emailVerified: updates.emailVerified !== undefined ? updates.emailVerified : currentMe?.emailVerified,
      phone: updates.phone !== undefined ? updates.phone : currentMe?.phone,
      phoneVerified: updates.phoneVerified !== undefined ? updates.phoneVerified : currentMe?.phoneVerified,
      discoverableByPhone: updates.discoverableByPhone !== undefined ? updates.discoverableByPhone : currentMe?.discoverableByPhone,
      inviteCode: updates.inviteCode !== undefined ? updates.inviteCode : (currentMe?.inviteCode || `sp_${myId.slice(-6).toLowerCase()}`),
    }
    const op = opAddPerson({
      opId: generateUlid(),
      deviceId: this.state.deviceId,
      atMicros: Date.now() * 1000,
      person: updated,
    })
    await this.adapter.addPerson(updated, op)
    if (!this.state.localPersonId) {
      await this.adapter.setMeta('local_person_id', myId)
    }
    const people = await this.adapter.getPeople()
    const pending = await this.adapter.getPendingOps()
    this.setState({
      people,
      localPersonId: myId,
      pendingOpsCount: pending.length,
    })

    // Sync profile to live database if Supabase client is connected
    try {
      const supabase = getSupabaseClient()
      if (supabase) {
        supabase
          .from('profiles')
          .upsert(
            {
              id: myId,
              name: trimmedName,
              handle: trimmedHandle,
              email: updated.email,
              phone: updated.phone,
              discoverable_by_phone: updated.discoverableByPhone !== false,
              invite_code: updated.inviteCode,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          )
          .then(
            () => {},
            (err: unknown) => console.warn('Supabase profile sync warning:', err)
          )
      }
    } catch {
      // Ignore background sync errors
    }

    return updated
  }

  async updatePerson(personId: string, updates: { name: string; handle?: string }): Promise<Person> {
    const existing = this.state.people.find((p) => p.id === personId)
    if (!existing) {
      throw new Error(`Person with id ${personId} not found`)
    }
    const updated: Person = {
      ...existing,
      name: updates.name.trim() || existing.name,
      handle: updates.handle !== undefined ? (updates.handle.trim() || undefined) : existing.handle,
    }
    const op = opAddPerson({
      opId: generateUlid(),
      deviceId: this.state.deviceId,
      atMicros: Date.now() * 1000,
      person: updated,
    })
    await this.adapter.addPerson(updated, op)
    const people = await this.adapter.getPeople()
    const pending = await this.adapter.getPendingOps()
    this.setState({ people, pendingOpsCount: pending.length })
    return updated
  }

  async addFriend(
    name: string,
    handle?: string,
    extra?: { id?: string; phone?: string; phoneVerified?: boolean }
  ): Promise<Person> {
    const friendId = extra?.id || generateUlid()
    const existing = this.state.people.find((p) => p.id === friendId)
    if (existing) return existing

    const person: Person = {
      id: friendId,
      name: name.trim() || 'Friend',
      handle: handle?.trim() || undefined,
      phone: extra?.phone,
      phoneVerified: extra?.phoneVerified,
    }
    const op = opAddPerson({
      opId: generateUlid(),
      deviceId: this.state.deviceId,
      atMicros: Date.now() * 1000,
      person,
    })
    await this.adapter.addPerson(person, op)
    const people = await this.adapter.getPeople()
    const pending = await this.adapter.getPendingOps()
    this.setState({ people, pendingOpsCount: pending.length })
    return person
  }

  async createGroup(params: {
    name: string
    kind: GroupKind
    memberIds: string[]
    currency?: CurrencyCode
  }): Promise<Group> {
    const meId = this.state.localPersonId
    const uniqueMembers = new Set(params.memberIds)
    if (meId) uniqueMembers.add(meId)

    const group: Group = {
      id: generateUlid(),
      name: params.name.trim() || 'New Group',
      kind: params.kind,
      memberIds: Array.from(uniqueMembers),
      currency: params.currency ?? Currencies.INR,
    }

    const op = opAddGroup({
      opId: generateUlid(),
      deviceId: this.state.deviceId,
      atMicros: Date.now() * 1000,
      group,
    })

    await this.adapter.addGroup(group, op)
    const groups = await this.adapter.getGroups()
    const pending = await this.adapter.getPendingOps()
    this.setState({ groups, pendingOpsCount: pending.length })
    return group
  }

  async addGroupMember(groupId: string, personId: string): Promise<void> {
    const group = this.state.groups.find((g) => g.id === groupId)
    if (!group || group.memberIds.includes(personId)) return

    const updated: Group = {
      ...group,
      memberIds: [...group.memberIds, personId],
    }
    const op = opAddGroup({
      opId: generateUlid(),
      deviceId: this.state.deviceId,
      atMicros: Date.now() * 1000,
      group: updated,
    })
    await this.adapter.addGroup(updated, op)
    const groups = await this.adapter.getGroups()
    const pending = await this.adapter.getPendingOps()
    this.setState({ groups, pendingOpsCount: pending.length })
  }

  async addExpense(params: {
    description: string
    totalMinor: number
    currency: CurrencyCode
    paidBy: string
    groupId: string | null
    memberIds: string[]
    mode: SplitMode
    categoryEmoji?: string
    weights?: number[]
    basisPoints?: number[]
    exactAmounts?: number[]
    adjustments?: number[]
  }): Promise<Expense> {
    const expenseId = generateUlid()
    const expense = buildExpense({
      ...params,
      id: expenseId,
      createdAtMicros: Date.now() * 1000,
    })

    const op = opAddExpense({
      opId: generateUlid(),
      deviceId: this.state.deviceId,
      atMicros: Date.now() * 1000,
      expense,
    })

    await this.adapter.addExpense(expense, op)
    const expenses = await this.adapter.getExpenses()
    const pending = await this.adapter.getPendingOps()
    this.setState({ expenses, pendingOpsCount: pending.length })
    return expense
  }

  async deleteExpense(expenseId: string): Promise<void> {
    const op = opSetTombstone({
      opId: generateUlid(),
      deviceId: this.state.deviceId,
      atMicros: Date.now() * 1000,
      expenseId,
      tombstoned: true,
    })
    await this.adapter.tombstoneExpense(expenseId, op)
    const expenses = await this.adapter.getExpenses()
    const pending = await this.adapter.getPendingOps()
    this.setState({ expenses, pendingOpsCount: pending.length })
  }

  async restoreExpense(expenseId: string): Promise<void> {
    const op = opSetTombstone({
      opId: generateUlid(),
      deviceId: this.state.deviceId,
      atMicros: Date.now() * 1000,
      expenseId,
      tombstoned: false,
    })
    await this.adapter.restoreExpense(expenseId, op)
    const expenses = await this.adapter.getExpenses()
    const pending = await this.adapter.getPendingOps()
    this.setState({ expenses, pendingOpsCount: pending.length })
  }

  async addSettlement(params: {
    from: string
    to: string
    amountMinor: number
    currency: CurrencyCode
    groupId: string | null
    note?: string
  }): Promise<Settlement> {
    const settlement: Settlement = {
      id: generateUlid(),
      from: params.from,
      to: params.to,
      amountMinor: params.amountMinor,
      currency: params.currency,
      groupId: params.groupId,
      note: params.note?.trim() || '',
      createdAtMicros: Date.now() * 1000,
    }

    const op = opAddSettlement({
      opId: generateUlid(),
      deviceId: this.state.deviceId,
      atMicros: Date.now() * 1000,
      settlement,
    })

    await this.adapter.addSettlement(settlement, op)
    const settlements = await this.adapter.getSettlements()
    const pending = await this.adapter.getPendingOps()
    this.setState({ settlements, pendingOpsCount: pending.length })
    return settlement
  }

  async applyRemoteOps(ops: SyncOp[]): Promise<void> {
    if (ops.length === 0) return
    await this.adapter.applyRemoteOps(ops)
    const people = await this.adapter.getPeople()
    const groups = await this.adapter.getGroups()
    const expenses = await this.adapter.getExpenses()
    const settlements = await this.adapter.getSettlements()
    const pending = await this.adapter.getPendingOps()
    this.setState({
      people,
      groups,
      expenses,
      settlements,
      pendingOpsCount: pending.length,
    })
  }

  async refreshPendingOpsCount(): Promise<number> {
    const pending = await this.adapter.getPendingOps()
    this.setState({ pendingOpsCount: pending.length })
    return pending.length
  }

  async exportBackup(): Promise<string> {
    const data = await this.adapter.exportAll()
    return JSON.stringify(data, null, 2)
  }

  async importBackup(jsonString: string): Promise<void> {
    const parsed = JSON.parse(jsonString) as LedgerBackup
    if (!parsed || parsed.version !== 1) {
      throw new Error('Invalid or unsupported ledger backup format.')
    }
    await this.adapter.importAll(parsed)
    const people = await this.adapter.getPeople()
    const groups = await this.adapter.getGroups()
    const expenses = await this.adapter.getExpenses()
    const settlements = await this.adapter.getSettlements()
    const localPersonId = await this.adapter.getMeta('local_person_id')
    const pending = await this.adapter.getPendingOps()
    this.setState({
      people,
      groups,
      expenses,
      settlements,
      localPersonId,
      pendingOpsCount: pending.length,
    })
  }

  async loadSampleDemoLedger(currency: CurrencyCode = Currencies.INR): Promise<void> {
    const me = this.me
    const myId = me?.id || this.state.localPersonId
    if (!myId) return

    // Add 3 sample friends
    const alex = await this.addFriend('Alex Rivera', 'alex_r')
    const maya = await this.addFriend('Maya Chen', 'maya_c')
    const liam = await this.addFriend('Liam Patel', 'liam_p')

    // Create a sample trip group
    const group = await this.createGroup({
      name: 'Weekend Getaway (Goa)',
      kind: 'trip',
      memberIds: [alex.id, maya.id, liam.id],
      currency,
    })

    // Add sample expense 1: Airbnb stay paid by You, split equally among all 4
    await this.addExpense({
      description: 'Beachfront Villa Reservation',
      totalMinor: 1200000,
      currency,
      paidBy: myId,
      groupId: group.id,
      memberIds: [myId, alex.id, maya.id, liam.id],
      mode: 'equal',
      categoryEmoji: '🏠',
    })

    // Add sample expense 2: Seafood dinner paid by Alex
    await this.addExpense({
      description: 'Seafood Dinner & Beach Drinks',
      totalMinor: 480000,
      currency,
      paidBy: alex.id,
      groupId: group.id,
      memberIds: [myId, alex.id, maya.id, liam.id],
      mode: 'equal',
      categoryEmoji: '🍔',
    })

    // Add sample expense 3: Direct 1:1 taxi with Maya
    await this.addExpense({
      description: 'Airport Cab Transfer',
      totalMinor: 150000,
      currency,
      paidBy: myId,
      groupId: null,
      memberIds: [myId, maya.id],
      mode: 'equal',
      categoryEmoji: '🚕',
    })
  }

  getAdapter(): StorageAdapter {
    return this.adapter
  }
}
