# SplitPay Web — Codebase Map

## Stack & Versions
- **Core**: React `^19.2.8`, React DOM `^19.2.8`, TypeScript `~6.0.2`.
- **Styling & UI**: Tailwind CSS `^4.3.3` (`@tailwindcss/vite: ^4.3.3`), Majesticons `^2.1.3`.
- **Backend & Data**: `@supabase/supabase-js: ^2.117.3`, `fake-indexeddb: ^6.2.5` (test storage).
- **Tooling & Test**: Vite `^8.3.0` (`@vitejs/plugin-react: ^6.1.1`), Oxlint `^1.81.0`, Vitest `^5.0.3`, Playwright `^1.64.0`, Wrangler `^4.149.0`.
- **Build & Deploy**: Vite builds client SPA to `dist/` with chunk splitting (`vendor-supabase`, `vendor-react` in `vite.config.ts`). Cloudflare Workers hosts `dist/` as SPA (`wrangler.jsonc:assets`).
- **PWA**: `public/manifest.webmanifest`, `public/sw.js` (cache-first static assets, network-first shell). Registered via `index.html` in production; auto-unregistered on localhost/dev.

## Commands
- `npm run dev`: Start Vite dev server on `http://localhost:5173`.
- `npm run build`: Typecheck (`tsc -b`) and production bundle (`vite build`) to `dist/`.
- `npm run lint`: Fast linting across project via `oxlint`.
- `npm run test`: Run unit and domain test suite via `vitest run`.
- `npx tsc -b`: Run TypeScript compiler typecheck across project references.
- `npm run test:e2e`: Run browser end-to-end suite via Playwright (`node test/e2e.browser.mjs`).
- `npm run preview`: Locally preview production build via `vite preview`.
- `npm run deploy`: Run build and deploy to Cloudflare Workers (`wrangler deploy`).

## Folder Map (src/)
- `src/assets`: Static visual assets (SVG icons, hero images).
- `src/data`: Local persistence adapters (`IndexedDbStorageAdapter`, `MemoryStorageAdapter`) and sync engine.
- `src/domain`: Zero-dependency business logic: money units, balances, split algorithms, and sync operations.
- `src/features`: Feature views, modals, and controllers organized by functional domain.
- `src/pwa`: PWA installation lifecycle manager and OS-specific installation modal.
- `src/services`: Integrations for authentication, email OTP, SMS/WhatsApp notifications, and contacts.
- `src/supabase`: Supabase client initialization, configuration validation, and channel cleanup.
- `src/ui`: Reusable UI components, design tokens, icons, and React context providers.

## Routing
- **Router**: None (custom React state-based tab routing in `src/App.tsx:AppContent`).
- **State**: `currentTab` (`useState<string>`), defaults to `'dashboard'` or `'admin'` via `#admin`/`?admin=1`.
- **Routes & Views**:
  - `dashboard` -> `src/features/dashboard/DashboardView.tsx` (Balances, owed cards, recent transactions)
  - `friends` -> `src/features/friends/FriendsView.tsx` (Friends directory, 1:1 net balances, profile editor)
  - `groups` -> `src/features/groups/GroupsView.tsx` (Group cards, category filters, member management)
  - `activity` -> `src/features/activity/ActivityView.tsx` (Audit log of expenses, settlements, and changes)
  - `statements` -> `src/features/statements/StatementsView.tsx` (Exportable chronological debt statement)
  - `settings` -> `src/features/settings/SettingsView.tsx` (Currency selection, Supabase sync config, data backup)
  - `admin` -> `src/features/admin/SuperAdminView.tsx` (Cloud profiles inspection and DB maintenance)
  - `auth` gate -> `src/features/auth/AuthScreen.tsx` (Rendered when `!session && currentTab !== 'admin'`)

## State & Data Flow
- **Local State**: Managed in `src/data/storage/ledgerStore.ts:LedgerStore`, subscribed via `src/ui/storeContext.tsx:StoreProvider` using React 19 `useSyncExternalStore`.
- **Persistence**: IndexedDB (`src/data/storage/indexedDbAdapter.ts`) with stores: `people`, `groups`, `expenses`, `expense_shares`, `settlements`, `ops`, and `metadata`.
- **Supabase Client**: `src/supabase/supabaseClient.ts:getSupabaseClient`. Connects with publishable anon key; `validatePublishableKey` forbids `service_role` keys.
- **Database Tables**: `public.ledgers`, `public.ledger_members`, `public.ops`, `public.profiles`, `public.auth_otps` (`supabase/schema.sql`).
- **Sync & Offline**: Local writes save first to IndexedDB and append an immutable `SyncOp`. `src/data/sync/syncEngine.ts:SyncEngine` pushes unsynced ops to `public.ops` (`INSERT ... ON CONFLICT (op_id) DO NOTHING`) and pulls ops newer than watermark `op_id`. Ops fold deterministically using `src/domain/syncOp.ts:applyOps`.

## Domain Logic
- **Money Handling**: `src/domain/money.ts:Money` stores amounts strictly as integer minor units (`minor: number`). Rejects non-integers.
- **Currencies & Format**: `src/domain/money.ts:Currencies` (INR '₹', USD '$', EUR '€', GBP '£', AED 'AED', JPY '¥', KWD 'KD'). Format via `src/domain/money.ts:Money.formatted` using `Intl.NumberFormat`.
- **Debt Simplification**: `src/domain/splitEngine.ts:simplifyDebts` implements greedy min-cash-flow algorithm; guarantees <= n - 1 transactions. Net balances must sum to zero.
- **Balance Calculation**: `src/domain/balance.ts:breakdownFor` calculates direct and group slices; `src/domain/balance.ts:groupNets` computes group-level nets; `src/domain/balance.ts:calculateOverallBalance` aggregates total net balance.
- **Split Allocation**: `src/domain/splitEngine.ts:allocateByWeight` uses largest-remainder (Hamilton-Hare) method for exact minor-unit conservation across shares. Modes: `splitEqual`, `splitByShares`, `splitByPercentage`, `splitExact`, `splitByAdjustment`.
- **Settlement Recording**: `src/data/storage/ledgerStore.ts:addSettlement` and `src/domain/syncOp.ts:opAddSettlement` record debt settlement between two members.

## Key Components
- `src/ui/components/Navbar.tsx`: Header bar with ledger title, sync indicator, search, and action triggers.
- `src/ui/components/Sidebar.tsx`: Desktop drawer navigation linking to all primary views and sync status modal.
- `src/ui/components/BottomNav.tsx`: Mobile navigation bar switching between primary views.
- `src/ui/components/MoneyDisplay.tsx`: Color-coded (owed vs owing) minor-unit currency renderer with accessible spoken text.
- `src/ui/components/Modal.tsx`: Accessible dialog container with backdrop, header, and keyboard dismissal.
- `src/ui/components/Icon.tsx`: SVG icon renderer consuming majesticons sprite sheets.
- `src/ui/components/Select.tsx`: Accessible themed custom dropdown select component.
- `src/ui/components/NotificationToast.tsx`: Toast notifications listener rendering alerts from `NotificationService`.
- `src/ui/components/ErrorBoundary.tsx`: Top-level crash boundary with reload and service worker cache clearing.
- `src/ui/components/SourceChips.tsx`: Visual chips indicating whether a balance originates directly or from a group.
- `src/features/expense/ExpenseEditorModal.tsx`: Modal for creating and editing split expenses across split modes.
- `src/features/settle/SettleUpModal.tsx`: Modal for recording settlements/payments between members or groups.
- `src/features/sync/SyncStatusModal.tsx`: Real-time sync diagnostic modal with pending ops outbox and force-sync control.
- `src/pwa/InstallModal.tsx`: Platform-aware PWA install guidance for iOS Safari and Chromium browsers.
- `src/features/auth/AuthScreen.tsx`: Authentication screen supporting email/phone input and OTP verification.

## Conventions
- **Naming & Layout**: PascalCase for React components (`*.tsx`), camelCase for helpers (`*.ts`). Full-screen tabs end in `View.tsx`, dialogs end in `Modal.tsx`.
- **TypeScript Imports**: `verbatimModuleSyntax` and `allowImportingTsExtensions` enabled; explicit `.ts` / `.tsx` extension required on imports.
- **Domain Purity**: Code in `src/domain/` is pure TypeScript; never imports React, browser DOM, IndexedDB, or Supabase.
- **Identifiers**: Monotonic 26-character Base32 ULIDs generated via `src/domain/ulid.ts:generateUlid` for all entities and operations.
- **Error Handling**: Custom typed errors (`ValidationFailure`, `TypeError`). Sync errors update `SyncEngineState.error` without throwing unhandled exceptions.

## Gotchas & Do-Not-Touch
- **No Floating Point Money**: Never use `Math.round(float)` or floating arithmetic for balances. All amounts must remain integer minor units (paise/cents).
- **Append-Only Ledger**: Deletions are soft tombstones (`isTombstone = true`, `SyncOp:tombstoneExpense`). Hard deletion breaks multi-device convergence.
- **Supabase Service Key**: Never use or expose `service_role` keys in browser code. `validatePublishableKey` aborts immediately if detected.
- **Two-Pass Sync Fold**: In `src/domain/syncOp.ts:applyOps`, entities must resolve in pass 1 and tombstones in pass 2 using highest `op_id` to prevent split-brain states.
- **ULID Monotonicity**: Do not substitute `generateUlid` with random UUIDs; sync ordering relies on lexicographically sortable identifiers.
