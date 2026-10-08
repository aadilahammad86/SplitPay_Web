# SplitPay Web: Orchestrator Phased Implementation Plan

- Date: 2026-10-08
- Orchestrator: Dynamic Agent System
- Repository: `C:\Users\swalih\SplitPay_Web` (Read-only reference: `C:\Users\swalih\SplitPay`)

## Acceptance Criteria

1. **Financial Invariants (INV-1 - INV-5)**:
   - Money values are integer minor units across the stack. Zero floating-point money.
   - For all splits: `sum(shares) === totalMinor` exactly.
   - Allocation algorithms are 100% deterministic (reproducible seed and tie-breaking).
   - Ledger is strictly append-only (revisions and tombstones, no destructive mutations).
   - Balances are derived from ledger history, never stored as mutable truth.
2. **Offline-First & Durable Persistence (INV-6)**:
   - Any write (expense, settlement, friend, group) persists durably in IndexedDB with its outbox `SyncOp` prior to network transmission.
   - Pending outbox operations survive page refresh, browser restart, and device reboot.
   - Full ledger export/import (JSON) to safeguard against site data eviction.
3. **Synchronization & Real-time Convergence**:
   - Push pending ops; cursor-based pull of ops since watermark.
   - Two-pass skew-proof fold algorithm (`applyOps`) guarantees mathematical convergence across multiple devices regardless of arrival order or clock skew.
   - Idempotent deduplication by stable ULID.
   - Remote notifications via WebSocket prompt background refresh; disconnects recover via cursor.
4. **Security & Authorization**:
   - Client bundle only exposes publishable anon key. Zero service-role secrets.
   - Postgres Row-Level Security (RLS) ensures users can only access ledgers and ops for groups they belong to.
5. **Cross-Platform PWA & User Experience**:
   - Responsive layouts tailored for mobile viewports (<768px) and desktop browsers.
   - Accessible semantics, ARIA roles, keyboard navigation, and `@media (prefers-reduced-motion)`.
   - Installable PWA with offline Service Worker and platform-specific install guidance (Android/Chrome prompt vs iOS Safari Share Sheet).
   - Core features preserved from SplitPay: Dashboard, Friends with Cross-Context Source Chips, Groups with Debt Simplification, 5 Split Modes, Settlements, Statements CSV export, Activity feed, Themes (Light/Dark/AMOLED).

## Phased Plan & Non-Overlapping Ownership

| Task | Owner | Inputs | Write Scope | Depends On | Acceptance Condition |
|---|---|---|---|---|---|
| **T1: Domain Engine** | `domain-engine` | Flutter domain specs, ADRs | `src/domain/**`, `test/domain/**` | None | All financial invariants verified by unit tests |
| **T2: Local Storage** | `local-persistence` | T1 Domain models, ADR 0002 | `src/data/db/**`, `src/data/storage/**`, `test/storage/**` | T1 | IndexedDB transactional outbox + restart recovery verified |
| **T3: Sync & RLS** | `sync-backend` | T1, T2, ADR 0003 | `src/data/sync/**`, `src/supabase/**`, `supabase/**`, `test/sync/**` | T1, T2 | Push/pull, convergence, RLS schema, zero secret leak verified |
| **T4: Web UI & PWA** | `ui-implementation` | T1, T2, T3, ADR 0004 | `src/ui/**`, `src/features/**`, `src/pwa/**`, `public/**`, `src/App.tsx`, `src/main.tsx`, `src/index.css` | T1, T2, T3 | Complete responsive UI, PWA manifest, service worker, offline shell |
| **T5: QA & Release** | `verification-qa` | Integrated app | `test/e2e/**`, `docs/release/**` | T4 | All tests pass, lint passes, build succeeds, preview verified |
