# ADR 0011: DB Migration Not Needed

Status: accepted

## Context

ACO must archive prompt packages and report validation.

## Decision

No DB migration is needed for MVP. Use local archive files and CLI JSON output.

## Alternatives Considered

- Add `context_packages` table.
- Store package metadata in workflow events.

## Consequences

- No migration or rollback burden.
- Historical search is file-based only.

## Evidence

- `docs/context-orchestrator/specs/009-archive-artifact-spec.md`
- `docs/context-orchestrator/bmad/architecture.md`

## Acceptance Tests Required

- Archive acceptance.
- CLI acceptance.

## Rollback Or Correct-Course Trigger

If API or workflow surfaces require persisted package lookup, create a migration ADR.
