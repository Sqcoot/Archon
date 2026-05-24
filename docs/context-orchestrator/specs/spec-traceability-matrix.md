# Spec Traceability Matrix

| Spec | Acceptance IDs | Evidence | Implementation status |
| --- | --- | --- | --- |
| 013-api-contract.openapi.yaml | AC-P1-API | `packages/server/src/routes/api.aco.test.ts`; `tests/acceptance/context-orchestrator/api.acceptance.test.ts` | selected native API contract enforced |
| 012-cli-contract.md | AC-P1-SLASH | `packages/core/src/handlers/command-handler.ts`; `packages/core/src/handlers/command-handler.test.ts`; `tests/acceptance/context-orchestrator/command.acceptance.test.ts` | slash-command contract enforced |
| 014-workflow-contracts.md | AC-P3-WF | `.archon/workflows/defaults/context-orchestrate.yaml`; `tests/acceptance/context-orchestrator/workflow.acceptance.test.ts` | workflow default contract enforced |
| 019-observability-and-events-spec.md | ACO-EVENTS-001 | `.archon/workflows/defaults/context-orchestrate.yaml`; `packages/workflows/src/dag-executor.ts`; `packages/workflows/src/store.ts`; `packages/workflows/src/event-emitter.test.ts`; `tests/acceptance/context-orchestrator/events.acceptance.test.ts` | existing event flow guarded |
| 022-sdd-atdd-traceability-gate-spec.md | ACO-TRACE-001 | `scripts/context-orchestrator/validate-traceability.ts`; `tests/acceptance/context-orchestrator/traceability.acceptance.test.ts` | traceability validator enforced |
| 022-sdd-atdd-traceability-gate-spec.md | ACO-TRACE-002 | `scripts/context-orchestrator/validate-traceability.ts`; `tests/acceptance/context-orchestrator/traceability.acceptance.test.ts` | manifest drift failure enforced |
| 022-sdd-atdd-traceability-gate-spec.md | ACO-TRACE-003 | `packages/context-orchestrator/src/validation.ts`; `tests/acceptance/context-orchestrator/traceability.acceptance.test.ts` | aggregate validation reports traceability and acceptance |
| 014-workflow-contracts.md | ACO-ADV-006 | `.archon/workflows/defaults/archon-aco-adversarial-loop.yaml`; workflow provider override `--provider codex`; `scripts/context-orchestrator/check-role-contracts.ts`; `tests/acceptance/context-orchestrator/workflow.acceptance.test.ts` | adversarial-loop role contract boundaries enforced without a Codex-named workflow fork |
| 014-workflow-contracts.md | ACO-ADV-007 | `.archon/workflows/defaults/archon-aco-adversarial-loop.yaml`; workflow provider override `--provider codex`; `packages/context-orchestrator/src/schemas/adversarial-contract-loop.ts`; `packages/context-orchestrator/src/adversarial-contract-loop.test.ts`; `tests/acceptance/context-orchestrator/workflow.acceptance.test.ts` | evaluator owns original-goal completion verdict |

Lifecycle:

- Consumer: `bun run aco:traceability`, `bun run aco:test:acceptance`, CI, and ACO ledgers.
- Source input: the specs, selected acceptance tests, and implementation evidence listed in `docs/context-orchestrator/specs/traceability/aco-traceability.json`.
- Regeneration command: update this matrix manually with the manifest whenever enforced ACO IDs change, then run `bun run aco:traceability`.
- Drift/removal policy: remove rows only when the related spec, acceptance ID, and manifest entry are removed or superseded together.
- Owner surface: `packages/context-orchestrator` and root validation scripts.
