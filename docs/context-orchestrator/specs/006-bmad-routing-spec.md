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
- Architecture-sensitive brownfield work starts with context, documentation, research, forensic investigation when evidence is uncertain, PRD, validation, architecture, review, stories, readiness, sprint planning.
- Route steps should prefer skills available in the installed BMAD catalog. Optional module skills must not be emitted as required route steps unless the module is installed or explicitly selected.
- Route selection is deterministic and conservative. Ambiguous, underspecified, or conflicting prompts return the help route with `requiresDecision=true`; they must not default to the full brownfield architecture route.
- Route output includes matched signals, rejected alternatives, confidence, fallback behavior, and a next recommended action.

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
- next BMAD skill

## Known Unknowns

- whether future route catalogs should be resolved dynamically from `_bmad/_config/bmad-help.csv`
- whether custom assumption gate becomes a bundled workflow

## Evidence References

- docs/context-orchestrator/research/bmad-graph-report.md

## Acceptance Scenarios

- Given architecture-sensitive Archon work, when ACO routes the prompt, then current installed BMAD skills are emitted, PRD validation occurs before architecture, and readiness occurs before sprint planning.
- Given blocked or urgent input, when ACO routes the prompt, then the correct-course route is selected with the blocking signal recorded.
- Given a small typo or contained fix, when ACO routes the prompt, then the quick-contained route is selected and architecture routes are rejected.
- Given ambiguous, missing-context, or conflicting input, when ACO routes the prompt, then the route is `unknown-help`, `requiresDecision=true`, and no confident ready/brownfield claim is made.
- Given explicit user intent for a BMAD route, when ACO routes the prompt, then the chosen route records the explicit intent as a matched signal.

## Failure Behavior

- Blocked architecture-controlling assumptions trigger correct-course.

## Security Constraints

- BMAD route output must not expose secrets or raw env values.

## Open Questions

- Should route catalog be data-driven YAML or TypeScript constants in MVP?
