# ADR 0009: First MVP Scope

Status: accepted

## Context

ACO has candidate CLI, slash command, workflow, and API surfaces.

## Decision

The first MVP is CLI only:

- `context route`
- `context status`
- `context validate`
- `context compile`

`context route` was added as a small deterministic adjunct to the original CLI MVP decision. It does not broaden the MVP beyond the CLI surface; it exposes the same BMAD route selection used by `context compile` so users can inspect routing before writing archives.

## Alternatives Considered

- Add all surfaces.
- Workflow-first.
- API-first.

## Consequences

- Smaller blast radius.
- Later surfaces can reuse the generic package.
- Route inspection is available without creating prompt package artifacts.
- Slash command, REST API, workflow, and workflow-event surfaces remain deferred.

## Evidence

- `docs/context-orchestrator/bmad/product-brief.md`
- `docs/context-orchestrator/bmad/prd.md`

## Acceptance Tests Required

- CLI acceptance.
- Route acceptance.
- Release acceptance.

## Rollback Or Correct-Course Trigger

If CLI cannot represent the package result cleanly, add workflow surface only after a new ADR.
