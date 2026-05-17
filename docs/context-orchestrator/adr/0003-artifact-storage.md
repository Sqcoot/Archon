# ADR 0003: Artifact Storage

Status: accepted

## Context

ACO must archive prompt packages without a premature database migration.

## Decision

CLI archives go under `.archon/artifacts/context-orchestrator/<run-id>/`. Future workflow runs may override archive root with `$ARTIFACTS_DIR/context-orchestrator/<run-id>/`.

## Alternatives Considered

- New database tables.
- Store under `docs/`.
- Store under `research/`.

## Consequences

- Artifacts are local and reversible.
- No migration required.

## Evidence

- `docs/context-orchestrator/specs/009-archive-artifact-spec.md`
- `docs/context-orchestrator/specs/015-security-threat-model.md`

## Acceptance Tests Required

- Archive acceptance.
- Security acceptance.

## Rollback Or Correct-Course Trigger

If multiple platforms need queryable package history, write a DB migration ADR before adding tables.
