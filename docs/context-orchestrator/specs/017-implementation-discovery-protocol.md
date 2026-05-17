# 017 Implementation Discovery Protocol

## Purpose

Define discovery-first implementation order.

## Scope

Preflight, graph/docs evidence, specs, acceptance, ADRs, implementation, validation, retrospective.

## Non-Goals

- Do not let implementation start before relevant specs and acceptance scenarios exist.

## Generic Behavior

- ACO work proceeds through evidence, specs, acceptance tests, ADRs, smallest feature, validation, review.

## Archon-Specific Behavior

- Archon work uses package boundaries and existing validation commands; no direct commits to main.

## Inputs

- goal
- manifest
- graph reports
- docs readiness
- BMAD route

## Outputs

- phase reports
- blockers
- next BMAD command

## Known Unknowns

- which later phases need correct-course

## Evidence References

- docs/context-orchestrator/research/graph-open-questions.md

## Acceptance Scenarios

- Given bootstrap evidence is incomplete, when implementation protocol runs, then it stops and completes bootstrap first.

## Failure Behavior

- Blocked assumptions route to correct-course.

## Security Constraints

- Do not broaden permissions silently during discovery.

## Open Questions

- Should protocol be enforced by tests, scripts, or BMAD checklist?
