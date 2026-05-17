# ADR 0004: Graphify Mode

Status: accepted

## Context

Graphify may not be installed or may fail on some upstreams.

## Decision

ACO treats graph evidence as statusful input: `complete`, `failed`, `waived`, or `not-started`. The MVP reads generated graph summaries and does not require Graphify at compile time.

## Alternatives Considered

- Require Graphify for every compile.
- Ignore graph evidence in MVP.

## Consequences

- Compile stays deterministic.
- Waivers are preserved in prompt packages.

## Evidence

- `docs/context-orchestrator/research/graph-evidence-index.md`
- `docs/context-orchestrator/research/waivers.md`

## Acceptance Tests Required

- Graph acceptance.
- Compile acceptance.

## Rollback Or Correct-Course Trigger

If prompt package quality depends on fresh graph data, add explicit `--graph required` later.
