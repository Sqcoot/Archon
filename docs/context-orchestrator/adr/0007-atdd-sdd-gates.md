# ADR 0007: ATDD And SDD Gates

Status: accepted

## Context

The user explicitly requires specs and acceptance scenarios before production behavior.

## Decision

ACO compile output must instruct implementation agents to update specs first and acceptance scenarios before production code. ACO implementation itself must be covered by acceptance tests before production code.

## Alternatives Considered

- Unit-test-first only.
- Implementation-first with retroactive docs.

## Consequences

- More upfront files.
- Better traceability.

## Evidence

- `docs/context-orchestrator/specs/016-acceptance-test-plan.md`
- `docs/context-orchestrator/specs/spec-traceability-matrix.md`

## Acceptance Tests Required

- Specs acceptance.
- Acceptance planner acceptance.

## Rollback Or Correct-Course Trigger

If acceptance scenarios are missing for an implemented feature, stop and correct-course.
