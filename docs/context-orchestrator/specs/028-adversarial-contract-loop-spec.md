# 028 Adversarial Contract Loop Spec

## Purpose

Define the ACO Contracted Adversarial Loop as a provider-neutral Archon workflow pattern: ACO compiles route/status/ledger evidence, the Planner turns that evidence into a bounded plan, the Contract defines done, the Generator produces one contracted attempt, the Evaluator attacks the attempt against the contract, and Archon advances only from durable evidence.

## Scope

New bundled workflow `archon-aco-adversarial-loop`, loop artifact contract, explicit approval record behavior, ACO context references, JSON schemas for contracts/verdicts/findings/run state, traceability requirements, and acceptance coverage.

This change creates a new workflow, `.archon/workflows/defaults/archon-aco-adversarial-loop.yaml`.

It does not modify `.archon/workflows/defaults/archon-adversarial-dev.yaml`.

Existing adversarial-dev behavior remains unchanged.

## Non-Goals

- Do not add graph refresh, waiver removal, waiver normalization, or graph-status rewriting.
- Do not change provider SDKs, provider selection, UI behavior, database schema, or workflow engine lifecycle semantics.
- Do not make the Generator certify final quality.
- Do not use "approval bypass" language. The durable audit object is an explicit approval record.
- Do not replace Ralph cadence or `context-orchestrate`; this workflow composes their proven concepts.

## Generic Behavior

- The workflow starts by collecting ACO status, ledgers, and compile artifacts for the current objective.
- The Planner reads ACO artifacts and writes only `aco-adversarial-plan.md` plus `sprint-plan.json`.
- Contracting writes concrete criteria before any Generator attempt starts.
- The Generator reads the current contract and previous feedback, then writes a generator report for one contracted slice.
- The Evaluator is independent from the Generator, grades against contract criteria, and writes a verdict with evidence-bound findings.
- Findings include criterion ID, severity, reproduction, evidence, expected behavior, actual behavior, suggested fix direction, and `acoContextRefs`.
- The handoff reads all loop artifacts and records the current next decision.
- Every generated story, review finding, verdict, and approval gate includes a reference to its originating ACO context package item.

## Archon-Specific Behavior

- `archon-aco-adversarial-loop` runs without top-level `provider`; provider is inherited from caller or config.
- ACO refs are written under `$ARTIFACTS_DIR/context-orchestrator/`.
- Loop artifacts are written under `$ARTIFACTS_DIR/aco-adversarial-loop/`:
  - `aco-adversarial-plan.md`
  - `sprint-plan.json`
  - `run-state.json`
  - `contracts/sprint-001.contract.json`
  - `attempts/sprint-001-round-001.generator-report.json`
  - `verdicts/sprint-001-round-001.evaluator-verdict.json`
  - `feedback/sprint-001-round-001.feedback.json`
  - `handoff.md`
  - `trace.jsonl`
- The generator MUST NOT run while ACO readiness is `needs_approval` unless an explicit approval record exists for the current readiness result.
- The explicit approval record must preserve the current waiver IDs and verification evidence. Current known waiver IDs are `graph-waiver.bmad-plugins-marketplace` and `graph-waiver.bmad-sample-data`.
- The workflow fails closed if approval evidence is missing, malformed, or belongs to a different readiness result.
- The workflow consumes existing ACO graph evidence only; it does not rebuild graph evidence, delete waivers, or convert graph statuses.

## Inputs

- user objective
- ACO status JSON
- ACO ledgers JSON
- ACO compile result
- optional approval capsule verification
- explicit approval record
- prior feedback artifact for retries
- current sprint contract

## Outputs

- `AcoAdversarialReadinessInput`
- `AcoAdversarialExplicitApprovalRecord`
- `AcoAdversarialSprintContract`
- `AcoAdversarialGeneratedStoryPayload`
- `AcoAdversarialGeneratorReport`
- `AcoAdversarialFinding`
- `AcoAdversarialEvaluatorVerdict`
- `AcoAdversarialFeedbackArtifact`
- `AcoAdversarialRunState`
- handoff Markdown with ACO status/ledger/compile refs, validation result, next decision, contracts, attempts, verdicts, feedback, and blockers

## Known Unknowns

- Whether future runtime execution should turn the artifact contract into a reusable workflow node helper after this first provider-neutral workflow proves stable.
- Whether future UI surfaces should render adversarial loop artifacts directly.
- Whether multi-sprint retries need a shared helper after three real workflow users converge on the same shape.

## Evidence References

- .archon/workflows/defaults/archon-aco-adversarial-loop.yaml
- packages/context-orchestrator/src/schemas/adversarial-contract-loop.ts
- tests/acceptance/context-orchestrator/adversarial-contract-loop.acceptance.test.ts
- docs/context-orchestrator/specs/spec-traceability-matrix.md
- docs/context-orchestrator/specs/traceability/aco-traceability.json

## Acceptance Scenarios

- ACO-028-001: Given the adversarial loop spec is committed, when traceability validation runs, then every ACO-ADV acceptance ID has spec, matrix, acceptance, and evidence links.
- ACO-ADV-001: Given bundled workflows are available, when workflow validation runs for `archon-aco-adversarial-loop`, then it passes before use.
- ACO-ADV-002: Given the new workflow is added, when the existing `archon-adversarial-dev.yaml` is inspected, then existing app-from-scratch behavior remains unchanged.
- ACO-ADV-003: Given the new workflow is inspected, when provider configuration is checked, then it does not hardcode `provider: claude`, Claude-only assumptions, or app-from-scratch prompts.
- ACO-ADV-004: Given ACO readiness is `needs_approval`, when the workflow reaches Generator entry, then Generator remains blocked unless an explicit approval record exists for the current readiness result.
- ACO-ADV-005: Given current graph waivers exist, when the workflow runs, then it consumes status/ledgers/compile artifacts only and does not refresh graph evidence, remove waivers, normalize waiver state, or rewrite graph status.
- ACO-ADV-006: Given a sprint begins, when Generator starts, then the current sprint contract already exists and contains concrete criteria with observable proof and `acoContextRefs`.
- ACO-ADV-007: Given Evaluator completes, when its verdict is inspected, then it contains scores, evidence, and findings with criterion ID, severity, reproduction, expected behavior, actual behavior, suggested fix direction, and `acoContextRefs`.
- ACO-ADV-008: Given the workflow reaches handoff, when the handoff is read, then it includes ACO status/ledgers/compile refs, contracts, attempts, verdicts, feedback, validation result, next decision, known blockers, and preserved waiver IDs.

## Failure Behavior

- Missing status, ledgers, compile, or contract artifacts fail closed.
- Malformed explicit approval records fail closed.
- Approval records for a different readiness result are invalid.
- Missing `acoContextRefs` on generated stories, findings, verdicts, or approval gates is invalid.
- A failed verdict returns actionable findings to the next Generator attempt through a feedback artifact.
- A passed verdict advances run state or completes the run only through durable state updates.

## Security Constraints

- Do not read or archive `.env` files or secrets.
- Do not interpolate raw prompt text into shell commands.
- Do not execute command strings from verdicts, findings, or next-decision rendering.
- Do not silently broaden permissions or provider capabilities.
- Do not mutate workflow/session lifecycle state across process boundaries based on stale timers or inferred ownership.
- Evaluator must not edit source implementation during evaluation.

## Open Questions

- Should a later helper build explicit approval records from approval-capsule verification output instead of keeping the logic in workflow bash?
- Should a later runtime surface expose a typed "contracted loop" event stream after artifact evidence stabilizes?
- Should Ralph progress files consume evaluator verdicts directly in a later cadence integration?
