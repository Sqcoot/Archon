# ADR 0001: Implementation Host

Status: accepted

## Context

ACO needs a generic core and at least one Archon-native surface.

## Decision

Implement ACO core in a new package, `@archon/context-orchestrator`, and expose the MVP through `packages/cli`.

## Alternatives Considered

- Existing `@archon/core` module.
- Workflow-only implementation.
- API-first implementation.

## Consequences

- Adds one workspace package.
- Keeps generic ACO logic independent of CLI/server/workflow runtime.

## Evidence

- `docs/context-orchestrator/bmad/architecture-options.md`
- `docs/context-orchestrator/bmad/technical-research.md`

## Acceptance Tests Required

- CLI acceptance.
- Compile acceptance.
- Security acceptance.

## Rollback Or Correct-Course Trigger

If the package creates circular dependencies, move the core to an existing lower-level package or reduce MVP to CLI-only helpers.
