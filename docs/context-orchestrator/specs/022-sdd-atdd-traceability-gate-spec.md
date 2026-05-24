# SDD/ATDD Traceability Gate

ACO-TRACE-001 covers the deterministic traceability validator. The validator reads `docs/context-orchestrator/specs/traceability/aco-traceability.json`, checks linked specs, matrix rows, acceptance files, and implementation evidence, then reports drift.

ACO-TRACE-002 covers negative drift detection. The validator must support `--manifest` so tests can supply a temporary manifest and prove missing markers fail without editing committed source.

ACO-TRACE-003 covers aggregate validation. `validateContextOrchestrator()` must report traceability and selected acceptance checks alongside policy and package-script checks.

Lifecycle:

- Consumer: repository validation, CI, and ACO ledgers.
- Source input: specs, matrix, selected acceptance tests, and referenced implementation evidence.
- Update rule: update the manifest in the same change as any enforced ID, spec, acceptance, or evidence marker.
- Drift/removal policy: remove manifest entries only when the related durable surface is explicitly removed or superseded.
- Owner surface: `packages/context-orchestrator` plus root validation scripts.
