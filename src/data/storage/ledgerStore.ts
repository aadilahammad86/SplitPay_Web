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
import { normalizeToE164 } from '../../domain/phone'
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

  private onMutationCallback: (() => void) | null = null

  setOnMutation(cb: () => void): void {
    this.onMutationCallback = cb
  }

  notifyMutation(): void {
    if (this.onMutationCallback) {
      try {
        this.onMutationCallback()
      } catch (err) {
        console.warn('Error in store onMutation callback:', err)
      }
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

    // Sanitize any previously polluted dummy persons from people store
    const sanitizedPeople: Person[] = []
    for (const p of people) {
      if (p.id === localPersonId) {
        sanitizedPeople.push(p)
      } else if (
        p.name !== 'You' &&
        p.name !== 'SplitPay Friend' &&
        p.name !== 'Guest User' &&
        !p.id.startsWith('invited_') &&
        p.name.trim() !== ''
      ) {
        sanitizedPeople.push(p)
      } else {
        await this.adapter.removePerson(p.id).catch(() => {})
      }
    }
    people = sanitizedPeople

    if (!localPersonId) {
      // Create initial local profile
      const myId = generateUlid()
      const me: Person = {
        id: myId,
        name: 'You',
        inviteCode: `sp_${myId.slice(-6).toLowerCase()}`,
      }
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

    // Ensure current profile has an inviteCode
    const currentMe = this.me
    if (currentMe && !currentMe.inviteCode) {
      const code = `sp_${localPersonId.slice(-6).toLowerCase()}`
      currentMe.inviteCode = code
      const op = opAddPerson({
        opId: generateUlid(),
        deviceId,
        atMicros: Date.now() * 1000,
        person: currentMe,
      })
      await this.adapter.addPerson(currentMe, op)
    }

    // Auto-sync profile to Supabase on startup
    this.syncMyProfileToCloud().catch(() => {})
  }

  get me(): Person | null {
    if (!this.state.localPersonId) return null
    return this.state.people.find((p) => p.id === this.state.localPersonId) ?? null
  }

  isMe(personId: string): boolean {
    if (!personId) return false
    const myId = this.state.localPersonId
    if (personId === myId) return true
    const currentMe = this.me
    if (!currentMe) return false
    if (currentMe.id === personId) return true

    const target = this.state.people.find((p) => p.id === personId)
    if (!target) return false

    // Check handle match (case-insensitive)
    if (currentMe.handle && target.handle) {
      const cleanMe = currentMe.handle.trim().toLowerCase().replace(/^@/, '')
      const cleanTarget = target.handle.trim().toLowerCase().replace(/^@/, '')
      if (cleanMe && cleanTarget && cleanMe === cleanTarget) return true
    }

    // Check phone match (normalized E.164)
    if (currentMe.phone && target.phone) {
      const normMe = normalizeToE164(currentMe.phone)
      const normTarget = normalizeToE164(target.phone)
      if (normMe.valid && normTarget.valid && normMe.e164 === normTarget.e164) return true
    }

    return false
  }

  resolvePersonId(personId: string): string {
    if (this.isMe(personId)) {
      return this.state.localPersonId || this.me?.id || personId
    }
    return personId
  }

  async createLocalProfile(name: string): Promise<Person> {
    return this.updateLocalProfile({ name })
  }

  async syncMyProfileToCloud(): Promise<boolean> {
    const me = this.me
    if (!me || !this.state.localPersonId) return false

    const supabase = getSupabaseClient()
    if (!supabase) return false

    const inviteCode = me.inviteCode || `sp_${me.id.slice(-6).toLowerCase()}`

    try {
      // If phone is present, prevent idx_unique_phone constraint collisions by removing stale profiles
      if (me.phone) {
        const { data: existingProfiles } = await supabase
          .from('profiles')
          .select('id, phone')
          .eq('phone', me.phone)
          .limit(1)

        if (existingProfiles && existingProfiles.length > 0) {
          const existing = existingProfiles[0]
          if (existing.id !== me.id) {
            await supabase.from('profiles').delete().eq('id', existing.id)
          }
        }
      }

      const { error: upsertErr } = await supabase
        .from('profiles')
        .upsert(
          {
            id: me.id,
            name: me.name || 'Anonymous',
            handle: me.handle || null,
            email: me.email || null,
            email_verified: !!me.emailVerified,
            phone: me.phone || null,
            phone_verified: !!me.phoneVerified,
            discoverable_by_phone: me.discoverableByPhone !== false,
            invite_code: inviteCode,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )

      if (upsertErr) {
        console.warn('[LedgerStore] Supabase profile sync error:', upsertErr)
        return false
      }

      return true
    } catch (err) {
      console.warn('[LedgerStore] Unexpected profile sync failure:', err)
      return false
    }
  }

  async updateLocalProfile(updates: {
    id?: string
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
    const oldId = this.state.localPersonId
    const myId = updates.id || currentMe?.id || oldId || generateUlid()

    // If a new canonical account ID is provided and differs from old localPersonId, migrate records!
    if (updates.id && oldId && updates.id !== oldId) {
      await this.adapter.setMeta('local_person_id', myId)
      await this.adapter.removePerson(oldId).catch(() => {})

      const exps = await this.adapter.getExpenses()
      for (const exp of exps) {
        let changed = false
        let paidBy = exp.paidBy
        if (paidBy === oldId) {
          paidBy = myId
          changed = true
        }
        const shares = exp.shares.map((s) => {
          let sChanged = false
          let owedBy = s.owedBy
          let owedTo = s.owedTo
          if (owedBy === oldId) {
            owedBy = myId
            sChanged = true
          }
          if (owedTo === oldId) {
            owedTo = myId
            sChanged = true
          }
          if (sChanged) changed = true
          return { ...s, owedBy, owedTo }
        })
        if (changed) {
          const updated = { ...exp, paidBy, shares }
          const op = opAddExpense({
            opId: generateUlid(),
            deviceId: this.state.deviceId,
            atMicros: Date.now() * 1000,
            expense: updated,
          })
          await this.adapter.addExpense(updated, op)
        }
      }

      const sets = await this.adapter.getSettlements()
      for (const st of sets) {
        let changed = false
        let from = st.from
        let to = st.to
        if (from === oldId) {
          from = myId
          changed = true
        }
        if (to === oldId) {
          to = myId
          changed = true
        }
        if (changed) {
          const updated = { ...st, from, to }
          const op = opAddSettlement({
            opId: generateUlid(),
            deviceId: this.state.deviceId,
            atMicros: Date.now() * 1000,
            settlement: updated,
          })
          await this.adapter.addSettlement(updated, op)
        }
      }
    }

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
    if (!this.state.localPersonId || this.state.localPersonId !== myId) {
      await this.adapter.setMeta('local_person_id', myId)
    }
    const people = await this.adapter.getPeople()
    const expenses = await this.adapter.getExpenses()
    const settlements = await this.adapter.getSettlements()
    const pending = await this.adapter.getPendingOps()
    this.setState({
      people,
      expenses,
      settlements,
      localPersonId: myId,
      pendingOpsCount: pending.length,
    })

    // Sync profile to live database if Supabase client is connected
    this.syncMyProfileToCloud().catch((err) => {
      console.warn('Background profile cloud sync error:', err)
    })

    this.notifyMutation()
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
    this.notifyMutation()
    return updated
  }

  async addFriend(
    name: string,
    handle?: string,
    extra?: { id?: string; phone?: string; phoneVerified?: boolean; inviteCode?: string }
  ): Promise<Person> {
    const friendId = extra?.id || generateUlid()
    const existing = this.state.people.find(
      (p) => p.id === friendId || (extra?.phone && p.phone === extra.phone)
    )
    if (existing) {
      if ((extra?.phone && !existing.phone) || (extra?.inviteCode && !existing.inviteCode) || (handle && !existing.handle)) {
        const updated: Person = {
          ...existing,
          handle: existing.handle || handle?.trim() || undefined,
          phone: existing.phone || extra?.phone,
          phoneVerified: existing.phoneVerified ?? extra?.phoneVerified,
          inviteCode: existing.inviteCode || extra?.inviteCode,
        }
        const op = opAddPerson({
          opId: generateUlid(),
          deviceId: this.state.deviceId,
          atMicros: Date.now() * 1000,
          person: updated,
        })
        await this.adapter.addPerson(updated, op)
        const people = await this.adapter.getPeople()
        this.setState({ people })
        this.notifyMutation()
        return updated
      }
      return existing
    }

    const person: Person = {
      id: friendId,
      name: name.trim() || 'Friend',
      handle: handle?.trim() || undefined,
      phone: extra?.phone,
      phoneVerified: extra?.phoneVerified,
      inviteCode: extra?.inviteCode,
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
    this.notifyMutation()
    return person
  }

  async removeFriend(friendId: string): Promise<void> {
    if (friendId === this.state.localPersonId) {
      throw new Error('Cannot remove your own user profile.')
    }
    await this.adapter.removePerson(friendId)
    // Remove this friend from any groups they were part of
    for (const group of this.state.groups) {
      if (group.memberIds.includes(friendId)) {
        const updatedGroup: Group = {
          ...group,
          memberIds: group.memberIds.filter((id) => id !== friendId),
        }
        const op = opAddGroup({
          opId: generateUlid(),
          deviceId: this.state.deviceId,
          atMicros: Date.now() * 1000,
          group: updatedGroup,
        })
        await this.adapter.addGroup(updatedGroup, op)
      }
    }
    const people = await this.adapter.getPeople()
    const groups = await this.adapter.getGroups()
    this.setState({ people, groups })
    this.notifyMutation()
  }

  async removeFriends(friendIds: string[]): Promise<void> {
    for (const id of friendIds) {
      if (id !== this.state.localPersonId) {
        await this.removeFriend(id)
      }
    }
    this.notifyMutation()
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
    this.notifyMutation()
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
    this.notifyMutation()
  }

  async deleteGroup(groupId: string): Promise<void> {
    await this.adapter.removeGroup(groupId)
    const groups = await this.adapter.getGroups()
    this.setState({ groups })
    this.notifyMutation()
  }

  async deleteGroups(groupIds: string[]): Promise<void> {
    for (const id of groupIds) {
      await this.adapter.removeGroup(id)
    }
    const groups = await this.adapter.getGroups()
    this.setState({ groups })
    this.notifyMutation()
  }

  async removeGroupMember(groupId: string, memberId: string): Promise<void> {
    const group = this.state.groups.find((g) => g.id === groupId)
    if (!group || !group.memberIds.includes(memberId)) return

    const updated: Group = {
      ...group,
      memberIds: group.memberIds.filter((id) => id !== memberId),
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
    this.notifyMutation()
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
    this.notifyMutation()
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
    this.notifyMutation()
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
    this.notifyMutation()
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
    this.notifyMutation()
    return settlement
  }

  async deleteSettlement(settlementId: string): Promise<void> {
    await this.adapter.deleteSettlement(settlementId)
    const settlements = await this.adapter.getSettlements()
    this.setState({ settlements })
    this.notifyMutation()
  }

  async deleteExpenses(expenseIds: string[]): Promise<void> {
    for (const id of expenseIds) {
      const op = opSetTombstone({
        opId: generateUlid(),
        deviceId: this.state.deviceId,
        atMicros: Date.now() * 1000,
        expenseId: id,
        tombstoned: true,
      })
      await this.adapter.tombstoneExpense(id, op)
    }
    const expenses = await this.adapter.getExpenses()
    const pending = await this.adapter.getPendingOps()
    this.setState({ expenses, pendingOpsCount: pending.length })
    this.notifyMutation()
  }

  async deleteSettlements(settlementIds: string[]): Promise<void> {
    for (const id of settlementIds) {
      await this.adapter.deleteSettlement(id)
    }
    const settlements = await this.adapter.getSettlements()
    this.setState({ settlements })
    this.notifyMutation()
  }

  async clearExpensesAndSettlements(): Promise<void> {
    const expenses = await this.adapter.getExpenses()
    for (const exp of expenses) {
      if (!exp.isTombstone) {
        const op = opSetTombstone({
          opId: generateUlid(),
          deviceId: this.state.deviceId,
          atMicros: Date.now() * 1000,
          expenseId: exp.id,
          tombstoned: true,
        })
        await this.adapter.tombstoneExpense(exp.id, op)
      }
    }
    const settlements = await this.adapter.getSettlements()
    for (const s of settlements) {
      await this.adapter.deleteSettlement(s.id)
    }
    const updatedExpenses = await this.adapter.getExpenses()
    const updatedSettlements = await this.adapter.getSettlements()
    const pending = await this.adapter.getPendingOps()
    this.setState({
      expenses: updatedExpenses,
      settlements: updatedSettlements,
      pendingOpsCount: pending.length,
    })
    this.notifyMutation()
  }

  async clearLedgerData(keepProfile: boolean = true): Promise<void> {
    const currentMe = this.me
    await this.adapter.clearLedgerData(keepProfile)
    if (keepProfile && currentMe) {
      const op = opAddPerson({
        opId: generateUlid(),
        deviceId: this.state.deviceId,
        atMicros: Date.now() * 1000,
        person: currentMe,
      })
      await this.adapter.addPerson(currentMe, op)
      this.setState({
        people: [currentMe],
        groups: [],
        expenses: [],
        settlements: [],
        pendingOpsCount: 1,
      })
    } else {
      this.setState({
        people: [],
        groups: [],
        expenses: [],
        settlements: [],
        pendingOpsCount: 0,
        localPersonId: null,
      })
    }
  }

  async factoryReset(): Promise<void> {
    await this.adapter.clearAll()
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  async applyRemoteOps(ops: SyncOp[]): Promise<void> {
    if (ops.length === 0) return
    await this.adapter.applyRemoteOps(ops)
    let people = await this.adapter.getPeople()
    const groups = await this.adapter.getGroups()
    const expenses = await this.adapter.getExpenses()
    const settlements = await this.adapter.getSettlements()

    const myId = this.state.localPersonId
    const currentMe = this.me || people.find((p) => p.id === myId)

    // Reconcile any alias IDs matching ME (e.g. created by a friend with my handle or phone)
    if (myId && currentMe) {
      const aliasIds: string[] = []
      for (const p of people) {
        if (p.id === myId) continue
        let matchesMe = false
        if (currentMe.handle && p.handle) {
          const mH = currentMe.handle.trim().toLowerCase().replace(/^@/, '')
          const pH = p.handle.trim().toLowerCase().replace(/^@/, '')
          if (mH && pH && mH === pH) matchesMe = true
        }
        if (currentMe.phone && p.phone) {
          const mP = normalizeToE164(currentMe.phone)
          const pP = normalizeToE164(p.phone)
          if (mP.valid && pP.valid && mP.e164 === pP.e164) matchesMe = true
        }
        if (matchesMe) {
          aliasIds.push(p.id)
        }
      }

      if (aliasIds.length > 0) {
        for (const aliasId of aliasIds) {
          await this.adapter.removePerson(aliasId).catch(() => {})
          people = people.filter((p) => p.id !== aliasId)

          for (let i = 0; i < expenses.length; i++) {
            const exp = expenses[i]
            let changed = false
            let paidBy = exp.paidBy
            if (paidBy === aliasId) {
              paidBy = myId
              changed = true
            }
            const shares = exp.shares.map((s) => {
              let sChanged = false
              let owedBy = s.owedBy
              let owedTo = s.owedTo
              if (owedBy === aliasId) {
                owedBy = myId
                sChanged = true
              }
              if (owedTo === aliasId) {
                owedTo = myId
                sChanged = true
              }
              if (sChanged) changed = true
              return { ...s, owedBy, owedTo }
            })
            if (changed) {
              const updated = { ...exp, paidBy, shares }
              await this.adapter.applyRemoteOps([
                opAddExpense({
                  opId: generateUlid(),
                  deviceId: this.state.deviceId,
                  atMicros: Date.now() * 1000,
                  expense: updated,
                }),
              ])
              expenses[i] = updated
            }
          }

          for (let i = 0; i < settlements.length; i++) {
            const set = settlements[i]
            let changed = false
            let from = set.from
            let to = set.to
            if (from === aliasId) {
              from = myId
              changed = true
            }
            if (to === aliasId) {
              to = myId
              changed = true
            }
            if (changed) {
              const updated = { ...set, from, to }
              await this.adapter.applyRemoteOps([
                opAddSettlement({
                  opId: generateUlid(),
                  deviceId: this.state.deviceId,
                  atMicros: Date.now() * 1000,
                  settlement: updated,
                }),
              ])
              settlements[i] = updated
            }
          }
        }
      }
    }

    const currentPending = await this.adapter.getPendingOps()
    this.setState({
      people,
      groups,
      expenses,
      settlements,
      pendingOpsCount: currentPending.length,
    })
  }

  async refreshPendingOpsCount(): Promise<number> {
    const pending = await this.adapter.getPendingOps()
    this.setState({ pendingOpsCount: pending.length })
    return pending.length
  }

  async forceClearOutbox(): Promise<void> {
    const pending = await this.adapter.getPendingOps()
    if (pending.length > 0) {
      await this.adapter.markOpsSynced(pending.map((o) => o.opId))
      await this.refreshPendingOpsCount()
    }
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
