# 018 Release Readiness Spec

## Purpose

Define final readiness gate for ACO MVP.

## Scope

Validation commands, reports, unknowns, waivers, limitations, next BMAD skill.

## Non-Goals

- Do not release with failing required acceptance suites.

## Generic Behavior

- ReleaseReadinessReport aggregates spec, acceptance, contract, golden, integration, security, build, and waiver status.
- Confidence-closure PRs must explain scope, validation, remaining waivers, release risk, and rollback before broader release is claimed.
- Context Orchestrator visibility reports `graphStatus=forbidden` when remaining graph waivers are failed and waiver-required. Validation can still pass, but graph readiness is `needs_approval`.
- Context Orchestrator workflow, PR, and demo visibility must use "Needs approval" when validation passes but graph confidence is forbidden due failed waiver-required evidence. It must not claim complete graph coverage.

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
- Context Orchestrator demo script and PR/handoff narrative

## Known Unknowns

- final MVP surfaces and commands

## Evidence References

- AGENTS.md
- package.json

## Acceptance Scenarios

- Given one required acceptance suite fails, when release readiness is checked, then release readiness fails and report lists blocker plus next BMAD skill.
- AC-CONFIDENCE-006: Given the ACO confidence-closure PR narrative is prepared, when reviewers inspect it, then it lists scope, validation commands, remaining waivers, release risk, and rollback path.
- AC-ACO-STATUS-007: Given Context Orchestrator status ships with failed waiver-required graph evidence, when release readiness is reported, then `graph-waiver.bmad-plugins-marketplace` and `graph-waiver.bmad-sample-data` remain visible as approval-required graph confidence limits.
- AC-P3-PR: Given Context Orchestrator readiness is included in PR or handoff text, when reviewers inspect it, then it includes validation, graph status, waiver IDs, ledger schema, ledger counts, and the Needs approval caveat.
- AC-FORBIDDEN-GRAPH-001: Given failed graph waivers remain unresolved, when release readiness is reported, then it must say `Needs approval` and must not say `Ready with known limits`.
- AC-P2-DEMO: Given the Context Orchestrator demo script is used, when the flow is followed, then it traces `/api/aco/status` to workflow run detail and PR/handoff output without claiming complete graph coverage.

## Failure Behavior

- Fail release readiness on required test, build, security, or validation failure.

## Security Constraints

- Final report must not include secrets or raw env values.

## Open Questions

- Should release readiness be a CLI command in MVP or a docs checklist?
