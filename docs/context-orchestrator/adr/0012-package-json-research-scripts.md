# ADR 0012: Package JSON Research Scripts

Status: accepted

## Context

ACO discovery depends on refreshable upstream repositories and graph evidence.

## Decision

Keep root `package.json` research scripts with `research:*` names and aggregate `aco:research`.

## Alternatives Considered

- Only standalone script paths.
- `aco:*` names only.

## Consequences

- Research corpus can be refreshed with stable commands.
- Existing script names were not overwritten.

## Evidence

- `package.json`
- `docs/context-orchestrator/specs/020-package-scripts-and-research-corpus-spec.md`

## Acceptance Tests Required

- Bootstrap acceptance.
- Release acceptance.

## Rollback Or Correct-Course Trigger

If script naming conflicts appear later, add `aco:` aliases without removing existing `research:*` scripts.
