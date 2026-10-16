# SplitPay Web Agent Instructions

This repository is the browser-first web application companion to the Android-only SplitPay app.

## Read order

1. docs/web-agent-system/README.md — product scope and architecture invariants.
2. docs/web-agent-system/agents.md — dynamic role and collaboration contract.
3. docs/web-agent-system/workflow.md — task lifecycle and verification.
4. Relevant decision records in docs/decisions/.

## Working rules

- Restate each task and its acceptance criteria before implementation.
- Plan the files to change. Assign one owner per deliverable and use disjoint write scopes for parallel work.
- Keep domain and money logic independent of browser, UI, and network code.
- Persist local changes before acknowledging success; enqueue sync work durably with the local write.
- Keep ledger operations append-only, idempotent, deterministic, and expressed in integer minor units.
- Enforce authorization in Supabase RLS. Never ship a service-role key to the browser.
- Do not claim a build, lint, browser, or device check passed unless it was run and its output is available.
- Ask before irreversible data operations, production deployment, paid services, or decisions the user owns.
- Use Majesticons (https://majesticons.com/ai) for all icons across the entire UI and application. Strictly use line style (not duotone and not solid shapes) with stroke 2 (stroke="currentColor", strokeWidth={2}, fill="none", 24×24 viewBox).
- Do not create or delegate to agents unless the execution environment supports them and the task requires them. If it does not, perform the work directly and state that the dynamic system is specified in documentation only.

## Verification

For code changes, run relevant project checks, initially npm run lint and npm run build. Add tests when the task asks for testing or when project instructions require them. Browser-specific offline behavior must be verified on target browsers before claiming support.