# 022 SDD ATDD Traceability Gate Spec

## Purpose

Define the deterministic SDD and ATDD traceability gate for ACO policy and selected native-loop acceptance evidence.

## Scope

Static traceability validation for selected ACO OPA policy, policy-decision, ledger, confidence, status, native-loop, and traceability requirements, their specs, acceptance evidence, fixtures, scripts, and CI wiring.

## Non-Goals

- Do not evaluate OPA policies.
- Do not parse Rego semantics.
- Do not change archive, compiler, runtime, server, workflow, UI, database, Wasm, or decision-log behavior.
- Do not enforce every historical ACO acceptance ID in the first traceability gate.

## Generic Behavior

- The traceability manifest is the machine-readable traceability contract.
- The spec traceability matrix is the human-readable traceability view.
- Each enforced requirement MUST appear in the manifest, its source spec, the traceability matrix, and its declared acceptance evidence.
- Each declared evidence reference MUST exist and contain every declared marker.
- Evidence labels MUST be one of `VERIFIED`, `INFERRED`, or `HYPOTHESIS`.
- Validation MUST be deterministic, static, local, and free of wall-clock timestamps.

## Archon-Specific Behavior

- The canonical manifest path is `docs/context-orchestrator/specs/traceability/aco-traceability.json`.
- The traceability validator is `scripts/context-orchestrator/validate-traceability.ts`.
- Local validation runs `bun run aco:traceability`.
- `bun run validate` runs `bun run aco:traceability` before type checking.
- CI runs `bun run aco:traceability` after `bun run aco:policy`.
- `validateContextOrchestrator()` reports `aco-traceability` and `aco-acceptance` checks.
- The enforced scope is recorded in the manifest and includes the selected native-loop acceptance surfaces.

## Inputs

- `docs/context-orchestrator/specs/traceability/aco-traceability.json`
- `docs/context-orchestrator/specs/spec-traceability-matrix.md`
- ACO spec markdown files
- ACO acceptance tests
- OPA policy fixtures and Rego tests
- `package.json`
- `.github/workflows/test.yml`

## Outputs

- `aco:traceability` validation result
- `aco-traceability` aggregate validation check
- `aco-acceptance` aggregate validation check
- CI traceability gate result

## Known Unknowns

- Which non-OPA ACO requirement families should enter the enforced traceability manifest after this first gate proves stable.

## Evidence References

- docs/context-orchestrator/specs/016-acceptance-test-plan.md
- docs/context-orchestrator/specs/021-opa-prompt-package-policy-spec.md
- docs/context-orchestrator/specs/spec-traceability-matrix.md

## Acceptance Scenarios

- ACO-TRACE-001: Given the committed ACO traceability manifest, when `bun run aco:traceability` runs, then every enforced OPA and policy-decision requirement maps to its spec, matrix entry, acceptance evidence, and declared evidence markers.
- ACO-TRACE-002: Given a manifest entry references a missing evidence marker, when the validator runs with `--manifest <path>`, then validation fails with the requirement ID, evidence path, and missing marker without mutating the committed manifest.
- ACO-TRACE-003: Given aggregate ACO validation runs, when traceability and selected native-loop acceptance validation succeeds, then `validateContextOrchestrator()` reports `aco-traceability` and `aco-acceptance` checks.

## Failure Behavior

- Missing manifest fails validation.
- Invalid manifest schema version or shape fails validation.
- Duplicate requirement IDs fail validation.
- Invalid evidence labels fail validation.
- Matrix IDs with enforced prefixes and no manifest entry fail validation.
- Manifest IDs missing from their source spec fail validation.
- Manifest IDs missing from the traceability matrix fail validation.
- Acceptance evidence files that are missing or lack required markers fail validation.
- Evidence files that are missing or lack required markers fail validation.
- Missing `aco:traceability` package script fails validation.
- Missing CI `bun run aco:traceability` step fails validation.

## Security Constraints

- The validator reads local text files only.
- The validator must not call network services.
- The validator must not write files.
- The validator must not evaluate OPA or mutate policies.

## Open Questions

- Which additional ACO requirement families should be enrolled after the OPA traceability gate is stable?
