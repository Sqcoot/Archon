# ADR 0002: Package Boundary

Status: accepted

## Context

ACO domain objects must not be tied to server, workflow, or CLI-specific APIs.

## Decision

`@archon/context-orchestrator` owns models, planners, compiler, redaction, archive writer, and validation. CLI owns argument parsing and presentation.

## Alternatives Considered

- Put all logic in `packages/cli`.
- Put all logic in `packages/core`.

## Consequences

- Domain behavior is contract-testable.
- CLI integration remains thin.

## Evidence

- `docs/context-orchestrator/specs/002-capability-model.md`
- `docs/context-orchestrator/specs/008-prompt-package-spec.md`

## Acceptance Tests Required

- Route, docs, BMAD, acceptance planner, compile, archive, CLI tests.

## Rollback Or Correct-Course Trigger

If no non-CLI caller emerges after MVP, keep the package but avoid extra abstraction.
