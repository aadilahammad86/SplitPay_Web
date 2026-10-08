# ADR 0002: Browser-Native Persistence via IndexedDB Adapter

- Status: Accepted
- Date: 2026-10-08

## Context

The Flutter mobile implementation used native SQLite with custom DAOs. On the web platform, native SQLite is unavailable. While SQLite compiled to WebAssembly with Origin Private File System (OPFS) exists, it requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` HTTP headers which interfere with cross-origin embeds, OAuth popups/redirects, and have restricted support across older mobile Safari releases.

In contrast, IndexedDB is standard and supported across modern browsers (iOS Safari, Android Chrome, Edge, Firefox, and desktop Safari/Chrome).

## Decision

1. Encapsulate local persistence behind an abstract `StorageAdapter` interface to preserve architectural boundaries (`domain` does not import `IndexedDB`).
2. Implement `IndexedDbStorageAdapter` as the primary browser store with object stores:
   - `people`: profile and contacts (`id` primary key)
   - `groups`: groups and member lists (`id` primary key)
   - `expenses`: expense headers (`id` primary key)
   - `expense_shares`: share slices (`id` primary key, indexed by `expense_id`, `group_id`, `[owed_by, owed_to]`)
   - `settlements`: settlement payments (`id` primary key)
   - `ops`: sync outbox log (`op_id` primary key, indexed by `synced` and `created_at_micros`)
   - `meta`: local configuration (`key` primary key, e.g. `local_person_id`, `device_id`, `sync_watermark`)
3. Guarantee atomic mutations: each local write writes the entity record and its corresponding outbox `SyncOp` inside a single IndexedDB transaction (`readwrite` over target store + `ops`).
4. Provide an in-memory `MemoryStorageAdapter` for automated unit and property testing without DOM/browser dependencies.
5. Request persistent storage via `navigator.storage.persist()` where available to prevent eviction under browser disk pressure.
6. Provide complete JSON backup/export and restore functionality in the application settings to protect against user-cleared browser cookies/site data.

## Consequences

- Zero reliance on native binaries or complex WASM/COEP infrastructure.
- High performance asynchronous read/write operations.
- Offline resilience: changes are committed to device storage prior to UI resolution and network synchronization.
- Testability: Pure domain logic can be validated with in-memory adapters and simulated multi-device environments.
