import type {
  Person,
  Group,
  Expense,
  ExpenseShare,
  Settlement,
  GroupKind,
  SplitMode,
} from './entities'
import { currencyFromCode } from './money'

export const SYNC_OP_FORMAT_VERSION = 1

export type OpKind =
  | 'addPerson'
  | 'addGroup'
  | 'addExpense'
  | 'tombstoneExpense'
  | 'restoreExpense'
  | 'addSettlement'
  | 'tombstoneSettlement'
  | 'restoreSettlement'

export interface SyncOp {
  opId: string
  deviceId: string
  kind: OpKind
  payload: Record<string, unknown>
  createdAtMicros: number
}

export interface LedgerSnapshot {
  people: Person[]
  groups: Group[]
  expenses: Expense[]
  settlements: Settlement[]
}

export function emptyLedgerSnapshot(): LedgerSnapshot {
  return {
    people: [],
    groups: [],
    expenses: [],
    settlements: [],
  }
}

// -- Serialization / Deserialization -----------------------------------------

export function encodePerson(p: Person): Record<string, unknown> {
  return { id: p.id, name: p.name, handle: p.handle ?? null }
}

export function decodePerson(m: Record<string, unknown>): Person {
  return {
    id: String(m.id),
    name: String(m.name),
    handle: m.handle ? String(m.handle) : undefined,
  }
}

export function encodeGroup(g: Group): Record<string, unknown> {
  return {
    id: g.id,
    name: g.name,
    kind: g.kind,
    memberIds: [...g.memberIds],
    currency: g.currency.code,
  }
}

export function decodeGroup(m: Record<string, unknown>): Group {
  return {
    id: String(m.id),
    name: String(m.name),
    kind: (m.kind as GroupKind) ?? 'other',
    memberIds: Array.isArray(m.memberIds) ? m.memberIds.map(String) : [],
    currency: currencyFromCode(String(m.currency)),
  }
}

export function encodeShare(s: ExpenseShare): Record<string, unknown> {
  return {
    id: s.id,
    expenseId: s.expenseId,
    owedBy: s.owedBy,
    owedTo: s.owedTo,
    amountMinor: s.amountMinor,
    groupId: s.groupId ?? null,
  }
}

function parseIntegerMinor(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && Number.isInteger(val)) return val
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10)
    if (Number.isInteger(parsed)) return parsed
  }
  return fallback
}

export function decodeShare(m: Record<string, unknown>): ExpenseShare {
  return {
    id: String(m.id ?? ''),
    expenseId: String(m.expenseId ?? ''),
    owedBy: String(m.owedBy ?? ''),
    owedTo: String(m.owedTo ?? ''),
    amountMinor: parseIntegerMinor(m.amountMinor),
    groupId: m.groupId ? String(m.groupId) : null,
  }
}

export function encodeExpense(e: Expense): Record<string, unknown> {
  return {
    id: e.id,
    description: e.description,
    totalMinor: e.totalMinor,
    currency: e.currency.code,
    paidBy: e.paidBy,
    groupId: e.groupId ?? null,
    mode: e.mode,
    createdAtMicros: e.createdAtMicros,
    categoryEmoji: e.categoryEmoji,
    isTombstone: e.isTombstone,
    shares: e.shares.map(encodeShare),
    isLoan: Boolean(e.isLoan),
    loanType: e.loanType ?? null,
    dueDateMicros: e.dueDateMicros ?? null,
  }
}

export function decodeExpense(m: Record<string, unknown>): Expense {
  const sharesRaw = Array.isArray(m.shares) ? m.shares : []
  const rawMinor = m.totalMinor ?? m.amountMinor
  return {
    id: String(m.id ?? ''),
    description: String(m.description ?? ''),
    totalMinor: parseIntegerMinor(rawMinor),
    currency: currencyFromCode(String(m.currency ?? '')),
    paidBy: String(m.paidBy ?? ''),
    groupId: m.groupId ? String(m.groupId) : null,
    mode: (m.mode as SplitMode) ?? 'equal',
    createdAtMicros: parseIntegerMinor(m.createdAtMicros),
    categoryEmoji: String(m.categoryEmoji ?? '🧾'),
    isTombstone: Boolean(m.isTombstone),
    shares: sharesRaw.map((s) => decodeShare(s as Record<string, unknown>)),
    isLoan: Boolean(m.isLoan),
    loanType: m.loanType === 'lent' || m.loanType === 'borrowed' ? m.loanType : undefined,
    dueDateMicros: m.dueDateMicros ? parseIntegerMinor(m.dueDateMicros) : undefined,
  }
}

export function encodeSettlement(s: Settlement): Record<string, unknown> {
  return {
    id: s.id,
    from: s.from,
    to: s.to,
    amountMinor: s.amountMinor,
    currency: s.currency.code,
    groupId: s.groupId ?? null,
    note: s.note,
    createdAtMicros: s.createdAtMicros,
    isTombstone: s.isTombstone ?? false,
  }
}

export function decodeSettlement(m: Record<string, unknown>): Settlement {
  const rawMinor = m.amountMinor ?? m.totalMinor
  return {
    id: String(m.id ?? ''),
    from: String(m.from ?? ''),
    to: String(m.to ?? ''),
    amountMinor: parseIntegerMinor(rawMinor),
    currency: currencyFromCode(String(m.currency ?? '')),
    groupId: m.groupId ? String(m.groupId) : null,
    note: String(m.note ?? ''),
    createdAtMicros: parseIntegerMinor(m.createdAtMicros),
    isTombstone: Boolean(m.isTombstone),
  }
}

// -- Op Creators -------------------------------------------------------------

export function opAddPerson(params: {
  opId: string
  deviceId: string
  atMicros: number
  person: Person
}): SyncOp {
  return {
    opId: params.opId,
    deviceId: params.deviceId,
    kind: 'addPerson',
    payload: encodePerson(params.person),
    createdAtMicros: params.atMicros,
  }
}

export function opAddGroup(params: {
  opId: string
  deviceId: string
  atMicros: number
  group: Group
}): SyncOp {
  return {
    opId: params.opId,
    deviceId: params.deviceId,
    kind: 'addGroup',
    payload: encodeGroup(params.group),
    createdAtMicros: params.atMicros,
  }
}

export function opAddExpense(params: {
  opId: string
  deviceId: string
  atMicros: number
  expense: Expense
}): SyncOp {
  return {
    opId: params.opId,
    deviceId: params.deviceId,
    kind: 'addExpense',
    payload: encodeExpense(params.expense),
    createdAtMicros: params.atMicros,
  }
}

export function opSetTombstone(params: {
  opId: string
  deviceId: string
  atMicros: number
  expenseId: string
  tombstoned: boolean
}): SyncOp {
  return {
    opId: params.opId,
    deviceId: params.deviceId,
    kind: params.tombstoned ? 'tombstoneExpense' : 'restoreExpense',
    payload: { expenseId: params.expenseId },
    createdAtMicros: params.atMicros,
  }
}

export function opAddSettlement(params: {
  opId: string
  deviceId: string
  atMicros: number
  settlement: Settlement
}): SyncOp {
  return {
    opId: params.opId,
    deviceId: params.deviceId,
    kind: 'addSettlement',
    payload: encodeSettlement(params.settlement),
    createdAtMicros: params.atMicros,
  }
}

export function opSetSettlementTombstone(params: {
  opId: string
  deviceId: string
  atMicros: number
  settlementId: string
  tombstoned: boolean
}): SyncOp {
  return {
    opId: params.opId,
    deviceId: params.deviceId,
    kind: params.tombstoned ? 'tombstoneSettlement' : 'restoreSettlement',
    payload: { settlementId: params.settlementId, id: params.settlementId },
    createdAtMicros: params.atMicros,
  }
}

// -- Pure Idempotent Fold: applyOps ------------------------------------------

/**
 * Folds [ops] into [base] snapshot.
 *
 * Guarantees (INV-3, INV-4, DS-04):
 *  1. Idempotent: Deduplicated by opId.
 *  2. Commutative: Sorted by opId before folding. Any devices observing the same
 *     set of ops produce the exact same ledger snapshot.
 *  3. Skew-proof: Tombstone/restore operations are evaluated in Pass 2
 *     using the highest opId among mutations for that expense or settlement.
 */
export function applyOps(base: LedgerSnapshot, ops: Iterable<SyncOp>): LedgerSnapshot {
  const people = new Map<string, Person>()
  for (const p of base.people) people.set(p.id, p)

  const groups = new Map<string, Group>()
  for (const g of base.groups) groups.set(g.id, g)

  const expenses = new Map<string, Expense>()
  for (const e of base.expenses) expenses.set(e.id, e)

  const settlements = new Map<string, Settlement>()
  for (const s of base.settlements) settlements.set(s.id, s)

  // Deduplicate by opId
  const unique = new Map<string, SyncOp>()
  for (const op of ops) {
    unique.set(op.opId, op)
  }

  // Canonical sort by opId ascending
  const ordered = Array.from(unique.values()).sort((a, b) => a.opId.localeCompare(b.opId))

  // Pass 2 state: winning tombstone decision per expenseId / settlementId: { opId, value }
  const expenseTombstoneWinner = new Map<string, { opId: string; value: boolean }>()
  const settlementTombstoneWinner = new Map<string, { opId: string; value: boolean }>()

  // Pass 1: Apply entity insertions and record tombstone intents
  for (const op of ordered) {
    switch (op.kind) {
      case 'addPerson': {
        const p = decodePerson(op.payload)
        people.set(p.id, p)
        break
      }
      case 'addGroup': {
        const g = decodeGroup(op.payload)
        groups.set(g.id, g)
        break
      }
      case 'addExpense': {
        const e = decodeExpense(op.payload)
        expenses.set(e.id, e)
        break
      }
      case 'addSettlement': {
        const s = decodeSettlement(op.payload)
        settlements.set(s.id, s)
        break
      }
      case 'tombstoneExpense':
      case 'restoreExpense': {
        const id = String(op.payload.expenseId || op.payload.expense_id || op.payload.id || '')
        if (!id) break
        const value = op.kind === 'tombstoneExpense'
        const current = expenseTombstoneWinner.get(id)
        if (!current || op.opId.localeCompare(current.opId) > 0) {
          expenseTombstoneWinner.set(id, { opId: op.opId, value })
        }
        break
      }
      case 'tombstoneSettlement':
      case 'restoreSettlement': {
        const id = String(op.payload.settlementId || op.payload.settlement_id || op.payload.id || '')
        if (!id) break
        const value = op.kind === 'tombstoneSettlement'
        const current = settlementTombstoneWinner.get(id)
        if (!current || op.opId.localeCompare(current.opId) > 0) {
          settlementTombstoneWinner.set(id, { opId: op.opId, value })
        }
        break
      }
    }
  }

  // Pass 2: Reconcile tombstones
  for (const [expenseId, winner] of expenseTombstoneWinner.entries()) {
    const existing = expenses.get(expenseId)
    if (!existing) continue // orphan tombstone; ignored until expense lands
    expenses.set(expenseId, { ...existing, isTombstone: winner.value })
  }

  for (const [settlementId, winner] of settlementTombstoneWinner.entries()) {
    const existing = settlements.get(settlementId)
    if (!existing) continue // orphan tombstone; ignored until settlement lands
    settlements.set(settlementId, { ...existing, isTombstone: winner.value })
  }

  // Canonical sorting
  const compareByName = (a: { name: string; id: string }, b: { name: string; id: string }) => {
    const cmp = a.name.localeCompare(b.name)
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id)
  }

  const compareByNewest = (
    a: { createdAtMicros: number; id: string },
    b: { createdAtMicros: number; id: string }
  ) => {
    const diff = b.createdAtMicros - a.createdAtMicros
    return diff !== 0 ? diff : a.id.localeCompare(b.id)
  }

  const peopleOut = Array.from(people.values()).sort(compareByName)
  const groupsOut = Array.from(groups.values()).sort(compareByName)
  const expensesOut = Array.from(expenses.values()).sort(compareByNewest)
  const settlementsOut = Array.from(settlements.values()).sort(compareByNewest)

  return {
    people: peopleOut,
    groups: groupsOut,
    expenses: expensesOut,
    settlements: settlementsOut,
  }
}
