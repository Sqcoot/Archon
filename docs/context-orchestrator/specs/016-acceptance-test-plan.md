# 016 Acceptance Test Plan

## Purpose

Define ATDD structure before implementation.

## Scope

Acceptance, contract, golden, integration, unit, and security tests for ACO.

## Non-Goals

- Do not replace acceptance tests with unit-only coverage.

## Generic Behavior

- Acceptance tests define done; unit tests support implementation details only.
- Enforced traceability requirements must map specs, acceptance evidence, and executable checks before implementation is considered complete.

## Archon-Specific Behavior

- Tests should fit Bun workspace isolation and avoid root `bun test`; use project scripts or isolated package commands.

## Inputs

- spec IDs
- acceptance IDs
- feature stories
- risk areas

## Outputs

- tests/acceptance/context-orchestrator/*
- traceability matrix
- docs/context-orchestrator/specs/traceability/aco-traceability.json

## Known Unknowns

- final test package location
- whether CLI/API/workflow surfaces are MVP

## Evidence References

- docs/context-orchestrator/research/bootstrap-acceptance-scenarios.md
- docs/context-orchestrator/specs/022-sdd-atdd-traceability-gate-spec.md

## Acceptance Scenarios

- Given a production ACO feature, when acceptance tests are searched, then at least one acceptance scenario maps to its spec ID.

## Failure Behavior

- Implementation readiness fails if acceptance tests are missing for selected MVP surface.
- `bun run aco:traceability` fails when an enforced acceptance ID is not linked to its spec, traceability matrix row, acceptance evidence, and declared evidence markers.

## Security Constraints

- Security acceptance tests must verify redaction and path traversal behavior.

## Open Questions

- Should acceptance tests live in root tests or package-local tests?
