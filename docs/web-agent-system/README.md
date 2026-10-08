# SplitPay Web App and Dynamic Agent System

Status: **planning configuration**. These documents define a proposed operating
model for a browser-installable web version of SplitPay. They do not implement
the web app, create agents, provision services, or change the current Android
application.

## Documents

| File | Defines |
|---|---|
| `README.md` | Product scope, architecture boundaries, and invariants |
| `agents.md` | Dynamic agent creation, role contracts, collaboration, and orchestration |
| `workflow.md` | Task lifecycle, execution controls, verification, and completion |

## Product objective

Provide a responsive, installable web application that the two testers can use
from Windows, Mac, Android, and iPhone browsers. The app must save changes
locally first, remain useful offline, and synchronize shared ledger changes
through a hosted service when a connection is available. The web distribution
path must not depend on Apple Developer Program membership or a Mac.

## Proposed architecture

1. **Presentation:** responsive browser UI, installable as a Progressive Web
   App (PWA) where the browser supports installation.
2. **Application:** use cases for ledger entry, account/group membership, local
   persistence, and synchronization.
3. **Domain:** pure deterministic ledger and balance rules, independent of
   browser and network APIs.
4. **Local data:** browser-compatible persistent storage. IndexedDB is the
   default candidate; select and validate the concrete adapter before
   implementation. Local writes and their durable outbox record are one
   logical transaction.
5. **Remote data:** Supabase Postgres with Row-Level Security (RLS), authenticated
   membership checks, an idempotent operation log, and Realtime notifications
   to accelerate incoming updates. Notifications are hints; a cursor-based
   pull remains the recovery mechanism.
6. **Hosting:** static web hosting with HTTPS and a configurable application
   origin. A production host and its limits are selected during deployment
   planning.

The current Flutter/SQLite app is not a ready-made browser client. Before
implementation, assess what domain logic and ledger formats can be reused, and
design a browser-compatible persistence adapter. Do not assume native SQLite,
Flutter plugins, background execution, or identical browser behavior is
available on every target.

## Product invariants

- A user action is acknowledged only after durable local persistence succeeds.
- Network loss never blocks local ledger entry or local balance display.
- Pending operations survive page reloads, browser restarts, and device
  restarts, subject to browser storage remaining available.
- Reconnection, app/page resume, and explicit refresh trigger synchronization;
  a Realtime event may trigger an earlier pull.
- Sync is safe to retry and deduplicates operations by stable client-generated
  identifiers.
- Ledger entries are append-only. Corrections are new revisions or tombstones;
  balances are derived from the ledger.
- Money is stored as integer minor units. A split must sum exactly to its total.
- The same operation set produces the same ledger and balances on every device.
- Server authorization is enforced with RLS. Client-side filtering is not
  authorization.
- Never put service-role secrets in browser code. Browser credentials are
  publishable/anonymous credentials protected by RLS.
- Do not upload contact books or unrelated personal data.
- Web UI uses accessible semantics, keyboard support, responsive layouts, and
  localized user-facing text.

## Offline and cross-browser behavior

“Persistent” means saved to browser-managed local storage, not guaranteed
against user-cleared site data, browser eviction, or device loss. The app must
surface storage failures and pending sync state clearly. Provide an export or
recovery plan before treating browser storage as the only copy of user data.

Background sync is opportunistic and differs by browser, especially on iOS.
The correctness guarantee is eventual sync when the app runs with connectivity,
not an unconditional promise that a closed browser will sync in the background.
Test on actual Safari/iOS, Chrome/Android, and desktop browsers.

## Scope boundary

These files are foundational instructions for planning and implementing the web
version. They do not certify current browser support, choose a specific
frontend framework, create a Supabase project, define final RLS SQL, or authorize
production deployment. Those decisions require scoped tasks and verification.

## Source-of-truth order

1. User's current objective and explicit constraints.
2. Repository `AGENTS.md` and `context.md` invariants where applicable.
3. This web-app configuration set for web-specific architecture and execution.
4. Task-specific plans and accepted decisions.

If an existing Android-only rule conflicts with an explicit web-app objective,
the orchestrator records the conflict and proposes a web-specific amendment;
agents must not silently reinterpret either instruction set.
