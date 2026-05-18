# 017 Implementation Discovery Protocol

## Purpose

Define discovery-first implementation order.

## Scope

Preflight, graph/docs evidence, specs, acceptance, ADRs, implementation, validation, retrospective.

## Non-Goals

- Do not let implementation start before relevant specs and acceptance scenarios exist.

## Generic Behavior

- ACO work proceeds through evidence, specs, acceptance tests, ADRs, smallest feature, validation, review.

## Archon-Specific Behavior

- Archon work uses package boundaries and existing validation commands; no direct commits to main.

## Inputs

- goal
- manifest
- graph reports
- docs readiness
- BMAD route

## Outputs

- phase reports
- blockers
- next BMAD command
- Tool Availability Ledger
- Commands Ledger

## Discovery Output Contract

Discovery is incomplete until the Tool Availability Ledger and Commands Ledger
exist for the work being assessed. In ACO prompt packages these ledgers are
first-class code-level artifacts, not only review checklist text.

The ledgers are discovery snapshots, not canonical capability registries. They
must cite evidence for each row, using a file path, command output, tool result,
or explicit `unknown`. Machine-readable JSON is the source of truth; Markdown is
a derived review view.

Allowed status values:

- `available`
- `partial`
- `blocked`
- `deferred`
- `forbidden`
- `not used`
- `unknown`

The Tool Availability Ledger records:

- tool or capability
- source
- invocation path
- scope
- status
- preconditions
- verification check
- primary use
- failure mode
- fallback
- owner
- last verified date
- notes

The Commands Ledger records:

- command
- file or location
- invocation
- purpose
- inputs
- outputs
- preconditions
- related tool
- status
- validation check
- failure mode
- owner
- last verified date
- notes

`Last Verified` uses `YYYY-MM-DD`, or `unknown` when the item was not checked
during the review.

Unknown capability must remain `unknown`, `blocked`, or `partial`; it must not
be inferred as available. Waived or partial graph evidence limits confidence and
must be recorded separately from implementation readiness. For example, an ACO
status of `failed` with graph partial and 2 waivers can still provide route
evidence, but cannot support a green readiness claim.

When a tool is unavailable, the ledger records the fallback behavior before any
hardening recommendation is made.

Command safety classification is advisory only. It must not execute commands,
broaden permissions, or replace approval policy. Unknown command safety remains
`unknown`; commands that write tracked files or generated artifacts remain
`forbidden` or approval-required during read-only discovery.

## Known Unknowns

- which later phases need correct-course

## Evidence References

- docs/context-orchestrator/research/graph-open-questions.md

## Acceptance Scenarios

- Given bootstrap evidence is incomplete, when implementation protocol runs, then it stops and completes bootstrap first.
- Given a POC solidification review begins, when tool availability is unknown, then the review records `unknown`, `blocked`, or `partial` instead of inventing availability.
- Given graph evidence is partial or waived, when the review reports readiness, then it marks the confidence limit and separates degraded ACO state from implementation readiness.
- Given a command can write tracked files or artifacts, when the review is read-only, then the command is marked `forbidden` or approval-required before it is run.
- AC-LEDGER-001: Given a ledger bundle is built, when `.history/` is absent, then the bundle still renders from ACO code-level evidence.
- AC-LEDGER-002: Given ledger rows are supplied out of order, when they render, then JSON and Markdown output sort rows deterministically by stable row ID.
- AC-LEDGER-003: Given evidence is missing, blocked, or partial, when rows normalize, then their statuses remain `unknown`, `blocked`, or `partial`.
- AC-LEDGER-008: Given ledger-leveraged validation runs, when completion is reported, then validation commands and their pass, partial, blocked, skipped, or failed states are recorded as evidence.

## Failure Behavior

- Blocked assumptions route to correct-course.

## Security Constraints

- Do not broaden permissions silently during discovery.

## Open Questions

- Should protocol be enforced by tests, scripts, or BMAD checklist?
