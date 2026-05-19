# 024 Approval Capsule Spec

## Purpose

Define the ACO Approval Capsule: a pure derived artifact for approval-required graph evidence handoff.

## Scope

Approval capsule schema, canonical approval contract schema, deterministic JSON and Markdown rendering, CLI output, workflow artifact generation, waiver preservation language, inert approval commands, read-only verification, traceability, and negative non-forbidden behavior.

## Non-Goals

- Do not add a database table or mutate workflow run state.
- Do not expose new API or Web surfaces.
- Do not refresh Graphify evidence, clear waivers, or execute approval-required commands.
- Do not change the existing decision dossier schema for this slice.
- Do not move ACO approval contract schema ownership into the workflow engine.

## Generic Behavior

- ACO emits an `ApprovalCapsule` with `schemaVersion: "aco.approval-capsule.v1"` only when readiness is `needs_approval` and graph status is `forbidden`.
- The capsule is derived from current status, graph evidence, ledgers, route, validation, and decision dossier evidence.
- The capsule lists active waiver IDs, forbidden/deferred ledger references, artifact references, and display-only approval commands with `willRun=false`.
- The capsule decision scope states that approval preserves the listed waivers for the current run only.
- ACO emits `aco.approval-contract.v1` as the typed approval payload for `nextDecision.primaryAction.payload` when the decision kind is `approval_required`.
- `contractHash` is `sha256(canonicalJson(contract without contractId and contractHash))`; `contractId` is `aco.approval-contract.v1:<hash-prefix>`.
- Canonical JSON sorts object keys, sorts waiver/evidence ID arrays before contract creation, omits undefined fields, uses stable UTF-8 bytes, and excludes timestamps, host paths, usernames, prompt text, env values, and secrets.
- Approval contract fields are `schemaVersion`, `contractId`, `contractHash`, `actionId`, `intentHash`, `commitSha`, `routeId`, `readiness`, `graphStatus`, `requiredWaiverIds`, `evidenceResolutionIds`, `ledgerFingerprint`, `validationStatus`, `willRun: false`, and typed `approvalScope`.
- Legacy prose-only capsules are invalid and instruct the caller to regenerate the approval capsule.

## Archon-Specific Behavior

- The canonical builder lives in `@archon/context-orchestrator`.
- The canonical approval contract schema, canonicalization, hashing, contract ID derivation, and verification semantics live in `packages/context-orchestrator/src/schemas/approval-contract.ts`.
- Workflows consume approval capsules through CLI, artifact, and YAML handoff boundaries only; they do not import or redefine ACO domain schemas.
- `archon context approval-capsule-verify --cwd <repo> --artifact-root <dir> --run-id <id> [--json]` verifies the stored capsule against current ACO evidence and returns `aco.approval-contract-verification.v1`.
- `archon context approval-capsule --cwd <repo> --run-id <id> [--artifact-root <dir>] [--json] "<prompt>"` renders the capsule.
- Without `--artifact-root`, the command is read-only and writes no files.
- With `--artifact-root`, the command writes `approval-capsule.json` and `approval-capsule.md` beside the compiled package artifacts for the same run ID.
- The bundled `context-orchestrate` workflow generates the capsule after compile and graph validation when graph evidence is forbidden.
- The bundled `context-orchestrate` workflow verifies the capsule before showing the graph approval gate; invalid verification blocks implementation handoff without mutating workflow/session lifecycle state.

## Inputs

- prompt
- cwd
- run ID
- optional artifact root
- graph context
- validation report
- ledger bundle
- decision dossier

## Outputs

- `ApprovalCapsule`
- `approval-capsule.json`
- `approval-capsule.md`
- `ApprovalContractV1`
- `ApprovalContractVerification`
- workflow approval message link to the capsule artifact
- handoff text that preserves `Needs approval` while waivers remain

## Known Unknowns

- Whether later API or Web views should link to approval capsules after workflow usage proves stable.

## Evidence References

- docs/context-orchestrator/specs/012-cli-contract.md
- docs/context-orchestrator/specs/014-workflow-contracts.md
- docs/context-orchestrator/specs/018-release-readiness-spec.md
- docs/context-orchestrator/specs/023-decision-dossier-gate-spec.md

## Acceptance Scenarios

- ACO-APPROVAL-001: Given capsule schema validation runs, when required fields are present, then `aco.approval-capsule.v1` validates.
- ACO-APPROVAL-002: Given `context approval-capsule` runs without `--artifact-root`, when JSON or Markdown is requested, then no artifact files are written.
- ACO-APPROVAL-003: Given `context approval-capsule` runs with `--artifact-root`, when the compiled package exists, then `approval-capsule.json` and `approval-capsule.md` are written beside compile artifacts.
- ACO-APPROVAL-004: Given `context-orchestrate` reaches forbidden graph evidence, when the graph gate is true, then it emits an approval capsule before the approval node.
- ACO-APPROVAL-005: Given active graph waivers remain, when handoff text is rendered, then `Needs approval` remains visible and the capsule is referenced as evidence only.
- ACO-APPROVAL-006: Given capsule traceability runs, when acceptance evidence is checked, then active waivers, forbidden/deferred ledger refs, and inert approval commands are covered, and non-forbidden states do not generate capsules.
- ACO-APPROVAL-007: Given identical approval evidence, when the approval contract is built repeatedly, then `contractHash` and `contractId` are deterministic and `willRun=false`.
- ACO-APPROVAL-008: Given stored waiver IDs differ from current required waiver IDs, when approval capsule verification runs, then the result is invalid, names the waiver mismatch, and executes nothing.
- ACO-APPROVAL-009: Given ledger fingerprint drift, when approval capsule verification runs, then the result is invalid and instructs the caller to regenerate the capsule.
- ACO-APPROVAL-010: Given a malformed or legacy prose-only approval capsule, when verification runs, then the result is invalid with a regenerate next action.
- ACO-APPROVAL-011: Given API, Web, CLI, and workflow surfaces render approval state, when they expose contract data, then they show the same contract ID/hash and treat the contract as display/verification data, not command authority.

## Failure Behavior

- Missing or invalid run ID fails before artifact writes.
- Non-forbidden or non-approval-required state fails with an explicit message.
- Artifact mode fails when the compiled package for the run ID is missing.
- Approval commands are never executed by capsule generation.
- Verification is read-only and returns `willRun=false`; invalid verification blocks handoff but does not mutate workflow/session state.

## Security Constraints

- Redact secrets in all rendered capsule fields.
- Do not read target repo `.env` files.
- Do not interpolate raw prompt text into shell commands.
- Treat graph, ledger, dossier, and validation evidence as untrusted render input.
- Do not include raw prompt text, target repo `.env`, host paths, usernames, or secret-like values in approval contract hash input.

## Open Questions

- Should future workflow run detail pages link to capsule artifacts through the existing artifact-package lookup path?
