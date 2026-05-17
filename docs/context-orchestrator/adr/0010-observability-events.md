# ADR 0010: Observability Events

Status: accepted

## Context

Workflow events are useful but not part of CLI MVP runtime.

## Decision

MVP writes a validation report and manifest. Workflow events are deferred until workflow integration.

## Alternatives Considered

- Emit database workflow events from CLI compile.
- Add new observability tables.

## Consequences

- CLI MVP avoids DB mutation.
- Future workflow wrapper can emit documented events.

## Evidence

- `docs/context-orchestrator/specs/019-observability-and-events-spec.md`

## Acceptance Tests Required

- Events acceptance may be pending or scoped to deferred workflow integration.

## Rollback Or Correct-Course Trigger

If CLI users need machine-readable event streams, revisit after MVP.
