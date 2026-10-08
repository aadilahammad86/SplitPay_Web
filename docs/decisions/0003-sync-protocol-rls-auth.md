# ADR 0003: Synchronization Protocol, Row-Level Security, and Authentication

- Status: Accepted
- Date: 2026-10-08

## Context

SplitPay requires multi-user collaboration: two or more users on separate networks (cellular or Wi-Fi) must be able to share expenses, settlements, and balances. The system must operate offline-first without losing edits, handle reconnects seamlessly, and converge deterministically on every device.

## Decision

1. **Client-Generated Identifiers**:
   All entities and synchronization operations use sortable, collision-resistant ULIDs (26-character Crockford Base32 encoding timestamps + randomness). No sequential server IDs are used.
2. **Push-Pull Synchronization Model**:
   - Push: Unsynced local operations (`synced = false` in `ops` store) are batched and pushed to the remote store via an idempotent upsert (`INSERT ... ON CONFLICT (op_id) DO NOTHING`). Upon remote acknowledgement, local ops are marked `synced = true`.
   - Pull: The client fetches remote ops with `op_id > watermark`.
   - Apply: Remote operations are deduplicated by `op_id`, chronologically ordered, and folded using the two-pass skew-proof `applyOps` algorithm (expenses and entities first, followed by tombstone resolutions based on highest `op_id`).
3. **Realtime as Acceleration, Cursor as Source of Truth**:
   Supabase Realtime channel broadcasts new ops to connected peers to trigger an immediate pull. If a connection drops, WebSocket reconnects, or background suspension occurs, the cursor-based pull watermark automatically fetches all intervening operations.
4. **Authorization and Row-Level Security (RLS)**:
   - Ledgers and groups have explicit membership tables (`ledger_members`).
   - Every sync operation references a `ledger_id`.
   - Remote queries and writes enforce Postgres RLS: a user can only select or insert operations for ledgers of which they are an active member (`auth.uid() IN (SELECT user_id FROM ledger_members WHERE ledger_id = ops.ledger_id)`).
5. **Zero Service-Role Exposure**:
   The web application bundle only ever contains the publishable `anon` key. Privileged `service_role` keys are strictly prohibited in frontend client assets.
6. **Graceful Offline & Self-Contained Mode**:
   When no remote Supabase instance is configured, the web app operates fully as a local-first PWA with all features active. Users can configure or connect a Supabase project at any time via Settings, or export/import full ledger state.

## Consequences

- Mathematical convergence: Any devices that observe the same set of operations compute the exact same balances, regardless of delivery order.
- Security: Non-members are rejected at the database level by RLS.
- Fault tolerance: Intermittent network drops, duplicate HTTP requests, or out-of-order deliveries cause zero data divergence.
