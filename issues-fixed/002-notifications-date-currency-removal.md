# Issue 002: Notification Support, Expense Date Selection, Global Default Currency, and Cancel vs Permanent Remove

## 1. Problem Description & Requirements
The user requested four core enhancements across SplitPay Web:
1. **Notification Support:** Real-time web and in-app notification support when incoming sync updates or collaborator activities land.
2. **Expense Date Selection:** Date picker option for adding and editing expenses (defaulting to today's date or existing transaction date, stored as `createdAtMicros`).
3. **Global Default Currency Setting:** Ability to select default currency in Settings (INR, AED, USD, EUR, GBP) that dynamically applies across all screens where currency is needed.
4. **Cancel vs Permanent Remove Distinction:** Differentiate between marking an entry as "Cancelled" (CRDT tombstoning with audit trail and restore capability) versus "Permanent Remove / Delete" (complete purge from local storage and read-models). Provide an Edit Expense flow directly in the activity view.

---

## 2. Root Cause Analysis & Architecture Challenges

### Case 1: Lack of Proactive User Alerts for Background Sync Operations
- **Symptom:** When collaborators or synced devices pushed changes (new expenses, payments, friend joins), local storage updated silently without notifying the user.
- **Root Cause:** No notification subsystem existed. Neither Web Notification API nor an in-app toast emitter was implemented.

### Case 2: Inability to Backdate or Correct Expense Dates
- **Symptom:** Expenses were always stamped with `Date.now() * 1000` (`createdAtMicros`). Users recording past expenses (e.g. from yesterday or last week) had no way to set the actual date of the transaction.
- **Root Cause:** `ExpenseEditorModal` lacked a date input, and `store.addExpense` did not accept an optional custom `createdAtMicros`.

### Case 3: Hardcoded Base Currency Across Views
- **Symptom:** Dashboard, Statements, Friends, Groups, and Activity views fell back to hardcoded `BASE_CURRENCY` (INR `₹`) regardless of user preferences (such as users transacting in AED, USD, EUR, or GBP).
- **Root Cause:** Currency preference was not modeled in `LedgerState` or persisted in `StorageAdapter` metadata, and UI components imported `BASE_CURRENCY` directly.

### Case 4: Ambiguity Between Cancellation and Deletion
- **Symptom:** Users wanted a clear distinction between "marking an entry as cancelled" (audit-friendly, recoverable) and "deleting/removing the entry completely" (purging it from storage so it does not persist).
- **Root Cause:** Previously, deleting meant tombstoning, and there was no way to hard-delete an entry once created, nor was there an edit modal to modify existing expense amounts, dates, descriptions, or categories.

---

## 3. Implemented Solutions

### 1. Real-Time Notification System (`src/services/notifications/notificationService.ts`)
- **NotificationService:** Built a singleton service supporting:
  - System browser notifications via `window.Notification` with permission management (`requestPermission()`).
  - In-app toast notification queue with subscriber callbacks (`subscribe()`, `notify()`).
  - Settings toggle (`splitpay_notifications_enabled` in `localStorage`).
  - Remote operation parser `notifyRemoteOps(ops, localDeviceId)`: Automatically alerts when remote collaborators add expenses (`New Expense Added`), record settlements (`Settlement Payment Received`), cancel items (`Expense Cancelled`), or connect as friends (`Friend Connected`).
- **Notification Toast Component (`src/ui/components/NotificationToast.tsx`):**
  - Floating toast UI at the top-right with icon indicators (success, warning, info, error), dismiss buttons, and auto-dismiss timer (4000ms).
  - Mounted globally in `src/App.tsx`.
- **Sync Engine Integration:** Wired `notifyRemoteOps` directly into `SyncEngine.applyRemoteBatch()` in `src/data/sync/syncEngine.ts`.

### 2. Expense Date Selection & Editing Flow
- **Keyed Form Architecture:** Refactored `ExpenseEditorModal.tsx` into a robust `ExpenseEditorForm` component to eliminate reactive state glitches during edits.
- **Date Picker:** Added an `<input type="date">` field defaulting to today's date (`YYYY-MM-DD`), converting to `createdAtMicros` on submit.
- **Editing Existing Expenses:** Added `expenseToEdit` prop to `ExpenseEditorModal` and implemented `store.updateExpense(...)` in `ledgerStore.ts`. In `ActivityView.tsx`, expenses now feature an "Edit" button that pre-populates all expense fields (description, amount, currency, category, date, payer, and split shares).

### 3. Global Default Currency Propagation
- **Domain & State Model:**
  - Added `defaultCurrency: CurrencyCode` to `LedgerState`.
  - Added `setDefaultCurrency(currency: CurrencyCode)` in `LedgerStore`, persisted to storage adapter metadata `'default_currency'`.
- **Settings Screen:**
  - Added an interactive "Default Currency" selector grid in `SettingsView.tsx` with quick selection cards for INR (₹), AED (AED), USD ($), EUR (€), and GBP (£).
  - Added a "Real-Time Notifications & Alerts" card in Settings with permission request buttons and active status badges.
- **Multi-Screen Dynamic Propagation:**
  - Updated `DashboardView.tsx`, `FriendsView.tsx`, `ExpenseEditorModal.tsx`, `SettleUpModal.tsx`, `StatementsView.tsx`, `CreateGroupModal.tsx`, and `SourceChips.tsx` to read `ledgerState.defaultCurrency`.

### 4. Cancel vs Permanent Remove Distinction
- **Cancel (Tombstone):**
  - Marks the expense or settlement as tombstoned (`isTombstone = true`).
  - Retains audit history in the CRDT outbox for collaborative replication.
  - Can be inspected in the "Deleted (X)" tab and restored at any time.
- **Delete / Permanent Remove (Hard Purge):**
  - Added `deleteExpense(expenseId)` to `StorageAdapter`, `IndexedDbStorageAdapter`, and `MemoryStorageAdapter`.
  - Added `permanentRemoveExpense`, `permanentRemoveSettlement`, `permanentRemoveExpenses`, and `permanentRemoveSettlements` to `LedgerStore`.
  - In `ActivityView.tsx`, each item displays separate "Cancel" and "Delete" buttons with destructive confirmation modals.
  - Batch action toolbar provides both "Cancel Selected" and "Delete Permanently".

---

## 4. Verification Evidence

### 1. Test Suite Execution (`npm test -- --run`)
```
 RUN  v5.0.3 C:/Users/swalih/SplitPay_Web

 ✓ test/domain/otp.test.ts (8 tests) 8ms
 ✓ test/services/adminAuth.test.ts (7 tests) 5ms
 ✓ test/domain/phone.test.ts (7 tests) 4ms
 ✓ test/domain/domain.test.ts (18 tests) 30ms
 ✓ test/services/contactMatching.test.ts (11 tests) 6ms
 ✓ test/services/auth.test.ts (8 tests) 12ms
 ✓ test/features/currencyAndDateNotifications.test.ts (12 tests) 16ms
 ✓ test/storage/storage.test.ts (13 tests) 34ms
 ✓ test/sync/sync.test.ts (11 tests) 20ms
 ✓ test/features/invite.test.tsx (2 tests) 7ms
 ✓ test/renderApp.test.tsx (20 tests) 44ms

 Test Files  11 passed (11)
      Tests  117 passed (117)
   Start at  15:48:02
   Duration  1.50s (import 53%, transform 40%, tests 4%, worker 3%)
```

### 2. Static Analysis & Linting (`npm run lint`)
```
> splitpay-web@0.0.0 lint
> oxlint

Found 0 warnings and 0 errors.
Finished in 61ms on 80 files with 116 rules using 28 threads.
```

### 3. Production Build Compilation (`npm run build`)
```
> splitpay-web@0.0.0 build
> tsc -b && vite build

vite v8.3.3 building client environment for production...
transforming...
✓ 119 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                             2.45 kB │ gzip:  0.97 kB
dist/assets/index-CJ7toPe8.css             56.27 kB │ gzip: 10.44 kB
dist/assets/rolldown-runtime-CbXtAM7H.js    0.58 kB │ gzip:  0.36 kB
dist/assets/vendor-supabase-1yby8ldT.js   214.04 kB │ gzip: 55.06 kB
dist/assets/vendor-react-BPWasKn7.js      218.76 kB │ gzip: 68.27 kB
dist/assets/index-mGtRDYv-.js             348.13 kB │ gzip: 71.12 kB

✓ built in 462ms
```
