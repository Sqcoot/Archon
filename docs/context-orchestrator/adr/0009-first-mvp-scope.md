# ADR 0009: First MVP Scope

Status: accepted

## Context

ACO has candidate CLI, slash command, workflow, and API surfaces.

## Decision

The first MVP is CLI only:

- `context status`
- `context validate`
- `context compile`

## Alternatives Considered

- Add all surfaces.
- Workflow-first.
- API-first.

## Consequences

- Smaller blast radius.
- Later surfaces can reuse the generic package.

## Evidence

- `docs/context-orchestrator/bmad/product-brief.md`
- `docs/context-orchestrator/bmad/prd.md`

## Acceptance Tests Required

- CLI acceptance.
- Release acceptance.

## Rollback Or Correct-Course Trigger

If CLI cannot represent the package result cleanly, add workflow surface only after a new ADR.
