# ADR 0001: Browser-first web stack

- Status: accepted for the initial scaffold; implementation details remain open
- Date: 2026-10-08

## Context

Two people need to use SplitPay from Windows, Mac, Android, and iPhone browsers, including when offline. The Android Flutter app currently uses native SQLite and is not a browser-ready client. The web distribution must not require a Mac or Apple Developer Program membership.

## Decision

Start the web project with Vite, React, and TypeScript. Build toward a static, installable Progressive Web App. Put local persistence behind an adapter, with IndexedDB as the default browser-storage candidate. Use Supabase Auth, Postgres with Row Level Security, and Realtime notifications as the planned hosted sync path. Treat notifications as prompts to pull missing operations, not as the durable ledger transport.

## Consequences

- A static web deployment can serve desktop and mobile browsers from one origin.
- PWA install prompts and background behavior vary by browser; correctness must not depend on background execution.
- Local operations and a durable outbox must survive reloads; browser storage eviction and user-cleared data need explicit UX and recovery planning.
- The existing native SQLite implementation cannot be assumed to compile for web; domain rules and data formats need a deliberate reuse assessment.
- Authentication, shared-ledger membership, RLS policies, schema, offline queue, and conflict/convergence behavior require separate implementation and security review.

## Alternatives considered

- Extend the existing Flutter app directly to web: not selected for the initial web client because the current app is Android-only and uses a native SQLite package. Reconsider only after validating browser support for its storage stack and plugins.
- Use a server-rendered framework: not selected initially because the first version is a client-side ledger PWA and does not currently require server rendering.

## Verification required before release

Validate installation and offline behavior on iOS Safari, Android browsers, and desktop browsers. Exercise offline writes, browser restarts, reconnect sync, duplicate operation delivery, concurrent edits, and RLS denial for non-members.