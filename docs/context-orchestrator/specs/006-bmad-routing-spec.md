# 006 BMAD Routing Spec

## Purpose

Define BMAD route selection for ACO.

## Scope

Route catalog, brownfield route, quick route, correct-course route, and assumption-evidence gate.

## Non-Goals

- Do not run BMAD skills automatically without user-visible route evidence.
- Do not skip PRD validation before architecture-sensitive work.

## Generic Behavior

- BmadRoute contains route steps, rationale, assumptions, required gates, and fallback route.
- Architecture-sensitive brownfield work starts with context, documentation, research, PRD, validation, architecture, review, stories, readiness, sprint planning.

## Archon-Specific Behavior

- Archon route summaries can be exposed through CLI, slash command, workflow, or API after ADR selection.

## Inputs

- prompt intent
- graph evidence
- docs evidence
- risk level
- task size

## Outputs

- BmadRoute
- assumption-evidence gate result
- next BMAD command

## Known Unknowns

- exact local BMAD catalog availability in this repo
- whether custom assumption gate becomes a bundled workflow

## Evidence References

- docs/context-orchestrator/research/bmad-graph-report.md

## Acceptance Scenarios

- Given architecture-sensitive Archon work, when ACO routes the prompt, then PRD validation occurs before architecture and readiness before sprint planning.

## Failure Behavior

- Blocked architecture-controlling assumptions trigger correct-course.

## Security Constraints

- BMAD route output must not expose secrets or raw env values.

## Open Questions

- Should route catalog be data-driven YAML or TypeScript constants in MVP?
