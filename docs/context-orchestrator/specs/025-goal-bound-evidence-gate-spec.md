# 025 Goal-Bound Evidence Gate Spec

## Purpose

Define the Goal-Bound Evidence Gate so ACO readiness claims are bound to an explicit user objective and verified evidence provenance.

## Scope

Context intent metadata, ledger provenance fields, freshness state, readiness blockers for stale or unresolved required evidence, and propagation through CLI, API, Web, slash command, workflow, dossier, compile, approval capsule, and handoff surfaces.

## Non-Goals

- Do not add a database table for context intent or evidence state.
- Do not auto-refresh graph evidence or clear waivers.
- Do not run tracked-file write commands without explicit user approval.
- Do not replace existing graph waiver, dossier, approval capsule, policy, or traceability contracts.

## Generic Behavior

- ACO derives a `ContextIntent` from the caller objective, cwd, commit SHA, and generated timestamp.
- ACO stores the intent on status, ledger, compile, dossier, approval capsule, and handoff outputs.
- Ledger rows expose evidence provenance: `lastVerifiedAt`, `verificationSource`, `verificationMethod`, `sourceArtifact`, `nextVerificationAction`, and `freshness`.
- Freshness values are `fresh`, `stale`, `unknown`, and `waived`.
- Required stale, unknown, blocked, partial, or unresolved evidence emits named evidence blockers with row IDs and next actions.
- Evidence blockers also emit an `evidenceResolution` plan with typed closure items: evidence ID, capability ID, target kind, target name, resolver, next action, approval requirement, blocking acceptance IDs, and expected success evidence.
- Documentation evidence closure is deterministic during status/compile/dossier creation. It identifies OpenAI Docs MCP or Context7 resolution work but does not fetch documentation, mutate MCP config, refresh graph evidence, or write tracked files.
- Forbidden graph waivers remain approval-gated and must not be silently converted to ready evidence.

## Archon-Specific Behavior

- `archon context status` and `archon context ledgers` accept explicit intent text and fall back to a derived read-only status objective when no text is provided.
- `/context status`, `/context ledgers`, and `context-orchestrate` pass the user request as intent when available.
- API and Web ACO status/ledger calls pass the selected user objective where the UI has one, otherwise a derived status objective.
- Workflow handoff includes the intent hash so artifacts can be tied back to the goal that produced them.
- Status, compile, dossier, approval capsule, API, Web, slash, and workflow handoff surfaces expose evidence resolution without parsing prose.

## Inputs

- user objective
- cwd
- generated timestamp
- commit SHA
- graph evidence
- documentation plan
- validation report
- ledger bundle

## Outputs

- `ContextIntent`
- intent-bound status response
- intent-bound ledger bundle
- evidence blockers
- evidence resolution plan
- intent-bound prompt package and decision dossier
- intent-bound approval capsule
- workflow handoff text with intent hash

## Known Unknowns

- Whether future evidence freshness should have configurable staleness windows per row category.

## Evidence References

- packages/context-orchestrator/src/status.ts
- packages/context-orchestrator/src/ledgers.ts
- packages/context-orchestrator/src/compiler.ts
- packages/cli/src/commands/context.ts
- packages/server/src/routes/schemas/aco.schemas.ts
- .archon/workflows/defaults/context-orchestrate.yaml

## Acceptance Scenarios

- AC-ACO-INTENT-001: Given any ACO status, ledger, compile, dossier, approval capsule, slash command, API, Web, or workflow surface, when it builds ACO readiness evidence, then it includes a `ContextIntent` derived from the current user objective and does not rely on the old fixed status prompt.
- AC-ACO-EVIDENCE-001: Given a ledger bundle, when rows are serialized, then each row contains verified provenance fields and a freshness state. Documentation evidence also avoids imperative false positives, routes third-party unresolved targets to Context7 closure actions, and routes OpenAI/Codex targets to OpenAI Docs MCP.
- AC-ACO-BLOCKER-001: Given a required evidence row is stale, unknown, blocked, partial, or unresolved, when ACO computes readiness evidence, then it emits an evidence blocker with the exact row ID and next verification action.
- AC-ACO-WAIVER-001: Given graph evidence remains forbidden because named waivers are active, when intent-bound evidence is computed, then readiness remains `needs_approval` and waiver IDs remain visible.
- AC-ACO-BLOCKER-001: Given status, compile, dossier, approval capsule, slash, API, Web, or workflow handoff output is generated, when evidence resolution items exist, then the output includes structured `evidenceResolution` state or a direct rendering of its same fields.

## Failure Behavior

- Missing explicit intent on a surface that has user request text falls back only to a deterministic derived objective.
- Missing commit SHA does not fail readiness; it records `commitSha=unknown`.
- Required unresolved evidence prevents ready claims until the row is verified or explicitly waived.
- Evidence resolution items are advisory work items. They must not execute docs fetches, graph refreshes, or tracked-file writes as part of readiness computation.

## Security Constraints

- Redact secrets in intent text, provenance fields, blockers, and rendered handoffs.
- Do not hash raw secrets before redaction.
- Do not include absolute paths in OpenTelemetry span attributes.
- Do not execute graph refresh or tracked-file write commands as part of evidence computation.

## Open Questions

- Should future releases allow users to mark specific evidence blockers as accepted risk for a single run?
