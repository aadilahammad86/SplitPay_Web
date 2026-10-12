# Issue 001: Previously Canceled / Deleted Items Still Showing with Friends

## 1. Problem Description
When a user created and shared an expense or recorded a settlement payment with friends and subsequently canceled or deleted it, the cancellation/deletion did not reflect on the friend's device. The friend continued to see the deleted transactions, and the deleted items still affected the friend's mutual balance.

---

## 2. Root Cause Analysis (Identified Cases)

### Case 1: Settlement Deletion Had No Sync Operation (`deleteSettlement` / `deleteSettlements`)
- **Mechanism:** When a user clicked delete on a settlement payment in `ActivityView`, `store.deleteSettlement(id)` was called. In `ledgerStore.ts`, `deleteSettlement` only called `this.adapter.deleteSettlement(id)`.
- **Root Cause:** No sync operation (`SyncOp`) was created or appended to the outbox queue.
- **Impact:** The deletion existed exclusively in that local device's memory/IndexedDB store. It was never pushed to Supabase. Friends never received any tombstone or deletion notification, leaving the settlement permanently active on the friend's account and distorting mutual balances. Furthermore, on the next full pull from Supabase, the remote `addSettlement` op would re-insert the settlement back into the deleter's own device.

### Case 2: Batch-Local Tombstone Reconciliation in `indexedDbAdapter.ts` and `memoryStorageAdapter.ts`
- **Mechanism:** When remote ops were applied via `adapter.applyRemoteOps(ops)`, the tombstone decision (`tombstoneWinners`) was populated strictly from the current batch parameter `ops[]`.
- **Root Cause:** The adapter never cross-referenced historical ops already persisted in the `ops` store.
- **Impact:**
  1. **AddExpense Overwrites:** If a device already held a tombstone op from a prior sync, and later received or processed an `addExpense` op (such as during alias reconciliation, cursor catch-up, or initial sync), `addExpense` wrote `isTombstone: false` to the store and erased the tombstone state.
  2. **Orphan Tombstones:** If a tombstone op arrived in a pull batch before its corresponding `addExpense` op (due to cursor splits or clock skew), the tombstone was dropped because `expensesStore.get(expId)` returned `undefined`. When the expense arrived in a later batch, it was stored as active (`isTombstone: false`).

### Case 3: Activity Timeline Never Filtered Out Tombstoned Items
- **Mechanism:** In `ActivityView.tsx`, `allItems` mapped over `ledgerState.expenses` and `ledgerState.settlements` without checking `!item.isTombstone`.
- **Root Cause:** Even if an item was successfully tombstoned (`isTombstone: true`), `ActivityView` continued to render it directly in the timeline (merely applying a strikethrough styling and lower opacity).
- **Impact:** To friends viewing the Activity feed, all canceled and deleted transactions remained permanently visible in the main timeline.

### Case 4: Settlement Domain Entity Lacked Tombstone Flag
- **Mechanism:** The `Settlement` entity in `entities.ts` had no `isTombstone` property, and `breakdownFor` in `balance.ts` only checked `if (e.isTombstone) continue` for expenses, not settlements.
- **Root Cause:** Settlements were treated as immutable additions without soft-deletion tracking in the balance engine.
- **Impact:** Even if a settlement record was updated, the balance engine had no way to ignore tombstoned settlements, leading to balance discrepancies between friends.

### Case 5: Missing Resilient ID Lookup in Tombstone Payloads
- **Mechanism:** Tombstone handlers strictly read `op.payload.expenseId` or `op.payload.settlementId`.
- **Root Cause:** If an incoming op payload used `id` or `expense_id`, `String(op.payload.expenseId)` evaluated to `"undefined"`.
- **Impact:** The tombstone was silently ignored and never matched the target record.

---

## 3. Implemented Fixes

1. **CRDT Settlement Tombstoning:**
   - Extended `OpKind` in `syncOp.ts` with `'tombstoneSettlement'` and `'restoreSettlement'`.
   - Added `isTombstone?: boolean` to `Settlement` in `entities.ts`, `encodeSettlement`, and `decodeSettlement`.
   - Added `opSetSettlementTombstone({ opId, deviceId, atMicros, settlementId, tombstoned })` in `syncOp.ts`.
   - Updated `deleteSettlement`, `restoreSettlement`, `deleteSettlements`, and `clearExpensesAndSettlements` in `ledgerStore.ts` to enqueue `opSetSettlementTombstone` into the transactional outbox and trigger automated cloud sync.

2. **Full-History Skew-Proof Tombstone Reconciliation:**
   - Updated `indexedDbAdapter.ts` and `memoryStorageAdapter.ts` `applyRemoteOps()` to inspect ALL historical ops in the `ops` table (`opsStore.getAll()`).
   - The winning decision (highest `opId` among creation, tombstone, and restore ops) is calculated across all records.
   - Any touched or existing expense or settlement is reconciled against its winning decision, preventing orphan tombstones and preventing `addExpense` or `addSettlement` from ever resurrecting deleted items.
   - Implemented resilient payload ID parsing: `op.payload.expenseId || op.payload.expense_id || op.payload.id`.

3. **Balance Engine Enforcement:**
   - Updated `breakdownFor()` in `balance.ts` with `if (st.isTombstone) continue`, guaranteeing that deleted settlements immediately stop affecting mutual debt calculations.

4. **Activity View Timeline Filtering & Toggle:**
   - In `ActivityView.tsx`, deleted/canceled transactions (`item.isTombstone`) are hidden by default from the activity feed for both users and friends.
   - Added a `Deleted (X)` toggle button in the activity toolbar that allows users to inspect deleted transactions and restore them if needed (`Restore` button for both expenses and settlements).
   - In `DashboardView.tsx` and `FriendsView.tsx`, filtered out `!s.isTombstone` settlements from recent transactions and mutual timelines.

---

## 4. Verification Evidence
- **Automated Tests:**
  - `test/sync/sync.test.ts`: Added cross-device expense deletion convergence test (`both sync -> balance returns to 0`).
  - `test/sync/sync.test.ts`: Added cross-device settlement deletion convergence test (`both sync -> balance reverts`).
  - `test/sync/sync.test.ts`: Added out-of-order orphan tombstone test (`tombstone arrives before expense -> expense remains tombstoned`).
  - `test/storage/storage.test.ts`: Verified local IndexedDB and MemoryStorageAdapter tombstoning and outbox persistence.
  - Full suite passed: **10 test files passed, 105/105 tests passed**.
- **Linter:** `oxlint` passed with **0 errors, 0 warnings**.
- **Build:** `tsc -b && vite build` built production bundle with **0 type errors**.
