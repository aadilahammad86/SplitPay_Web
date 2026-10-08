# Execution Workflow

## 1. Intake

The Orchestrator records:

- the objective and why it matters;
- target users, browsers, and environments;
- acceptance criteria that can be observed;
- constraints, relevant repository instructions, and current state;
- assumptions and unresolved decisions;
- whether the request is planning, implementation, verification, or release.

If useful work can proceed independently of an open question, continue that work
while surfacing the question. Do not make an irreversible or user-owned decision
by assumption.

## 2. Decomposition and team selection

Break the objective into deliverables with a single accountable owner each.
Represent dependencies explicitly. Select the smallest set of dynamically
instantiated roles that covers the work and risk. Include independent security
or verification review when the scope warrants it. Keep tasks small enough for
the owner to understand the relevant context and return verifiable evidence.

Before execution, publish a plan containing:

| Field | Required content |
|---|---|
| Task | Bounded outcome |
| Owner | One dynamic agent role or Orchestrator |
| Inputs | Context and upstream artifacts |
| Files/resources | Read and write allow-lists |
| Depends on | Preceding task identifiers |
| Acceptance | Observable completion conditions |
| Verification | Evidence or checks required |

Respect repository-specific confirmation gates, ownership maps, and approval
requirements. If a required gate says to stop for confirmation, do not dispatch
dependent work until that confirmation arrives.

## 3. Dispatch

Dispatch only tasks whose prerequisites are complete. Include the full role
contract from `agents.md`, exact deliverable, allowed files, acceptance criteria,
verification request, and reporting format. Do not provide unrelated task
history or ambiguous instructions.

Independent read-only research may run in parallel. Mutations run in parallel
only when write scopes are disjoint and shared dependencies are settled.

## 4. Execution and coordination

The Orchestrator tracks task status and dependency changes. It checks progress at
meaningful milestones, not through repeated no-change polling. When a new fact
invalidates the plan, pause affected tasks, update dependencies, and notify each
affected owner.

If a task fails or becomes blocked:

1. Record the exact failure and evidence.
2. Determine whether a bounded retry, a new specialist role, or a revised plan
   can resolve it safely.
3. Preserve completed work and avoid duplicating active ownership.
4. Escalate to the user when the blocker requires a product decision, external
   access, credentials, payment, or approval.

## 5. Integration and conflict handling

The Orchestrator reviews every deliverable against its acceptance criteria and
the whole objective. It checks for overlapping edits, inconsistent data models,
conflicting assumptions, and missed downstream work. Resolve disagreements in
this order:

1. Explicit user instruction and accepted decisions.
2. Applicable repository invariants and ownership rules.
3. Verified project behavior and authoritative documentation.
4. The architecture and workflow defined in this folder.
5. A clearly labeled recommendation where evidence does not settle the choice.

Do not silently discard a specialist finding. Record the resolution and reason
in the plan or final report when it changes scope or risk.

## 6. Verification

Verification must match the change. Run relevant checks in the target
environment and include their actual output or a concise evidence record. Never
claim a command, browser, device, migration, or end-to-end path was checked if it
was not.

For web ledger and sync work, the acceptance plan should cover as applicable:

- offline create/edit and immediate local read-back;
- queued writes surviving reload and browser restart;
- reconnect-triggered upload and cursor-based download;
- duplicate delivery and retry without duplicate ledger effects;
- concurrent changes on two users/devices converging to the same result;
- RLS denial for a non-member and safe browser credential handling;
- integer minor-unit arithmetic and exact split totals;
- actual install/open behavior on iOS Safari, Android, and desktop browsers;
- browser storage failure, eviction, or unavailable-offline behavior.

Repository-required verification gates remain in force for any code changes.
Planning-only tasks report decisions and assumptions without pretending to have
verified implementation behavior.

## 7. Completion and report

The objective is complete only when all required tasks are complete, integrated,
and verified to the agreed level. The Orchestrator reports:

- what was delivered and where;
- how the result meets the acceptance criteria;
- which checks ran and their outcomes;
- decisions made and evidence used;
- open risks, unverified assumptions, and work not done.

If any required task remains blocked or incomplete, report the overall outcome
as partial and name the exact reason. Do not hide a scope reduction behind a
successful subtask.

## 8. Web app release boundary

Implementation, test deployment, and public production deployment are separate
tasks. A test deployment must use an agreed test environment and avoid real user
data unless explicitly approved. Production release requires an explicit
deployment task, a verified rollback or recovery path, and the relevant human
authorization. The dynamic agent system must never infer permission to publish
from a request to implement or test.
