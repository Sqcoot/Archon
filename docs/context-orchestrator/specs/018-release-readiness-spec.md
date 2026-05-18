# 018 Release Readiness Spec

## Purpose

Define final readiness gate for ACO MVP.

## Scope

Validation commands, reports, unknowns, waivers, limitations, next BMAD command.

## Non-Goals

- Do not release with failing required acceptance suites.

## Generic Behavior

- ReleaseReadinessReport aggregates spec, acceptance, contract, golden, integration, security, build, and waiver status.
- Confidence-closure PRs must explain scope, validation, remaining waivers, release risk, and rollback before broader release is claimed.

## Archon-Specific Behavior

- Use `bun run validate` before PR; use workflow/command validation if surfaces are created.

## Inputs

- test output
- build output
- validation output
- waivers
- ADR decisions

## Outputs

- docs/context-orchestrator/final-validation-report.md
- PR confidence-closure narrative

## Known Unknowns

- final MVP surfaces and commands

## Evidence References

- AGENTS.md
- package.json

## Acceptance Scenarios

- Given one required acceptance suite fails, when release readiness is checked, then release readiness fails and report lists blocker plus next BMAD command.
- AC-CONFIDENCE-006: Given the ACO confidence-closure PR narrative is prepared, when reviewers inspect it, then it lists scope, validation commands, remaining waivers, release risk, and rollback path.

## Failure Behavior

- Fail release readiness on required test, build, security, or validation failure.

## Security Constraints

- Final report must not include secrets or raw env values.

## Open Questions

- Should release readiness be a CLI command in MVP or a docs checklist?
