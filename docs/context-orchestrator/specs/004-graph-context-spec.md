# 004 Graph Context Spec

## Purpose

Define GraphContext and graph evidence use.

## Scope

Graphify modes, normalized graph summaries, merge behavior, waivers, and path safety.

## Non-Goals

- Do not require Graphify for every ACO run.
- Do not make graph merge quality an architecture decision by itself.

## Generic Behavior

- GraphContext summarizes repository graphs, graph status, node/edge counts, waivers, and open questions.
- GraphContext includes named waiver records for every waived repository. Each waiver record has a stable ID, owner, reason, source evidence, and expiry condition so graph confidence is explainable instead of only counted.
- Failed graph evidence with `waiverRequired=true` is a forbidden graph readiness limit. Non-failed waiver records may remain partial confidence limits.
- Graph modes are auto, required, off, and fixture.
- Graph Waiver Closure reports diagnose failed waiver-required graph evidence without clearing waivers, rebuilding graphs, or promoting readiness unless explicit follow-up evidence and approval exist.
- Graph Waiver Closure is evidence-only: it may synthesize a missing `graph.json` only from tracked, internally consistent waiver-required failure evidence, and must not repair or override existing malformed artifacts.

## Archon-Specific Behavior

- Research graphs live under ignored `research/graphs/`; workflow archives use `$ARTIFACTS_DIR`.
- Graph scripts must not dirty upstream repositories.

## Inputs

- upstream manifest
- Graphify outputs
- graph metadata
- waivers

## Outputs

- GraphContext
- graph evidence summary
- graph waiver records
- graph waiver closure report
- merged ecosystem report

## Known Unknowns

- whether deeper semantic Graphify extraction is needed for ADRs

## Evidence References

- docs/context-orchestrator/research/graph-evidence-index.md
- docs/context-orchestrator/research/merged-ecosystem-report.md

## Acceptance Scenarios

- Given Graphify fails for a non-controlling repo, when GraphContext is created, then status includes failed and waiverRequired=true.
- AC-CONFIDENCE-003: Given graph evidence is partial or forbidden, when GraphContext is created, then every waiver has a stable ID, owner, reason, evidence, and expiry condition.
- AC-FORBIDDEN-GRAPH-001: Given a failed repository has `waiverRequired=true`, when GraphContext is created, then graph readiness is `forbidden` and the waiver ID remains visible.
- AC-GWCL-001: Given failed waiver-required graph evidence exists, when Graph Waiver Closure runs, then every waiver is reported with diagnostics.
- AC-GWCL-002: Given a graph artifact is an empty waiver graph, when diagnostics are built, then it is classified as unresolved and not as graph success.
- AC-GWCL-003: Given failed graph evidence remains unresolved, when closure diagnostics are built, then readiness remains `needs_approval`.
- AC-GWCL-004: Given a closure report is emitted, when reviewers inspect it, then waiver IDs, graph artifact paths, owner, failure reason, next action, and expected success evidence are present.

## Failure Behavior

- Graph mode required fails if graph outputs cannot be produced or waived.

## Security Constraints

- Validate graph paths and keep outputs under approved artifact roots.

## Open Questions

- Should graph evidence normalize `links` to `edges` in persisted JSON?
